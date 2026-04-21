import { env } from "../config/env.js";
import { sendMail } from "./mailer.js";

interface SendInvoiceEmailInput {
  customerName: string;
  customerEmail: string;
  courseName: string;
  courseLink: string;
  amount: number;
  paymentId: string;
  invoiceNo: string;
  invoiceUrl: string;
  pdfBuffer: Buffer;
}

function formatCurrency(amount: number) {
  return `Rs. ${amount.toFixed(2)}`;
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput) {
  const {
    customerName,
    customerEmail,
    courseName,
    courseLink,
    amount,
    paymentId,
    invoiceNo,
    invoiceUrl,
    pdfBuffer,
  } = input;

  const safeName = customerName.trim() || "Learner";
  const formattedAmount = formatCurrency(amount);

  const text = [
    `Hi ${safeName},`,
    "",
    `Welcome to DevIt. Your enrollment in ${courseName} has been confirmed successfully.`,
    "",
    "You can access your course here:",
    courseLink,
    "",
    "Invoice details",
    `Amount paid: ${formattedAmount}`,
    `Payment ID: ${paymentId}`,
    `Invoice link: ${invoiceUrl}`,
    "",
    "Your invoice is attached to this email.",
    "",
    `If you have any questions, reply to this email or contact ${env.supportEmail}.`,
    "",
    "See you inside the course.",
    "Team DevIt",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:32px;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6dfc7;border-radius:20px;overflow:hidden;">
        <div style="padding:24px 28px;background:#ffc107;">
          <div style="font-size:26px;font-weight:700;letter-spacing:-0.02em;">DevIt</div>
          <div style="font-size:13px;color:#3a3320;margin-top:4px;">Enrollment confirmation and invoice</div>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${safeName},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
            Welcome to DevIt. Your enrollment in <strong>${courseName}</strong> has been confirmed successfully.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
            You can access your course here:<br />
            <a href="${courseLink}" style="color:#0a0a0a;font-weight:700;">${courseLink}</a>
          </p>

          <div style="background:#fff9e6;border:1px solid #f0d97a;border-radius:16px;padding:20px;margin-bottom:24px;">
            <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6a6a64;margin-bottom:12px;">
              Invoice Details
            </div>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>Amount paid:</strong> ${formattedAmount}</p>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>Payment ID:</strong> ${paymentId}</p>
            <p style="margin:0;font-size:15px;line-height:1.6;">
              <strong>Invoice link:</strong>
              <a href="${invoiceUrl}" style="color:#0a0a0a;font-weight:700;">View invoice</a>
            </p>
          </div>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
            Your invoice is attached to this email for easy reference.
          </p>
          <p style="margin:0;font-size:15px;line-height:1.7;">
            If you have any questions, reply to this email or contact
            <a href="mailto:${env.supportEmail}" style="color:#0a0a0a;font-weight:700;"> ${env.supportEmail}</a>.
          </p>
        </div>
        <div style="padding:20px 28px;border-top:1px solid #ece7d4;background:#ffffff;color:#6a6a64;font-size:13px;line-height:1.6;">
          See you inside the course.<br />Team DevIt
        </div>
      </div>
    </div>
  `;

  await sendMail({
    to: customerEmail,
    subject: `Enrollment confirmed for ${courseName}`,
    text,
    html,
    attachments: [
      {
        filename: `${invoiceNo}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
