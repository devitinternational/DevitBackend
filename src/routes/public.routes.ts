import { Router } from "express";
import {
  listPublicDomains,
  getPublicDomain,
} from "../controllers/public.controller.js";

const router = Router();

/**
 * Public endpoints — no auth required.
 * Mounted at /api/domains/public in app.ts (BEFORE the authenticated domain router).
 */
router.get("/", listPublicDomains);
router.get("/:idOrSlug", getPublicDomain);

export default router;