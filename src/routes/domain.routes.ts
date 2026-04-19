import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";
import {
  listDomains,
  listPublicDomains,
  createDomain,
  getDomain,
  updateDomain,
  deleteDomain,
  togglePublish,
} from "../controllers/domain.controller.js";

const router = Router({ mergeParams: true });

// Public domains list
router.get("/public", listPublicDomains);

// Publish toggle — must be before /:id
router.patch(
  "/:id/publish",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  togglePublish,
);

// CRUD
router.get("/", verifyToken, requireRole("ADMIN", "CREATOR"), listDomains);
router.get("/:id", verifyToken, requireRole("ADMIN", "CREATOR"), getDomain);
router.post("/", verifyToken, requireRole("ADMIN", "CREATOR"), createDomain);
router.put("/:id", verifyToken, requireRole("ADMIN", "CREATOR"), updateDomain);
router.delete(
  "/:id",
  verifyToken,
  requireRole("ADMIN", "CREATOR"),
  deleteDomain,
);

export default router;
