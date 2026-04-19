import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import {
  submitProject,
  submitQuiz,
  getSubmissions,
  reviewSubmission,
} from "../controllers/submission.controller.js";
import { requireRole } from "../middlewares/require-role.js";

const router = Router();

/**
 * GET  /api/submissions?enrollmentId=xxx   — all submissions for an enrollment
 * POST /api/submissions/project            — submit a GitHub repo URL for a PROJECT task
 * POST /api/submissions/quiz               — submit quiz answers for a QUIZ task
 */
router.get("/", verifyToken, getSubmissions);
router.post("/project", verifyToken, submitProject);
router.post("/quiz", verifyToken, submitQuiz);
router.patch("/:submissionId/review", verifyToken, requireRole("ADMIN"), reviewSubmission);


export default router;