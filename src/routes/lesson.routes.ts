import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";
import {
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  getVideoUploadUrl,
} from "../controllers/lesson.controller.js";

const router = Router({ mergeParams: true });

// Special routes — must be before /:lessonId
router.put(
  "/reorder",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  reorderLessons,
);
router.post(
  "/:lessonId/upload-url",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  getVideoUploadUrl,
);

// CRUD
router.post("/", verifyToken, requireRole("ADMIN", "CREATOR"), createLesson);
router.put(
  "/:lessonId",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  updateLesson,
);
router.delete(
  "/:lessonId",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  deleteLesson,
);

export default router;
