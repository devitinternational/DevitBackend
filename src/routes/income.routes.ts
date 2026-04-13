import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";
import {
  GetAllIncomes,
  GetIncomeById,
  CreateIncome,
  UpdateIncome,
  DeleteIncome,
  GetFinanceReport,
} from "../controllers/income.controller.js";

const router = Router({ mergeParams: true });

// Finance report — must be before /:id
router.get("/report", verifyToken, requireRole("ADMIN"), GetFinanceReport);

// CRUD
router.get("/", verifyToken, requireRole("ADMIN"), GetAllIncomes);
router.get("/:id", verifyToken, requireRole("ADMIN"), GetIncomeById);
router.post("/", verifyToken, requireRole("ADMIN"), CreateIncome);
router.put("/:id", verifyToken, requireRole("ADMIN"), UpdateIncome);
router.delete("/:id", verifyToken, requireRole("ADMIN"), DeleteIncome);

export default router;