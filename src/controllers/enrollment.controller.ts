import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";
import { prisma } from "../lib/prisma.js";

const domainSelect = {
  id: true,
  title: true,
  slug: true,
  iconUrl: true,
  description: true,
  _count: { select: { tasks: true } },
} as const;

const certificateSelect = {
  verificationHash: true,
  issueDate: true,
  pdfUrl: true,
} as const;

type EnrollmentWithInvoice = Awaited<
  ReturnType<typeof fetchPaidEnrollmentsWithInvoices>
>[number];

type EnrollmentWithoutInvoice = Awaited<
  ReturnType<typeof fetchPaidEnrollmentsWithoutInvoices>
>[number];

function isMissingInvoicesTableError(err: unknown) {
  if (!err || typeof err !== "object" || !("code" in err)) return false;

  const code = (err as { code?: string }).code;
  const message =
    "message" in err && typeof err.message === "string" ? err.message : "";

  return code === "P2021" && message.includes("public.invoices");
}

async function fetchPaidEnrollmentsWithInvoices(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId, paymentStatus: "PAID" },
    orderBy: { createdAt: "desc" },
    include: {
      domain: { select: domainSelect },
      submissions: {
        select: { status: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { invoiceNo: true, pdfUrl: true },
      },
      certificate: {
        select: certificateSelect,
      },
    },
  });
}

async function fetchPaidEnrollmentsWithoutInvoices(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId, paymentStatus: "PAID" },
    orderBy: { createdAt: "desc" },
    include: {
      domain: { select: domainSelect },
      submissions: {
        select: { status: true },
      },
      certificate: {
        select: certificateSelect,
      },
    },
  });
}

async function fetchPaidEnrollments(userId: string) {
  try {
    return await fetchPaidEnrollmentsWithInvoices(userId);
  } catch (err) {
    if (!isMissingInvoicesTableError(err)) throw err;

    console.warn(
      "Invoices table is missing. Enrollment endpoints are returning data without invoice details."
    );

    return fetchPaidEnrollmentsWithoutInvoices(userId);
  }
}

function mapEnrollment(
  enrollment: EnrollmentWithInvoice | EnrollmentWithoutInvoice
) {
  const totalTasks = enrollment.domain._count.tasks;
  const passedTasks = enrollment.submissions.filter(
    (submission) => submission.status === "PASSED"
  ).length;
  const progress =
    totalTasks > 0 ? Math.round((passedTasks / totalTasks) * 100) : 0;

  return {
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
    invoice: "invoices" in enrollment ? enrollment.invoices[0] ?? null : null,
    certificate: enrollment.certificate ?? null,
  };
}

/**
 * GET /api/enrollments
 * Returns all PAID enrollments for the logged-in learner, newest first.
 */
export async function getEnrollments(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user!.id;

    const enrollments = await fetchPaidEnrollments(userId);

    res.json({
      success: true,
      data: enrollments.map(mapEnrollment),
    });
  } catch (err) {
    console.error("getEnrollments error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch enrollments" });
  }
}

/**
 * GET /api/enrollments/active
 * Returns the logged-in learner's most recent PAID enrollment.
 */
export async function getActiveEnrollment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user!.id;

    const enrollment = (await fetchPaidEnrollments(userId))[0] ?? null;

    if (!enrollment) {
      res.json({ success: true, data: null });
      return;
    }

    res.json({
      success: true,
      data: mapEnrollment(enrollment),
    });
  } catch (err) {
    console.error("getActiveEnrollment error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch enrollment" });
  }
}

/**
 * GET /api/enrollments/:enrollmentId/curriculum
 * Returns full section + lesson list for an enrollment the caller owns.
 * Gate: userId must match enrollment.userId (or ADMIN).
 */
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
                    options: { orderBy: { orderIndex: "asc" } },
                  },
                },
              },
            },
          },
        },
        submissions: true,
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
      res
        .status(402)
        .json({
          success: false,
          message: "Payment required to access curriculum",
        });
      return;
    }

    res.json({ success: true, data: enrollment });
  } catch (err) {
    console.error("getEnrollmentCurriculum error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch curriculum" });
  }
}
