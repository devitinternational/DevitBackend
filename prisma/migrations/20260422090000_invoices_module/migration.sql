CREATE TYPE "InvoiceType" AS ENUM ('STUDENT', 'PROJECT');

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'FAILED');

ALTER TABLE "invoices"
  ALTER COLUMN "enrollmentId" DROP NOT NULL,
  ADD COLUMN "type" "InvoiceType" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "status" "InvoiceStatus" NOT NULL DEFAULT 'PAID',
  ADD COLUMN "projectName" TEXT,
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "emailTemplate" TEXT,
  ADD COLUMN "emailSubject" TEXT,
  ADD COLUMN "recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(10,2) NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceItem_invoiceId_sortOrder_idx" ON "InvoiceItem"("invoiceId", "sortOrder");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
