import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";
import {
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from "../controllers/task.controller.js";

const router = Router({ mergeParams: true });

// Special routes — must be before /:id
router.put(
  "/reorder",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  reorderTasks,
);
router.post(
  "/:taskId/questions",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  addQuestion,
);
router.put(
  "/questions/:id",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  updateQuestion,
);
router.delete(
  "/questions/:id",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  deleteQuestion,
);

// CRUD
router.post("/", verifyToken, requireRole("ADMIN", "CREATOR"), createTask);
router.put("/:id", verifyToken, requireRole("ADMIN", "CREATOR"), updateTask);
router.delete("/:id", verifyToken, requireRole("ADMIN", "CREATOR"), deleteTask);

export default router;
