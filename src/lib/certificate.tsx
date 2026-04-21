import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

interface CertificateData {
  userName: string;
  domainTitle: string;
  durationMonths: number;
  issueDate: Date;
  verificationHash: string;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    padding: 0,
    fontFamily: "Helvetica",
  },
  topStripe: {
    backgroundColor: "#FFC107",
    padding: "20 40",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "4 solid #0A0A0A",
  },
  brand: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0A0A0A",
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 8,
    color: "#0A0A0A",
    letterSpacing: 2,
  },
  body: {
    flex: 1,
    padding: "60 80",
    alignItems: "center",
    justifyContent: "center",
  },
  certifies: {
    fontSize: 10,
    letterSpacing: 4,
    color: "#999999",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  name: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#0A0A0A",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 10,
    color: "#666666",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  trackBadge: {
    backgroundColor: "#FFC107",
    border: "2 solid #0A0A0A",
    padding: "8 24",
    marginBottom: 8,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0A0A0A",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  duration: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 40,
    letterSpacing: 1,
  },
  divider: {
    borderTop: "1 solid #E0E0E0",
    width: "100%",
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  footerSection: {
    alignItems: "center",
  },
  footerLine: {
    borderTop: "2 solid #0A0A0A",
    width: 80,
    marginBottom: 4,
  },
  footerLabel: {
    fontSize: 8,
    color: "#999999",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  hashText: {
    fontSize: 8,
    color: "#BBBBBB",
    marginBottom: 2,
  },
  bottomStripe: {
    backgroundColor: "#0A0A0A",
    padding: "12 40",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomLeft: {
    fontSize: 8,
    color: "#FFC107",
    letterSpacing: 2,
  },
  bottomRight: {
    fontSize: 8,
    color: "#666666",
    letterSpacing: 1,
  },
});

function CertificateDocument({
  userName,
  domainTitle,
  durationMonths,
  issueDate,
  verificationHash,
}: CertificateData) {
  const formattedDate = issueDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Top stripe */}
        <View style={styles.topStripe}>
          <Text style={styles.brand}>DEVIT</Text>
          <Text style={styles.tagline}>BUILD REAL. GROW FAST.</Text>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.certifies}>This certifies that</Text>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.subtitle}>has successfully completed the</Text>
          <View style={styles.trackBadge}>
            <Text style={styles.trackTitle}>{domainTitle} Internship</Text>
          </View>
          <Text style={styles.duration}>
            {durationMonths}-Month{" "}
            {durationMonths >= 3 ? "Intensive" : "Essential"} Program
          </Text>
          <View style={styles.divider} />
          <View style={styles.footer}>
            <View style={styles.footerSection}>
              <View style={styles.footerLine} />
              <Text style={styles.footerLabel}>Director, DevIt</Text>
            </View>
            <View style={styles.footerSection}>
              <Text style={styles.hashText}>
                {verificationHash.slice(0, 20).toUpperCase()}
              </Text>
              <Text style={styles.hashText}>Issued: {formattedDate}</Text>
            </View>
            <View style={styles.footerSection}>
              <View style={styles.footerLine} />
              <Text style={styles.footerLabel}>Issued by DevIt</Text>
            </View>
          </View>
        </View>

        {/* Bottom stripe */}
        <View style={styles.bottomStripe}>
          <Text style={styles.bottomLeft}>devit.com</Text>
          <Text style={styles.bottomRight}>
            Verify: devit.com/certificate/{verificationHash}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateCertificatePdf(
  data: CertificateData
): Promise<Buffer> {
  const element = <CertificateDocument {...data} />;
  // @react-pdf/renderer v4 — renderToBuffer is a named export, not on default
  return renderToBuffer(element) as Promise<Buffer>;
}