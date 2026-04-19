import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";
import { prisma } from "../lib/prisma.js";

export async function getActiveEnrollment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user!.id;

    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, paymentStatus: "PAID" },
      orderBy: { createdAt: "desc" },
      include: {
        domain: {
          select: {
            id: true,
            title: true,
            slug: true,
            iconUrl: true,
            description: true,
            _count: { select: { tasks: true } },
          },
        },
        submissions: { select: { status: true } },
        invoice: { select: { invoiceNo: true, pdfUrl: true } },
        certificate: { select: { verificationHash: true, issueDate: true } },
      },
    });

    if (!enrollment) {
      res.json({ success: true, data: null });
      return;
    }

    const totalTasks = enrollment.domain._count.tasks;
    const passedTasks = enrollment.submissions.filter(
      (s) => s.status === "PASSED",
    ).length;
    const progress =
      totalTasks > 0 ? Math.round((passedTasks / totalTasks) * 100) : 0;

    res.json({
      success: true,
      data: {
        id: enrollment.id,
        domainId: enrollment.domainId,
        durationMonths: enrollment.durationMonths,
        startDate: enrollment.startDate,
        endDate: enrollment.endDate,
        paymentStatus: enrollment.paymentStatus,
        completedAt: enrollment.completedAt,
        progress,
        passedTasks,
        totalTasks,
        domain: enrollment.domain,
        invoice: enrollment.invoice,
        certificate: enrollment.certificate,
      },
    });
  } catch (err) {
    console.error("getActiveEnrollment error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch enrollment" });
  }
}

export async function getEnrollmentCurriculum(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const enrollmentId = req.params.enrollmentId as string;
    const userId = req.user!.id;
    const role = req.user!.role;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        domain: {
          include: {
            sections: {
              orderBy: { orderIndex: "asc" },
              include: {
                lessons: {
                  orderBy: { orderIndex: "asc" },
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    contentType: true,
                    isFree: true,
                    videoDurationSeconds: true,
                    externalUrl: true,
                    articleContent: true,
                    videoKey: true,
                  },
                },
              },
            },
            tasks: {
              orderBy: { orderIndex: "asc" },
              include: {
                questions: {
                  orderBy: { orderIndex: "asc" },
                  include: {
                    // Strip isCorrect — never expose to frontend
                    options: {
                      orderBy: { orderIndex: "asc" },
                      select: {
                        id: true,
                        text: true,
                        orderIndex: true,
                        // isCorrect intentionally omitted
                      },
                    },
                  },
                },
              },
            },
          },
        },
        submissions: true,
        lessonProgress: {
          select: { lessonId: true, completedAt: true },
        },
        certificate: {
          select: { verificationHash: true, issueDate: true, pdfUrl: true },
        },
      },
    });

    if (!enrollment) {
      res.status(404).json({ success: false, message: "Enrollment not found" });
      return;
    }

    if (enrollment.userId !== userId && role !== "ADMIN") {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    if (enrollment.paymentStatus !== "PAID") {
      res.status(402).json({ success: false, message: "Payment required" });
      return;
    }

    const totalTasks = enrollment.domain.tasks.filter(
      (t) => t.isRequired,
    ).length;
    const passedTasks = enrollment.submissions.filter(
      (s) => s.status === "PASSED",
    ).length;
    const progress =
      totalTasks > 0 ? Math.round((passedTasks / totalTasks) * 100) : 0;

    const completedLessonIds = new Set(
      enrollment.lessonProgress.map((lp) => lp.lessonId),
    );

    res.json({
      success: true,
      data: {
        ...enrollment,
        progress,
        passedTasks,
        totalTasks,
        completedLessonIds: [...completedLessonIds],
      },
    });
  } catch (err) {
    console.error("getEnrollmentCurriculum error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch curriculum" });
  }
}

export async function completeLesson(req: AuthenticatedRequest, res: Response) {
  try {
    const enrollmentId = req.params.enrollmentId as string;
    const lessonId = req.params.lessonId as string;
    const userId = req.user!.id;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { userId: true, paymentStatus: true },
    });

    if (!enrollment || enrollment.userId !== userId) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    if (enrollment.paymentStatus !== "PAID") {
      res.status(402).json({ success: false, message: "Payment required" });
      return;
    }

    await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId_enrollmentId: { userId, lessonId, enrollmentId },
      },
      create: { userId, lessonId, enrollmentId },
      update: {},
    });

    res.json({ success: true });
  } catch (err) {
    console.error("completeLesson error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark lesson complete" });
  }
}
