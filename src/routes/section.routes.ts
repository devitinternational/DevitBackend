import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";
import {
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from "../controllers/section.controller.js";

const router = Router({ mergeParams: true });

// Reorder — must be before /:id
router.put(
  "/reorder",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  reorderSections,
);

// CRUD
router.post("/", verifyToken, requireRole("ADMIN", "CREATOR"), createSection);
router.put("/:id", verifyToken, requireRole("ADMIN", "CREATOR"), updateSection);
router.delete(
  "/:id",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  deleteSection,
);

export default router;
