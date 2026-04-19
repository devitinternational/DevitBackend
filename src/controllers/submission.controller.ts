import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";
import { prisma } from "../lib/prisma.js";
import { tryCompleteCourse } from "./certificate.controller.js";

/**
 * GET /api/submissions?enrollmentId=xxx
 */
export async function getSubmissions(req: AuthenticatedRequest, res: Response) {
  try {
    const { enrollmentId } = req.query as { enrollmentId?: string };
    const userId = req.user!.id;

    if (!enrollmentId) {
      res
        .status(400)
        .json({ success: false, message: "enrollmentId is required" });
      return;
    }

    // Verify the enrollment belongs to this user (or admin)
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { userId: true },
    });

    if (!enrollment) {
      res.status(404).json({ success: false, message: "Enrollment not found" });
      return;
    }

    if (enrollment.userId !== userId && req.user!.role !== "ADMIN") {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const submissions = await prisma.submission.findMany({
      where: { enrollmentId },
      select: {
        id: true,
        taskId: true,
        status: true,
        repoUrl: true,
        quizScore: true,
        reviewNotes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: submissions });
  } catch (err) {
    console.error("getSubmissions error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch submissions" });
  }
}

/**
 * POST /api/submissions/project
 * Body: { enrollmentId, taskId, repoUrl, notes? }
 */
export async function submitProject(req: AuthenticatedRequest, res: Response) {
  try {
    const { enrollmentId, taskId, repoUrl, notes } = req.body;
    const userId = req.user!.id;

    if (!enrollmentId || !taskId || !repoUrl) {
      res.status(400).json({
        success: false,
        message: "enrollmentId, taskId, and repoUrl are required",
      });
      return;
    }

    // Validate enrollment ownership and payment
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { userId: true, paymentStatus: true },
    });

    if (!enrollment || enrollment.userId !== userId) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    if (enrollment.paymentStatus !== "PAID") {
      res
        .status(402)
        .json({ success: false, message: "Enrollment not active" });
      return;
    }

    // Validate task exists and is PROJECT type
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { taskType: true },
    });

    if (!task || task.taskType !== "PROJECT") {
      res
        .status(400)
        .json({
          success: false,
          message: "Task not found or not a project task",
        });
      return;
    }

    // Upsert — allow resubmission
    const submission = await prisma.submission.upsert({
      where: { enrollmentId_taskId: { enrollmentId, taskId } },
      create: {
        enrollmentId,
        taskId,
        userId,
        repoUrl,
        notes,
        status: "PENDING",
      },
      update: {
        repoUrl,
        notes,
        status: "PENDING",
        reviewedAt: null,
        reviewNotes: null,
      },
    });

    res.json({ success: true, data: submission });
  } catch (err) {
    console.error("submitProject error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to submit project" });
  }
}

/**
 * POST /api/submissions/quiz
 * Body: { enrollmentId, taskId, answers: { [questionId]: optionId } }
 */
export async function submitQuiz(req: AuthenticatedRequest, res: Response) {
  try {
    const { enrollmentId, taskId, answers } = req.body as {
      enrollmentId: string;
      taskId: string;
      answers: Record<string, string>; // { questionId: optionId }
    };
    const userId = req.user!.id;

    if (!enrollmentId || !taskId || !answers) {
      res.status(400).json({
        success: false,
        message: "enrollmentId, taskId, and answers are required",
      });
      return;
    }

    // Validate enrollment ownership
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { userId: true, paymentStatus: true },
    });

    if (!enrollment || enrollment.userId !== userId) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    if (enrollment.paymentStatus !== "PAID") {
      res
        .status(402)
        .json({ success: false, message: "Enrollment not active" });
      return;
    }

    // Fetch task with questions and correct options
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        questions: {
          include: {
            options: { select: { id: true, isCorrect: true } },
          },
        },
      },
    });

    if (!task || task.taskType !== "QUIZ") {
      res
        .status(400)
        .json({ success: false, message: "Task not found or not a quiz task" });
      return;
    }

    // Score the quiz
    let correct = 0;
    for (const question of task.questions) {
      const selectedOptionId = answers[question.id];
      if (!selectedOptionId) continue;
      const selectedOption = question.options.find(
        (o) => o.id === selectedOptionId,
      );
      if (selectedOption?.isCorrect) correct++;
    }

    const total = task.questions.length;
    const quizScore = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passingScore = task.passingScore ?? 70;
    const passed = quizScore >= passingScore;

    // Upsert submission
    const submission = await prisma.submission.upsert({
      where: { enrollmentId_taskId: { enrollmentId, taskId } },
      create: {
        enrollmentId,
        taskId,
        userId,
        status: passed ? "PASSED" : "FAILED",
        quizScore,
        quizAnswers: answers,
      },
      update: {
        status: passed ? "PASSED" : "FAILED",
        quizScore,
        quizAnswers: answers,
        reviewedAt: new Date(),
      },
    });
    if (passed) {
      // Fire and forget — don't block the response
      tryCompleteCourse(enrollmentId).catch((err) =>
        console.error("tryCompleteCourse error:", err),
      );
    }

    res.json({
      success: true,
      data: {
        submission,
        score: quizScore,
        correct,
        total,
        passed,
        passingScore,
      },
    });
  } catch (err) {
    console.error("submitQuiz error:", err);
    res.status(500).json({ success: false, message: "Failed to submit quiz" });
  }
}


/**
 * PATCH /api/submissions/:submissionId/review
 * Body: { status: "PASSED" | "FAILED" | "NEEDS_REVISION", reviewNotes? }
 * ADMIN only
 */
export async function reviewSubmission(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { submissionId } = req.params;
    const { status, reviewNotes } = req.body as {
      status: "PASSED" | "FAILED" | "NEEDS_REVISION";
      reviewNotes?: string;
    };

    if (!["PASSED", "FAILED", "NEEDS_REVISION"].includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status" });
      return;
    }

    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: { status, reviewNotes, reviewedAt: new Date() },
    });

    if (status === "PASSED") {
      tryCompleteCourse(submission.enrollmentId).catch((err) =>
        console.error("tryCompleteCourse error:", err)
      );
    }

    res.json({ success: true, data: submission });
  } catch (err) {
    console.error("reviewSubmission error:", err);
    res.status(500).json({ success: false, message: "Failed to review submission" });
  }
}