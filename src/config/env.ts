import dotenv from "dotenv";
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  databaseUrl: process.env.DATABASE_URL!,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  dashboardUrl: process.env.DASHBOARD_URL || "http://localhost:3000",
};

if (!env.databaseUrl) throw new Error("DATABASE_URL is required");