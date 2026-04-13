import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";
import {
  GetAllExpenses,
  GetExpenseById,
  CreateExpense,
  UpdateExpense,
  DeleteExpense,
  GetExpenseReport,
} from "../controllers/expense.controller.js";

const router = Router({ mergeParams: true }); 
// Report — must be before /:id to avoid route conflict
router.get("/report", verifyToken, requireRole("ADMIN"), GetExpenseReport);

// CRUD
router.get("/", verifyToken, requireRole("ADMIN"), GetAllExpenses);
router.get("/:id", verifyToken, requireRole("ADMIN"), GetExpenseById);
router.post("/", verifyToken, requireRole("ADMIN"), CreateExpense);
router.put("/:id", verifyToken, requireRole("ADMIN"), UpdateExpense);
router.delete("/:id", verifyToken, requireRole("ADMIN"), DeleteExpense);

export default router;