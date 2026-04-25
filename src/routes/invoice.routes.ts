import { Router } from "express";
import {
  createProjectInvoice,
  createStudentInvoice,
  getInvoiceById,
  getInvoiceMeta,
  getInvoicePdf,
  listInvoices,
  sendInvoice,
} from "../controllers/invoice.controller.js";
import { verifyToken } from "../middlewares/auth-middleware.js";
import { requireRole } from "../middlewares/require-role.js";

const router = Router();

router.use(verifyToken, requireRole("ADMIN", "CREATOR"));

router.get("/", listInvoices);
router.get("/meta", getInvoiceMeta);
router.post("/student", createStudentInvoice);
router.post("/project", createProjectInvoice);
router.get("/:id", getInvoiceById);
router.post("/:id/send", sendInvoice);
router.get("/:id/pdf", getInvoicePdf);

export default router;
