import React from "react";
import {
  Document,
  type DocumentProps,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#f5f5f0",
  },
  header: {
    backgroundColor: "#ffc107",
    borderRadius: 18,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 28,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: { fontSize: 24, fontWeight: "bold", color: "#0a0a0a" },
  brandSub: { fontSize: 10, color: "#4a4a44", marginTop: 4 },
  invoiceEyebrow: {
    fontSize: 9,
    color: "#4a4a44",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  invoiceTitle: { fontSize: 28, color: "#0a0a0a", fontWeight: "bold" },
  invoiceSubtitle: { fontSize: 10, color: "#3a3320", marginTop: 6, textAlign: "right" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    marginBottom: 18,
  },
  twoColumn: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  column: {
    width: "48%",
  },
  label: {
    fontSize: 8,
    color: "#6a6a64",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: { fontSize: 11, color: "#0a0a0a", marginBottom: 10 },
  companyName: { fontSize: 14, color: "#0a0a0a", fontWeight: "bold", marginBottom: 4 },
  muted: { fontSize: 10, color: "#6a6a64", lineHeight: 1.5 },
  statusPill: {
    backgroundColor: "#fff4cc",
    color: "#0a0a0a",
    fontSize: 9,
    textTransform: "uppercase",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    color: "#0a0a0a",
    fontWeight: "bold",
    marginBottom: 14,
    textTransform: "uppercase",
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff9e6",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  tableHeaderText: { fontSize: 9, color: "#6a6a64", textTransform: "uppercase" },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottom: "1px solid #ece7d4",
  },
  tableCell: { fontSize: 11, color: "#0a0a0a" },
  tableCellWide: { width: "52%" },
  tableCellMid: { width: "24%", textAlign: "center" },
  tableCellEnd: { width: "24%", textAlign: "right" },
  totalsWrap: {
    marginTop: 18,
    alignItems: "flex-end",
  },
  totalsCard: {
    width: 240,
    backgroundColor: "#fff9e6",
    borderRadius: 14,
    padding: 16,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  rowLabel: { fontSize: 10, color: "#6a6a64" },
  rowValue: { fontSize: 10, color: "#0a0a0a" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#0a0a0a",
    borderRadius: 10,
  },
  totalText: { fontSize: 12, color: "#ffffff", fontWeight: "bold" },
  noteBox: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
  },
  noteText: { fontSize: 10, color: "#4a4a44", lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40 },
  footerText: { fontSize: 8, color: "#6a6a64", textAlign: "center" },
});

export interface InvoiceData {
  invoiceNo: string;
  issuedAt: Date;
  buyerName: string;
  buyerEmail: string;
  courseTitle: string;
  durationMonths: number;
  amountINR: number;
  gst: number;
  paymentId?: string;
  orderId?: string;
  supportEmail?: string;
}

function InvoiceDocument({
  data,
}: {
  data: InvoiceData;
}): React.ReactElement<DocumentProps> {
  const subtotal = data.amountINR;
  const gstAmount = parseFloat(((subtotal * data.gst) / 100).toFixed(2));
  const total = subtotal + gstAmount;
  const supportEmail = data.supportEmail ?? "hello@devit.in";

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerRow },
          React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.brand }, "DevIt"),
            React.createElement(
              Text,
              { style: styles.brandSub },
              `devit.in · ${supportEmail}`,
            ),
          ),
          React.createElement(
            View,
            { style: { alignItems: "flex-end" } },
            React.createElement(Text, { style: styles.invoiceEyebrow }, "Payment Invoice"),
            React.createElement(Text, { style: styles.invoiceTitle }, "INVOICE"),
            React.createElement(
              Text,
              { style: styles.invoiceSubtitle },
              "Official payment receipt for your DevIt enrollment",
            ),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.card },
        React.createElement(
          View,
          { style: styles.twoColumn },
          React.createElement(
            View,
            { style: styles.column },
            React.createElement(Text, { style: styles.sectionTitle }, "Invoice Summary"),
            React.createElement(Text, { style: styles.label }, "Invoice Number"),
            React.createElement(Text, { style: styles.value }, data.invoiceNo),
            React.createElement(Text, { style: styles.label }, "Issued On"),
            React.createElement(
              Text,
              { style: styles.value },
              data.issuedAt.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
            ),
            data.paymentId
              ? React.createElement(Text, { style: styles.label }, "Payment Reference")
              : null,
            data.paymentId
              ? React.createElement(Text, { style: styles.value }, data.paymentId)
              : null,
            React.createElement(Text, { style: styles.statusPill }, "Payment Confirmed"),
          ),
          React.createElement(
            View,
            { style: styles.column },
            React.createElement(Text, { style: styles.sectionTitle }, "Billed To"),
            React.createElement(Text, { style: styles.companyName }, data.buyerName),
            React.createElement(Text, { style: styles.muted }, data.buyerEmail),
            React.createElement(
              Text,
              { style: { ...styles.sectionTitle, marginTop: 16 } },
              "Issued By",
            ),
            React.createElement(Text, { style: styles.companyName }, "DevIt"),
            React.createElement(
              Text,
              { style: styles.muted },
              `Learning platform access and payment support\n${supportEmail}\ndevit.in`,
            ),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.card },
        React.createElement(Text, { style: styles.sectionTitle }, "Enrollment Details"),
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(
            Text,
            { style: [styles.tableHeaderText, styles.tableCellWide] },
            "Description",
          ),
          React.createElement(
            Text,
            { style: [styles.tableHeaderText, styles.tableCellMid] },
            "Duration",
          ),
          React.createElement(
            Text,
            { style: [styles.tableHeaderText, styles.tableCellEnd] },
            "Amount",
          ),
        ),
        React.createElement(
          View,
          { style: styles.tableRow },
          React.createElement(
            Text,
            { style: [styles.tableCell, styles.tableCellWide] },
            data.courseTitle,
          ),
          React.createElement(
            Text,
            { style: [styles.tableCell, styles.tableCellMid] },
            `${data.durationMonths} month${data.durationMonths > 1 ? "s" : ""}`,
          ),
          React.createElement(
            Text,
            { style: [styles.tableCell, styles.tableCellEnd] },
            `Rs. ${subtotal.toFixed(2)}`,
          ),
        ),
        React.createElement(
          View,
          { style: styles.totalsWrap },
          React.createElement(
            View,
            { style: styles.totalsCard },
            React.createElement(
              View,
              { style: styles.row },
              React.createElement(Text, { style: styles.rowLabel }, "Subtotal"),
              React.createElement(Text, { style: styles.rowValue }, `Rs. ${subtotal.toFixed(2)}`),
            ),
            React.createElement(
              View,
              { style: styles.row },
              React.createElement(Text, { style: styles.rowLabel }, `GST (${data.gst}%)`),
              React.createElement(Text, { style: styles.rowValue }, `Rs. ${gstAmount.toFixed(2)}`),
            ),
            data.orderId
              ? React.createElement(
                  View,
                  { style: styles.row },
                  React.createElement(Text, { style: styles.rowLabel }, "Order Reference"),
                  React.createElement(Text, { style: styles.rowValue }, data.orderId),
                )
              : null,
            React.createElement(
              View,
              { style: styles.totalRow },
              React.createElement(Text, { style: styles.totalText }, "Total Paid"),
              React.createElement(Text, { style: styles.totalText }, `Rs. ${total.toFixed(2)}`),
            ),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.noteBox },
        React.createElement(
          Text,
          { style: styles.noteText },
          `This document confirms successful payment for your DevIt enrollment. Keep it for your records. For billing or access support, contact ${supportEmail}.`,
        ),
      ),
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          { style: styles.footerText },
          "This is a computer-generated invoice issued by DevIt.",
        ),
      ),
    ),
  );
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(InvoiceDocument({ data }));
}
