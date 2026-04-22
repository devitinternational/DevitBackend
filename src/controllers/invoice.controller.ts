import {
  InvoiceStatus,
  InvoiceType,
  Prisma,
  type Invoice,
  type InvoiceItem,
} from "../../prisma/generated/prisma";
import { Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";
import {
  DEFAULT_INVOICE_EMAIL_TEMPLATE,
  buildStudentInvoiceItems,
  calculateInvoiceTotals,
  getInvoiceItemLabel,
  nextInvoiceNumber,
  normalizeEmails,
  sanitizeInvoiceTemplate,
  toDecimal,
} from "../lib/invoice-helpers.js";
import { prisma } from "../lib/prisma.js";
import { generateInvoicePdf } from "../lib/invoice.js";
import {
  buildInvoiceEmailPreview,
  sendInvoiceEmail,
} from "../lib/invoice-email.js";
import { isMailerConfigured } from "../lib/mailer.js";
import { uploadBuffer } from "../lib/storage.js";

const listInvoiceQuerySchema = z.object({
  search: z.string().trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  domain: z.string().trim().optional(),
  type: z.enum(["student", "project"]).optional(),
  status: z.enum(["draft", "sent", "failed", "paid"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z
    .enum(["createdAt", "invoiceNumber", "amount", "status", "name", "domain"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const itemSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().min(0),
});

const studentInvoiceSchema = z.object({
  enrollmentId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  courseName: z.string().trim().min(1),
  amount: z.coerce.number().min(0),
  invoiceDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  emailTemplate: z.string().optional(),
  subject: z.string().trim().optional(),
  recipients: z.array(z.string().email()).optional(),
  status: z.enum(["draft", "paid"]).optional(),
});

const projectInvoiceSchema = z.object({
  invoiceId: z.string().trim().optional(),
  clientName: z.string().trim().min(1),
  clientEmail: z.string().trim().email(),
  projectName: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  items: z.array(itemSchema).min(1),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  emailTemplate: z.string().optional(),
  subject: z.string().trim().optional(),
  recipients: z.array(z.string().email()).optional(),
  status: z.enum(["draft", "sent", "paid"]).optional(),
});

const sendInvoiceSchema = z.object({
  emails: z.array(z.string().email()).optional(),
  subject: z.string().trim().optional(),
  emailTemplate: z.string().optional(),
  mode: z.enum(["send", "test"]).default("send"),
});

const invoiceInclude = {
  items: { orderBy: { sortOrder: "asc" as const } },
  createdBy: { select: { id: true, name: true, email: true } },
  enrollment: {
    include: {
      user: { select: { id: true, name: true, email: true } },
      domain: { select: { id: true, title: true, slug: true } },
    },
  },
} satisfies Prisma.InvoiceInclude;

export async function listInvoices(req: AuthenticatedRequest, res: Response) {
  const parsed = listInvoiceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid query parameters" });
    return;
  }

  const query = parsed.data;
  const where: Prisma.InvoiceWhereInput = {};
  const and: Prisma.InvoiceWhereInput[] = [];

  if (query.search) {
    and.push({
      OR: [
        { invoiceNo: { contains: query.search, mode: "insensitive" } },
        { buyerName: { contains: query.search, mode: "insensitive" } },
        { buyerEmail: { contains: query.search, mode: "insensitive" } },
        { courseTitle: { contains: query.search, mode: "insensitive" } },
        { projectName: { contains: query.search, mode: "insensitive" } },
        { domain: { contains: query.search, mode: "insensitive" } },
        {
          items: {
            some: {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  if (query.startDate || query.endDate) {
    const issuedAt: Prisma.DateTimeFilter = {};
    if (query.startDate) issuedAt.gte = new Date(query.startDate);
    if (query.endDate) issuedAt.lte = new Date(query.endDate);
    and.push({ issuedAt });
  }

  if (query.domain) {
    and.push({ domain: { contains: query.domain, mode: "insensitive" } });
  }

  if (query.type) {
    and.push({ type: query.type === "student" ? InvoiceType.STUDENT : InvoiceType.PROJECT });
  }

  if (query.status) {
    and.push({ status: query.status.toUpperCase() as InvoiceStatus });
  }

  if (and.length > 0) where.AND = and;

  const orderBy = buildOrderBy(query.sortBy, query.sortOrder);
  const skip = (query.page - 1) * query.limit;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { items: true },
      orderBy,
      skip,
      take: query.limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  res.json({
    data: invoices.map((invoice) => mapInvoiceListItem(invoice)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
    },
  });
}

export async function getInvoiceMeta(req: AuthenticatedRequest, res: Response) {
  const studentSearch = String(req.query["studentSearch"] ?? "").trim();

  const [domains, enrollments] = await Promise.all([
    prisma.domain.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
      },
      where: { published: true },
      orderBy: { title: "asc" },
    }),
    prisma.enrollment.findMany({
      where: {
        paymentStatus: "PAID",
        OR: studentSearch
          ? [
              { user: { name: { contains: studentSearch, mode: "insensitive" } } },
              { user: { email: { contains: studentSearch, mode: "insensitive" } } },
              { domain: { title: { contains: studentSearch, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        domain: { select: { id: true, title: true, slug: true, priceINR: true } },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            invoiceNo: true,
            status: true,
            sentAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  res.json({
    success: true,
    data: {
      domains,
      studentSources: enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        name: enrollment.user.name ?? "Learner",
        email: enrollment.user.email,
        courseName: enrollment.domain.title,
        domain: enrollment.domain.title,
        amount: Number(enrollment.domain.priceINR ?? 0),
        durationMonths: enrollment.durationMonths,
        paymentRef: enrollment.paymentRef,
        existingInvoice: enrollment.invoices[0]
          ? {
              id: enrollment.invoices[0].id,
              invoiceNumber: enrollment.invoices[0].invoiceNo,
              status: toApiStatus(enrollment.invoices[0].status),
              sentAt: enrollment.invoices[0].sentAt,
            }
          : null,
      })),
      placeholders: ["{{name}}", "{{amount}}", "{{invoice_id}}", "{{date}}", "{{item}}"],
      defaultEmailTemplate: DEFAULT_INVOICE_EMAIL_TEMPLATE,
    },
  });
}

export async function createStudentInvoice(req: AuthenticatedRequest, res: Response) {
  const parsed = studentInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid student invoice payload" });
    return;
  }

  const body = parsed.data;
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: body.enrollmentId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      domain: { select: { title: true } },
    },
  });

  if (!enrollment || enrollment.paymentStatus !== "PAID") {
    res.status(404).json({ success: false, message: "Paid enrollment not found" });
    return;
  }

  const existingInvoice = await prisma.invoice.findUnique({
    where: { enrollmentId: body.enrollmentId },
  });
  const issuedAt = body.invoiceDate ?? new Date();
  const items = buildStudentInvoiceItems({
    courseName: body.courseName,
    amount: body.amount,
    durationMonths: enrollment.durationMonths,
  });
  const totals = calculateInvoiceTotals(items);
  const recipients = normalizeEmails(body.recipients?.length ? body.recipients : [body.email]);
  const emailTemplate = sanitizeInvoiceTemplate(body.emailTemplate);
  const status = body.status === "draft" ? InvoiceStatus.DRAFT : InvoiceStatus.PAID;
  const invoiceNo =
    existingInvoice?.invoiceNo ??
    nextInvoiceNumber(new Date().getFullYear(), await prisma.invoice.count());

  const payload = {
    type: InvoiceType.STUDENT,
    status,
    buyerName: body.name,
    buyerEmail: body.email,
    courseTitle: body.courseName,
    projectName: null,
    domain: enrollment.domain.title,
    notes: body.notes || null,
    emailTemplate,
    emailSubject: body.subject || null,
    recipients,
    amountINR: toDecimal(totals.subtotal),
    gstPercent: 0,
    gstAmount: toDecimal(totals.gstAmount),
    total: toDecimal(totals.total),
    dueDate: null,
    issuedAt,
    sentAt: existingInvoice?.sentAt ?? null,
    paidAt: status === InvoiceStatus.PAID ? issuedAt : existingInvoice?.paidAt ?? null,
    failedAt: null,
    createdById: req.user!.id,
    pdfUrl: null,
    razorpayOrderId: existingInvoice?.razorpayOrderId ?? null,
    razorpayPaymentId: enrollment.paymentRef ?? existingInvoice?.razorpayPaymentId ?? null,
  };

  const invoice = existingInvoice
    ? await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          ...payload,
          items: {
            deleteMany: {},
            create: items.map((item, index) => ({
              name: item.name,
              description: item.description ?? null,
              quantity: toDecimal(item.quantity),
              price: toDecimal(item.price),
              sortOrder: index,
            })),
          },
        },
        include: invoiceInclude,
      })
    : await prisma.invoice.create({
        data: {
          ...payload,
          invoiceNo,
          enrollmentId: body.enrollmentId,
          items: {
            create: items.map((item, index) => ({
              name: item.name,
              description: item.description ?? null,
              quantity: toDecimal(item.quantity),
              price: toDecimal(item.price),
              sortOrder: index,
            })),
          },
        },
        include: invoiceInclude,
      });

  res.status(existingInvoice ? 200 : 201).json({
    success: true,
    data: mapInvoiceDetail(invoice),
  });
}

export async function createProjectInvoice(req: AuthenticatedRequest, res: Response) {
  const parsed = projectInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid project invoice payload" });
    return;
  }

  const body = parsed.data;
  const existingInvoice = body.invoiceId
    ? await prisma.invoice.findUnique({ where: { id: body.invoiceId } })
    : null;

  if (body.invoiceId && (!existingInvoice || existingInvoice.type !== InvoiceType.PROJECT)) {
    res.status(404).json({ success: false, message: "Project invoice not found" });
    return;
  }

  const totals = calculateInvoiceTotals(body.items);
  const recipients = normalizeEmails(
    body.recipients?.length ? body.recipients : [body.clientEmail],
  );
  const emailTemplate = sanitizeInvoiceTemplate(body.emailTemplate);
  const status = body.status ? (body.status.toUpperCase() as InvoiceStatus) : InvoiceStatus.DRAFT;
  const invoiceNo =
    existingInvoice?.invoiceNo ??
    nextInvoiceNumber(new Date().getFullYear(), await prisma.invoice.count());

  const payload = {
    type: InvoiceType.PROJECT,
    status,
    buyerName: body.clientName,
    buyerEmail: body.clientEmail,
    courseTitle: body.projectName,
    projectName: body.projectName,
    domain: body.domain,
    notes: body.notes || null,
    emailTemplate,
    emailSubject: body.subject || null,
    recipients,
    amountINR: toDecimal(totals.subtotal),
    gstPercent: 0,
    gstAmount: toDecimal(0),
    total: toDecimal(totals.total),
    dueDate: body.dueDate ?? null,
    issuedAt: body.invoiceDate,
    sentAt:
      status === InvoiceStatus.SENT
        ? existingInvoice?.sentAt ?? new Date()
        : existingInvoice?.sentAt ?? null,
    paidAt:
      status === InvoiceStatus.PAID ? existingInvoice?.paidAt ?? new Date() : existingInvoice?.paidAt ?? null,
    failedAt: null,
    createdById: req.user!.id,
    pdfUrl: null,
  };

  const invoice = existingInvoice
    ? await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          ...payload,
          items: {
            deleteMany: {},
            create: body.items.map((item, index) => ({
              name: item.name,
              description: item.description ?? null,
              quantity: toDecimal(item.quantity),
              price: toDecimal(item.price),
              sortOrder: index,
            })),
          },
        },
        include: invoiceInclude,
      })
    : await prisma.invoice.create({
        data: {
          ...payload,
          invoiceNo,
          items: {
            create: body.items.map((item, index) => ({
              name: item.name,
              description: item.description ?? null,
              quantity: toDecimal(item.quantity),
              price: toDecimal(item.price),
              sortOrder: index,
            })),
          },
        },
        include: invoiceInclude,
      });

  res.status(existingInvoice ? 200 : 201).json({
    success: true,
    data: mapInvoiceDetail(invoice),
  });
}

export async function getInvoiceById(req: AuthenticatedRequest, res: Response) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params["id"] as string },
    include: invoiceInclude,
  });

  if (!invoice) {
    res.status(404).json({ success: false, message: "Invoice not found" });
    return;
  }

  res.json({ success: true, data: mapInvoiceDetail(invoice) });
}

