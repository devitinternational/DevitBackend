import { Prisma } from "../../prisma/generated/prisma";

export const DEFAULT_INVOICE_EMAIL_TEMPLATE = [
  "Hello {{name}},",
  "",
  "Your invoice for {{item}} is attached.",
  "",
  "Amount: Rs. {{amount}}",
  "Invoice ID: {{invoice_id}}",
  "Date: {{date}}",
  "",
  "Thanks,",
  "DevIt",
].join("\n");

export interface InvoiceLineInput {
  name: string;
  description?: string | null;
  quantity: number;
  price: number;
}

export interface InvoiceTemplateVariables {
  name: string;
  amount: string;
  invoice_id: string;
  date: string;
  item: string;
}

export function sanitizeInvoiceTemplate(template?: string | null) {
  const value = template?.trim();
  return value || DEFAULT_INVOICE_EMAIL_TEMPLATE;
}

export function renderInvoiceTemplate(
  template: string,
  variables: InvoiceTemplateVariables,
) {
  return template.replace(/\{\{(name|amount|invoice_id|date|item)\}\}/g, (_m, key) => {
    const typedKey = key as keyof InvoiceTemplateVariables;
    return variables[typedKey] ?? "";
  });
}

export function formatCurrency(amount: number) {
  return amount.toFixed(2);
}

export function buildInvoiceEmailVariables(input: {
  buyerName: string;
  total: number;
  invoiceNo: string;
  issuedAt: Date;
  itemLabel: string;
}): InvoiceTemplateVariables {
  return {
    name: input.buyerName.trim() || "Customer",
    amount: formatCurrency(input.total),
    invoice_id: input.invoiceNo,
    date: input.issuedAt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    item: input.itemLabel,
  };
}

export function calculateInvoiceTotals(items: InvoiceLineInput[]) {
  const subtotal = items.reduce((sum, item) => {
    return sum + item.quantity * item.price;
  }, 0);

  return {
    subtotal: roundCurrency(subtotal),
    gstAmount: 0,
    gstPercent: 0,
    total: roundCurrency(subtotal),
  };
}

export function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function toDecimal(value: number) {
  return new Prisma.Decimal(roundCurrency(value));
}

export function normalizeEmails(emails: string[]) {
  const unique = new Set(
    emails
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  return [...unique];
}

export function buildStudentInvoiceItems(input: {
  courseName: string;
  amount: number;
  durationMonths?: number | null;
}) {
  const suffix =
    input.durationMonths && input.durationMonths > 0
      ? ` (${input.durationMonths} month${input.durationMonths > 1 ? "s" : ""})`
      : "";

  return [
    {
      name: input.courseName,
      description: `Course enrollment${suffix}`.trim(),
      quantity: 1,
      price: roundCurrency(input.amount),
    },
  ] satisfies InvoiceLineInput[];
}

export function getInvoiceItemLabel(input: {
  courseTitle: string;
  projectName?: string | null;
}) {
  return input.projectName?.trim() || input.courseTitle.trim() || "DevIt services";
}

export function nextInvoiceNumber(year: number, count: number) {
  return `DEVIT-${year}-${String(count + 1).padStart(5, "0")}`;
}
