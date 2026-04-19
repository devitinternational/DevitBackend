import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import {
  getCertificate,
  getPublicCertificate,
  downloadCertificatePdf,
  generateCertificateForEnrollment,
} from "../controllers/certificate.controller.js";

const router = Router();

// Public — no auth needed
router.get("/verify/:hash", getPublicCertificate);

// Protected
router.get("/enrollment/:enrollmentId", verifyToken, getCertificate);
router.get("/enrollment/:enrollmentId/download", verifyToken, downloadCertificatePdf);
router.post(
  "/enrollment/:enrollmentId/generate",
  verifyToken,
  generateCertificateForEnrollment
);

export default router;