export async function sendInvoice(req: AuthenticatedRequest, res: Response) {
  const parsed = sendInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid send payload" });
    return;
  }

  if (!isMailerConfigured()) {
    res.status(400).json({ success: false, message: "Mailer is not configured" });
    return;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params["id"] as string },
    include: invoiceInclude,
  });

  if (!invoice) {
    res.status(404).json({ success: false, message: "Invoice not found" });
    return;
  }

  const body = parsed.data;
  const recipients = normalizeEmails(body.emails?.length ? body.emails : invoice.recipients);
  if (!recipients.length) {
    res.status(400).json({ success: false, message: "At least one recipient email is required" });
    return;
  }

  const emailTemplate = sanitizeInvoiceTemplate(body.emailTemplate ?? invoice.emailTemplate);
  const subject = body.subject?.trim() || invoice.emailSubject || undefined;
  const itemLabel = getInvoiceItemLabel({
    courseTitle: invoice.courseTitle,
    projectName: invoice.projectName,
  });
  const { pdfBuffer, pdfUrl } = await generateAndPersistInvoicePdf(invoice);

  try {
    await sendInvoiceEmail({
      customerName: invoice.buyerName,
      recipients,
      invoiceNo: invoice.invoiceNo,
      itemLabel,
      total: Number(invoice.total),
      issuedAt: invoice.issuedAt,
      subject,
      template: emailTemplate,
      pdfBuffer,
    });

    const nextStatus =
      body.mode === "test"
        ? invoice.status
        : invoice.status === InvoiceStatus.PAID
          ? InvoiceStatus.PAID
          : InvoiceStatus.SENT;

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfUrl,
        recipients,
        emailTemplate,
        emailSubject: subject ?? null,
        failedAt: null,
        sentAt: body.mode === "test" ? invoice.sentAt : new Date(),
        status: nextStatus,
      },
      include: invoiceInclude,
    });

    res.json({
      success: true,
      data: {
        mode: body.mode,
        preview: buildInvoiceEmailPreview({
          customerName: invoice.buyerName,
          invoiceNo: invoice.invoiceNo,
          itemLabel,
          total: Number(invoice.total),
          issuedAt: invoice.issuedAt,
          subject,
          template: emailTemplate,
        }),
        invoice: mapInvoiceDetail(updatedInvoice),
      },
    });
  } catch (error) {
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfUrl,
        recipients,
        emailTemplate,
        emailSubject: subject ?? null,
        failedAt: new Date(),
        status: body.mode === "test" ? invoice.status : InvoiceStatus.FAILED,
      },
      include: invoiceInclude,
    });

    console.error("sendInvoice error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send invoice email",
      data: mapInvoiceDetail(updatedInvoice),
    });
  }
}

