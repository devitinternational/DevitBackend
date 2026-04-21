import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";
import { prisma } from "../lib/prisma.js";
import { generateCertificatePdf } from "../lib/certificate.js";
import { uploadBuffer, getPresignedDownloadUrl } from "../lib/storage.js";

export async function getCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const enrollmentId = req.params.enrollmentId as string;
    const userId = req.user!.id;

    const certificate = await prisma.certificate.findUnique({
      where: { enrollmentId },
      include: {
        enrollment: {
          include: {
            domain: { select: { title: true } },
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!certificate || certificate.userId !== userId) {
      res.status(404).json({ success: false, message: "Certificate not found" });
      return;
    }

    res.json({ success: true, data: certificate });
  } catch (err) {
    console.error("getCertificate error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch certificate" });
  }
}

export async function getPublicCertificate(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const hash = req.params.hash as string;

    const certificate = await prisma.certificate.findUnique({
      where: { verificationHash: hash },
      include: {
        enrollment: {
          include: {
            domain: { select: { title: true, slug: true } },
          },
        },
        user: { select: { name: true } },
      },
    });

    if (!certificate) {
      res.status(404).json({ success: false, message: "Certificate not found" });
      return;
    }

    res.json({
      success: true,
      data: {
        verificationHash: certificate.verificationHash,
        issueDate: certificate.issueDate,
        pdfUrl: certificate.pdfUrl,
        userName: certificate.user.name,
        domainTitle: certificate.enrollment.domain.title,
        durationMonths: certificate.enrollment.durationMonths,
      },
    });
  } catch (err) {
    console.error("getPublicCertificate error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch certificate" });
  }
}

export async function downloadCertificatePdf(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const enrollmentId = req.params.enrollmentId as string;
    const userId = req.user!.id;

    let certificate = await prisma.certificate.findUnique({
      where: { enrollmentId },
    });

    if (!certificate || certificate.userId !== userId) {
      res.status(404).json({ success: false, message: "Certificate not found" });
      return;
    }

    // Auto-heal: if PDF was never generated, do it now
    if (!certificate.pdfUrl) {
      await tryCompleteCourse(enrollmentId);

      // Re-fetch after regeneration
      certificate = await prisma.certificate.findUnique({
        where: { enrollmentId },
      });

      if (!certificate?.pdfUrl) {
        res.status(500).json({
          success: false,
          message: "PDF generation failed — please try again",
        });
        return;
      }
    }

    const key = `certificates/${certificate.verificationHash}.pdf`;
    const url = await getPresignedDownloadUrl(key, 3600);
    res.json({ success: true, data: { url } });
  } catch (err) {
    console.error("downloadCertificatePdf error:", err);
    res.status(500).json({ success: false, message: "Failed to get certificate PDF" });
  }
}

/**
 * Internal — called after every quiz/project submission is graded.
 * Checks if all required tasks are passed, marks enrollment complete,
 * generates and uploads the certificate PDF.
 */
export async function tryCompleteCourse(enrollmentId: string): Promise<void> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      domain: {
        include: {
          tasks: { where: { isRequired: true }, select: { id: true } },
        },
      },
      submissions: { select: { taskId: true, status: true } },
      user: { select: { name: true, email: true } },
      certificate: { select: { id: true, pdfUrl: true } },
    },
  });

  if (!enrollment) return;
  // Only bail if PDF already generated — null pdfUrl means retry needed
  if (enrollment.certificate?.pdfUrl) return;

  const requiredTaskIds = enrollment.domain.tasks.map((t) => t.id);
  const passedTaskIds = new Set(
    enrollment.submissions
      .filter((s) => s.status === "PASSED")
      .map((s) => s.taskId),
  );

  const allPassed = requiredTaskIds.every((id) => passedTaskIds.has(id));
  if (!allPassed) return;

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { completedAt: new Date() },
  });

  const verificationHash = `${enrollmentId}-${Date.now()}`;

  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await generateCertificatePdf({
      userName: enrollment.user.name ?? "Learner",
      domainTitle: enrollment.domain.title,
      durationMonths: enrollment.durationMonths,
      issueDate: new Date(),
      verificationHash,
    });

    const key = `certificates/${verificationHash}.pdf`;
    pdfUrl = await uploadBuffer(key, pdfBuffer, "application/pdf");
  } catch (err) {
    console.error(`tryCompleteCourse: PDF generation failed for ${enrollmentId}:`, err);
  }

  // Upsert — handles case where row exists with null pdfUrl (previous failed generation)
  await prisma.certificate.upsert({
    where: { enrollmentId },
    update: { pdfUrl: pdfUrl ?? null, verificationHash },
    create: {
      enrollmentId,
      userId: enrollment.userId,
      verificationHash,
      pdfUrl: pdfUrl ?? null,
    },
  });

  console.log(`✅ Certificate created for enrollment ${enrollmentId} — pdfUrl: ${pdfUrl ?? "PENDING"}`);
}

/**
 * POST /api/certificates/enrollment/:enrollmentId/generate
 * Manually trigger certificate generation. Works for learner (own) or admin (any).
 */
export async function generateCertificateForEnrollment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const enrollmentId = req.params.enrollmentId as string;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        domain: {
          include: {
            tasks: { where: { isRequired: true }, select: { id: true } },
          },
        },
        submissions: { select: { taskId: true, status: true } },
        user: { select: { name: true, email: true, id: true } },
        certificate: true,
      },
    });

    if (!enrollment) {
      res.status(404).json({ success: false, message: "Enrollment not found" });
      return;
    }

    // Auth check: only the owner or admin
    if (enrollment.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const requiredTaskIds = enrollment.domain.tasks.map((t) => t.id);
    const passedTaskIds = new Set(
      enrollment.submissions
        .filter((s) => s.status === "PASSED")
        .map((s) => s.taskId),
    );
    const allPassed = requiredTaskIds.every((id) => passedTaskIds.has(id));

    if (!allPassed && req.user!.role !== "ADMIN") {
      res.status(400).json({
        success: false,
        message: "Not all required tasks are passed yet",
      });
      return;
    }

    const verificationHash =
      enrollment.certificate?.verificationHash ??
      `${enrollmentId}-${Date.now()}`;

    const pdfBuffer = await generateCertificatePdf({
      userName: enrollment.user.name ?? "Learner",
      domainTitle: enrollment.domain.title,
      durationMonths: enrollment.durationMonths,
      issueDate: enrollment.certificate?.issueDate ?? new Date(),
      verificationHash,
    });

    const key = `certificates/${verificationHash}.pdf`;
    const pdfUrl = await uploadBuffer(key, pdfBuffer, "application/pdf");

    const certificate = await prisma.certificate.upsert({
      where: { enrollmentId },
      update: { pdfUrl },
      create: {
        enrollmentId,
        userId: enrollment.userId,
        verificationHash,
        pdfUrl,
      },
    });

    if (!enrollment.completedAt) {
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { completedAt: new Date() },
      });
    }

    res.json({ success: true, data: certificate });
  } catch (err) {
    console.error("generateCertificateForEnrollment error:", err);
    res.status(500).json({ success: false, message: "PDF generation failed" });
  }
}