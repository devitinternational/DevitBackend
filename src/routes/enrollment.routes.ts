import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import {
  getActiveEnrollment,
  getEnrollmentCurriculum,
} from "../controllers/enrollment.controller.js";

const router = Router();

router.get("/active", verifyToken, getActiveEnrollment);
router.get("/:enrollmentId/curriculum", verifyToken, getEnrollmentCurriculum);

export default router;