export async function getInvoicePdf(req: AuthenticatedRequest, res: Response) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params["id"] as string },
    include: invoiceInclude,
  });

  if (!invoice) {
    res.status(404).json({ success: false, message: "Invoice not found" });
    return;
  }

  const pdfAsset = invoice.pdfUrl
    ? { pdfUrl: invoice.pdfUrl }
    : await generateAndPersistInvoicePdf(invoice);

  if (!invoice.pdfUrl) {
    await prisma.invoice.update({
      where: { id: invoice.id },
        data: { pdfUrl: pdfAsset.pdfUrl },
      });
  }

  res.json({ success: true, data: { url: pdfAsset.pdfUrl } });
}

function buildOrderBy(sortBy: string, sortOrder: "asc" | "desc"): Prisma.InvoiceOrderByWithRelationInput {
  switch (sortBy) {
    case "invoiceNumber":
      return { invoiceNo: sortOrder };
    case "amount":
      return { total: sortOrder };
    case "status":
      return { status: sortOrder };
    case "name":
      return { buyerName: sortOrder };
    case "domain":
      return { domain: sortOrder };
    default:
      return { createdAt: sortOrder };
  }
}

function toApiStatus(status: InvoiceStatus) {
  return status.toLowerCase();
}

function toApiType(type: InvoiceType) {
  return type.toLowerCase();
}

