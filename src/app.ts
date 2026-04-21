import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { error_handler } from "./middlewares/error-handler";
import expenseRoutes from "./routes/expense.routes";
import { getExchangeRates } from "./services/currency.service";
import incomeRoutes from "./routes/income.routes";
import financeRoutes from "./routes/finance.routes";
import domainRoutes from "./routes/domain.routes";
import sectionRoutes from "./routes/section.routes";
import taskRoutes from "./routes/task.routes";
import lessonRoutes from "./routes/lesson.routes";
import paymentRoutes from "./routes/payment.routes";
import publicRoutes from "./routes/public.routes";
import enrollmentRoutes from "./routes/enrollment.routes";
import submissionRoutes from "./routes/submission.routes";
import certificateRoutes from "./routes/certificate.routes";

export const createApp = (): Express => {
  const app = express();
  const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:3000",
    process.env.LEARNING_PLATFORM_URL || "http://localhost:3001",
  ];

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/currency/rates", async (_req, res) => {
    try {
      const rates = await getExchangeRates();
      res.json(rates);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch rates" });
    }
  });

  app.use(
    "/api/expenses",
    (req, _res, next) => {
      req.baseUrl = "";
      next();
    },
    expenseRoutes,
  );

  app.use("/api/incomes", incomeRoutes);
  app.use("/api/finance", financeRoutes);

  // ─── PUBLIC routes (no auth) — must be BEFORE authenticated domain router ───
  app.use("/api/domains/public", publicRoutes);

  // ─── Enrollment routes ───
  app.use("/api/enrollments", enrollmentRoutes);
  app.use("/api/submissions", submissionRoutes);

  // ─── Nested domain routes — specific before generic ───
  app.use("/api/domains/:domainId/sections/:sectionId/lessons", lessonRoutes);
  app.use("/api/domains/:domainId/sections", sectionRoutes);
  app.use("/api/domains/:domainId/tasks", taskRoutes);

  // ─── Domain router last — handles /, /:id, /:id/publish ───
  app.use("/api/domains", domainRoutes);

  app.use("/api/payments", paymentRoutes);

  app.use("/api/certificates", certificateRoutes);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(error_handler);
  return app;
};
// trigger reload
