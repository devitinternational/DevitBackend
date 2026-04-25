import { env } from "../config/env.js";
import { sendMail } from "./mailer.js";
import {
  buildInvoiceEmailVariables,
  renderInvoiceTemplate,
  sanitizeInvoiceTemplate,
} from "./invoice-helpers.js";

interface SendInvoiceEmailInput {
  customerName: string;
  recipients: string[];
  invoiceNo: string;
  itemLabel: string;
  total: number;
  issuedAt: Date;
  subject?: string | null;
  template?: string | null;
  pdfBuffer: Buffer;
}

export function buildInvoiceEmailPreview(input: Omit<SendInvoiceEmailInput, "recipients" | "pdfBuffer">) {
  const template = sanitizeInvoiceTemplate(input.template);
  const variables = buildInvoiceEmailVariables({
    buyerName: input.customerName,
    total: input.total,
    invoiceNo: input.invoiceNo,
    issuedAt: input.issuedAt,
    itemLabel: input.itemLabel,
  });

  return {
    subject: input.subject?.trim() || `Invoice ${input.invoiceNo} from DevIt`,
    text: renderInvoiceTemplate(template, variables),
  };
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput) {
  const preview = buildInvoiceEmailPreview(input);
  const html = preview.text
    .split("\n")
    .map((line) => {
      if (!line.trim()) {
        return "<div style=\"height:12px\"></div>";
      }
      return `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">${escapeHtml(line)}</p>`;
    })
    .join("");

  await sendMail({
    to: input.recipients.join(", "),
    subject: preview.subject,
    text: preview.text,
    html: `
      <div style="margin:0;padding:32px;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6dfc7;border-radius:20px;overflow:hidden;">
          <div style="padding:24px 28px;background:#ffc107;">
            <div style="font-size:26px;font-weight:700;letter-spacing:-0.02em;">DevIt</div>
            <div style="font-size:13px;color:#3a3320;margin-top:4px;">Invoice delivery</div>
          </div>
          <div style="padding:28px;">
            ${html}
            <p style="margin:16px 0 0;font-size:15px;line-height:1.7;">
              If you have any questions, reply to this email or contact
              <a href="mailto:${env.supportEmail}" style="color:#0a0a0a;font-weight:700;"> ${env.supportEmail}</a>.
            </p>
          </div>
          <div style="padding:20px 28px;border-top:1px solid #ece7d4;background:#ffffff;color:#6a6a64;font-size:13px;line-height:1.6;">
            Team DevIt
          </div>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `${input.invoiceNo}.pdf`,
        content: input.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

function escapeHtml(value: string) {
  return value
    .split("&")
    .join("&amp;")
    .split("<")
    .join("&lt;")
    .split(">")
    .join("&gt;");
}
