import { Router, type Request, type Response } from "express";
import db from "../db.js";
import { requireStaff, getUser } from "../middleware/auth.js";
import { logAudit } from "../helpers/audit.js";
import { dispatchMessage } from "../helpers/messaging.js";
import { validateBody, manualMessageSchema, clampLimit } from "../schema.js";

const router = Router();

// GET /api/messages — list sent messages (staff)
router.get("/", requireStaff, (req: Request, res: Response) => {
  const limit = clampLimit(req.query.limit as string, 100);
  const customerId = typeof req.query.customerId === "string" ? req.query.customerId : "";
  const appointmentId = typeof req.query.appointmentId === "string" ? req.query.appointmentId : "";
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (customerId) {
    conditions.push("m.customerId = ?");
    params.push(customerId);
  }
  if (appointmentId) {
    conditions.push("m.appointmentId = ?");
    params.push(appointmentId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `
        SELECT
            m.*,
            c.name as customerName,
            c.email as customerEmail,
            c.phone as customerPhone
        FROM messages m
        LEFT JOIN customers c ON c.id = m.customerId
        ${whereClause}
        ORDER BY m.createdAt DESC
        LIMIT ?
    `,
    )
    .all(...params, limit);
  res.json(rows);
});

// POST /api/messages/send — manual send (staff+)
router.post("/send", requireStaff, validateBody(manualMessageSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const { recipientEmail, recipientPhone, channel, subject, body, customerId, appointmentId } = req.body;

  if (channel === "email" && !recipientEmail)
    return res.status(400).json({ error: "recipientEmail required for email channel" });
  if (channel === "sms" && !recipientPhone)
    return res.status(400).json({ error: "recipientPhone required for sms channel" });

  const result = dispatchMessage({
    customerId: customerId ?? null,
    appointmentId: appointmentId ?? null,
    recipientEmail: recipientEmail ?? null,
    recipientPhone: recipientPhone ?? null,
    channel: channel || "email",
    templateName: "manual",
    subject: subject ?? null,
    body,
  });
  logAudit(user.id, "send", "message", result.id, null, { channel, recipientEmail, recipientPhone });
  return res.json({ id: result.id, status: result.status });
});

export default router;