function mapInvoiceListItem(invoice: Invoice & { items: InvoiceItem[] }) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNo,
    type: toApiType(invoice.type),
    name: invoice.buyerName,
    email: invoice.buyerEmail,
    amount: Number(invoice.total),
    status: toApiStatus(invoice.status),
    domain: invoice.domain,
    createdAt: invoice.createdAt.toISOString(),
    issuedAt: invoice.issuedAt.toISOString(),
    projectName: invoice.projectName,
    courseName: invoice.courseTitle,
  };
}

function mapInvoiceDetail(
  invoice: Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>,
) {
  const itemLabel = getInvoiceItemLabel({
    courseTitle: invoice.courseTitle,
    projectName: invoice.projectName,
  });

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNo,
    type: toApiType(invoice.type),
    status: toApiStatus(invoice.status),
    name: invoice.buyerName,
    email: invoice.buyerEmail,
    courseName: invoice.courseTitle,
    projectName: invoice.projectName,
    domain: invoice.domain,
    amount: Number(invoice.total),
    subtotal: Number(invoice.amountINR),
    gstPercent: invoice.gstPercent,
    gstAmount: Number(invoice.gstAmount),
    invoiceDate: invoice.issuedAt.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    notes: invoice.notes,
    emailTemplate: invoice.emailTemplate ?? DEFAULT_INVOICE_EMAIL_TEMPLATE,
    emailSubject: invoice.emailSubject,
    recipients: invoice.recipients,
    pdfUrl: invoice.pdfUrl,
    sentAt: invoice.sentAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    failedAt: invoice.failedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    createdBy: invoice.createdBy,
    enrollmentId: invoice.enrollmentId,
    itemLabel,
    items: invoice.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: Number(item.quantity),
      price: Number(item.price),
      total: Number(item.quantity) * Number(item.price),
    })),
  };
}

async function generateAndPersistInvoicePdf(
  invoice: Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>,
) {
  const pdfBuffer = await generateInvoicePdf({
    invoiceNo: invoice.invoiceNo,
    type: toApiType(invoice.type) as "student" | "project",
    status: toApiStatus(invoice.status) as "draft" | "sent" | "paid" | "failed",
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    buyerName: invoice.buyerName,
    buyerEmail: invoice.buyerEmail,
    courseTitle: invoice.courseTitle,
    projectName: invoice.projectName,
    domain: invoice.domain,
    subtotal: Number(invoice.amountINR),
    gstPercent: invoice.gstPercent,
    gstAmount: Number(invoice.gstAmount),
    total: Number(invoice.total),
    items: invoice.items.map((item) => ({
      name: item.name,
      description: item.description,
      quantity: Number(item.quantity),
      price: Number(item.price),
    })),
    notes: invoice.notes,
    paymentId: invoice.razorpayPaymentId,
    orderId: invoice.razorpayOrderId,
    supportEmail: env.supportEmail,
  });
  const pdfUrl = await uploadBuffer(
    `invoices/${invoice.invoiceNo}.pdf`,
    pdfBuffer,
    "application/pdf",
  );

  return { pdfBuffer, pdfUrl };
}
