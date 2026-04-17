import crypto from "crypto";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth-middleware.js";
import { prisma } from "../lib/prisma.js";
import { razorpay } from "../lib/razorpay.js";
import { generateInvoicePdf } from "../lib/invoice.js";
import { getPresignedDownloadUrl, uploadBuffer } from "../lib/storage.js";
import { env } from "../config/env.js";

// POST /api/payments/order
export async function createOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const { domainId, durationMonths } = req.body;
    const userId = req.user!.id;

    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain) {
      res.status(404).json({ success: false, message: "Domain not found" });
      return;
    }
    if (!domain.published) {
      res.status(400).json({ success: false, message: "Domain not published" });
      return;
    }

    // Check not already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: { userId_domainId: { userId, domainId } },
    });
    if (existing) {
      res.status(409).json({ success: false, message: "Already enrolled" });
      return;
    }

    const priceINR = domain.isFree ? 0 : Number(domain.priceINR ?? 0);
    const amountPaise = Math.round(priceINR * 100); // Razorpay uses paise

    // Create Razorpay order
    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `devit_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { userId, domainId, durationMonths: String(durationMonths) },
    });

    // Create pending enrollment + payment record
    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        domainId,
        durationMonths,
        paymentStatus: domain.isFree ? "PAID" : "PENDING",
        startDate: new Date(),
        endDate: new Date(
          Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000,
        ),
      },
    });

    res.json({
      success: true,
      data: {
        orderId: rzpOrder.id,
        amount: amountPaise,
        currency: "INR",
        enrollmentId: enrollment.id,
        keyId: env.razorpayKeyId,
      },
    });
  } catch (err) {
    console.error("createOrder error:", err);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
}

// POST /api/payments/verify
export async function verifyPayment(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      enrollmentId,
    } = req.body;

    // 1. Verify Razorpay signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = crypto
      .createHmac("sha256", env.razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
      return;
    }

    // 2. Get enrollment with domain and user
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        user: true,
        domain: true,
      },
    });

    if (!enrollment) {
      res.status(404).json({ success: false, message: "Enrollment not found" });
      return;
    }

    // 3. Generate invoice number
    const invoiceCount = await prisma.invoice.count();
    const invoiceNo = `DEVIT-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, "0")}`;

    const priceINR = Number(enrollment.domain.priceINR ?? 0);
    const gstPercent = 18;
    const gstAmount = parseFloat(((priceINR * gstPercent) / 100).toFixed(2));
    const total = priceINR + gstAmount;

    // 4. Generate PDF
    const pdfBuffer = await generateInvoicePdf({
      invoiceNo,
      issuedAt: new Date(),
      buyerName: enrollment.user.name ?? "Learner",
      buyerEmail: enrollment.user.email,
      courseTitle: enrollment.domain.title,
      durationMonths: enrollment.durationMonths,
      amountINR: priceINR,
      gst: gstPercent,
    });

    // 5. Upload PDF to R2
    const pdfKey = `invoices/${invoiceNo}.pdf`;
    const pdfUrl = await uploadBuffer(pdfKey, pdfBuffer, "application/pdf");

    // 6. Update DB in transaction
    await prisma.$transaction([
      prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { paymentStatus: "PAID" },
      }),
      prisma.invoice.create({
        data: {
          invoiceNo,
          enrollmentId,
          buyerName: enrollment.user.name ?? "Learner",
          buyerEmail: enrollment.user.email,
          courseTitle: enrollment.domain.title,
          amountINR: priceINR,
          gstPercent,
          gstAmount,
          total,
          pdfUrl,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
        },
      }),
    ]);

    res.json({ success: true, data: { invoiceNo, pdfUrl } });
  } catch (err: any) {
    if (err.code === "P2002") {
      res
        .status(409)
        .json({ success: false, message: "Payment already verified" });
      return;
    }
    throw err;
  }
}

// POST /api/payments/webhook (Razorpay webhook for failed/refunded)
export async function handleWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const body = JSON.stringify(req.body);

    const expectedSig = crypto
      .createHmac("sha256", env.razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSig !== signature) {
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    const event = req.body as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            notes?: {
              userId?: string;
              domainId?: string;
            };
          };
        };
      };
    };

    if (event.event === "payment.failed") {
      const notes = event.payload?.payment?.entity?.notes;
      if (!notes?.userId || !notes.domainId) {
        res
          .status(400)
          .json({ error: "Missing payment notes in webhook payload" });
        return;
      }

      await prisma.enrollment.updateMany({
        where: {
          userId: notes.userId,
          domainId: notes.domainId,
          paymentStatus: "PENDING",
        },
        data: { paymentStatus: "FAILED" },
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error("webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

export async function getInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    const enrollmentId = req.params["enrollmentId"] as string; // fix 1 — cast to string

    const invoice = await prisma.invoice.findUnique({
      where: { enrollmentId },
      include: { enrollment: true }, // fix 2 — need to include enrollment
    });

    if (!invoice) {
      res.status(404).json({ success: false, message: "Invoice not found" });
      return;
    }

    if (
      invoice.enrollment.userId !== req.user!.id &&
      req.user!.role !== "ADMIN"
    ) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const key = `invoices/${invoice.invoiceNo}.pdf`;
    const url = await getPresignedDownloadUrl(key, 3600);

    res.json({ success: true, data: { url } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to get invoice" });
  }
}
