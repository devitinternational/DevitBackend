import { Router } from "express";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";
import { createOrder, verifyPayment, handleWebhook, getInvoice } from "../controllers/payment.controller.js";

const router = Router();

router.post("/webhook", handleWebhook);
router.post("/order", verifyToken, createOrder);
router.post("/verify", verifyToken, verifyPayment);
router.get("/invoice/:enrollmentId", verifyToken, getInvoice);


export default router;