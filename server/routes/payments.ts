import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import db from "../db.js";
import { requireStaff, getUser } from "../middleware/auth.js";
import { logAudit } from "../helpers/audit.js";
import { validateBody, paymentSchema, clampLimit } from "../schema.js";
import type { CountRow } from "../types.js";

const router = Router();

router.get("/", requireStaff, (req, res) => {
  const { appointmentId } = req.query;
  if (appointmentId) {
    const payments = db
      .prepare("SELECT * FROM payments WHERE appointmentId = ? ORDER BY createdAt DESC")
      .all(appointmentId);
    return res.json(payments);
  }
  const page = parseInt(req.query.page as string) || 1;
  const limit = clampLimit(req.query.limit as string);
  const offset = (page - 1) * limit;
  const total = (db.prepare("SELECT COUNT(*) as count FROM payments").get() as CountRow).count;
  const payments = db.prepare("SELECT * FROM payments ORDER BY createdAt DESC LIMIT ? OFFSET ?").all(limit, offset);
  return res.json({
    data: payments,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

router.post("/", requireStaff, validateBody(paymentSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const { appointmentId, customerId, amount, method, type, status, notes } = req.body;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO payments (id, appointmentId, customerId, amount, method, type, status, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, appointmentId, customerId || null, amount, method, type, status || "completed", notes || null, createdAt);

  if (type === "deposit") {
    db.prepare("UPDATE appointments SET depositPaid = 1 WHERE id = ?").run(appointmentId);
  }

  logAudit(user.id, "create", "payment", id, null, req.body);
  res.json({ ...req.body, id, createdAt });
});

export default router;
