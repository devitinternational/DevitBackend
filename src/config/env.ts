import dotenv from "dotenv";
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  databaseUrl: process.env.DATABASE_URL!,
  learningPlatformUrl: process.env.LEARNING_PLATFORM_URL || "http://localhost:3001",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  dashboardUrl: process.env.DASHBOARD_URL || "http://localhost:3000",
  mailHost: process.env.MAIL_HOST || "",
  mailPort: parseInt(process.env.MAIL_PORT || "587", 10),
  mailSecure: process.env.MAIL_SECURE === "true",
  mailUser: process.env.MAIL_USER || "",
  mailPass: process.env.MAIL_PASS || "",
  mailFromEmail: process.env.MAIL_FROM_EMAIL || "",
  mailFromName: process.env.MAIL_FROM_NAME || "DevIt",
  supportEmail: process.env.SUPPORT_EMAIL || process.env.MAIL_FROM_EMAIL || "tech@devitinternational.com",
  authSecret: process.env.AUTH_SECRET!,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID!,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET!,
  r2BucketName: process.env.R2_BUCKET_NAME!,
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID!,
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  r2Endpoint: process.env.R2_ENDPOINT!,
  r2PublicUrl: process.env.R2_PUBLIC_URL!,
};

if (!env.databaseUrl) throw new Error("DATABASE_URL is required");
if (!env.authSecret) throw new Error("AUTH_SECRET is required");
if (!env.razorpayKeyId) throw new Error("RAZORPAY_KEY_ID is required");
if (!env.razorpayKeySecret) throw new Error("RAZORPAY_KEY_SECRET is required");
if (!env.r2Endpoint) throw new Error("R2_ENDPOINT is required");
if (!env.r2BucketName) throw new Error("R2_BUCKET_NAME is required");
if (!env.r2AccessKeyId) throw new Error("R2_ACCESS_KEY_ID is required");
if (!env.r2SecretAccessKey) throw new Error("R2_SECRET_ACCESS_KEY is required");
if (!env.r2PublicUrl) throw new Error("R2_PUBLIC_URL is required");
