import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";
import { GetFinanceReport } from "../controllers/income.controller.js";

const router = Router({ mergeParams: true });

router.get("/report", verifyToken, requireRole("ADMIN"), GetFinanceReport);

export default router;