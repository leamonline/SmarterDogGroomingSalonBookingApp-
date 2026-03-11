import { Router, type Request, type Response } from "express";
import db from "../db.js";
import { requireAdmin, getUser } from "../middleware/auth.js";
import { logAudit } from "../helpers/audit.js";
import { validateBody, serviceSchema, addOnSchema, serviceAddOnLinkSchema, clampLimit } from "../schema.js";
import type { ServiceRow, AddOnRow, CountRow } from "../types.js";

/** Convert a boolean-ish value to 0/1 for SQLite. When `defaultTrue`, undefined/null → 1. */
const boolToInt = (val: unknown, defaultTrue = false): number => (defaultTrue ? (val !== false ? 1 : 0) : val ? 1 : 0);

const router = Router();

// --- Services ---
router.get("/", (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = clampLimit(req.query.limit as string);
  const offset = (page - 1) * limit;

  const total = (db.prepare("SELECT COUNT(*) as count FROM services").get() as CountRow).count;
  const services = db.prepare("SELECT * FROM services LIMIT ? OFFSET ?").all(limit, offset);

  res.json({
    data: services,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

router.post("/", validateBody(serviceSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const {
    name,
    description,
    duration,
    price,
    category,
    priceType,
    depositRequired,
    depositAmount,
    preBuffer,
    postBuffer,
    isOnlineBookable,
    isApprovalRequired,
    consentFormRequired,
    isActive,
  } = req.body;
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO services (id, name, description, duration, price, category, priceType, depositRequired, depositAmount, preBuffer, postBuffer, isOnlineBookable, isApprovalRequired, consentFormRequired, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    name,
    description,
    duration,
    price,
    category,
    priceType || "fixed",
    boolToInt(depositRequired),
    depositAmount || 0,
    preBuffer || 0,
    postBuffer || 0,
    boolToInt(isOnlineBookable, true),
    boolToInt(isApprovalRequired),
    boolToInt(consentFormRequired),
    boolToInt(isActive, true),
  );
  logAudit(user.id, "create", "service", id, null, req.body);
  res.json({ ...req.body, id });
});

router.put("/:id", validateBody(serviceSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const {
    name,
    description,
    duration,
    price,
    category,
    priceType,
    depositRequired,
    depositAmount,
    preBuffer,
    postBuffer,
    isOnlineBookable,
    isApprovalRequired,
    consentFormRequired,
    isActive,
  } = req.body;

  const old = db.prepare("SELECT * FROM services WHERE id = ?").get(req.params.id) as ServiceRow | undefined;
  if (!old) return res.status(404).json({ error: "Service not found" });

  db.prepare(
    "UPDATE services SET name=?, description=?, duration=?, price=?, category=?, priceType=?, depositRequired=?, depositAmount=?, preBuffer=?, postBuffer=?, isOnlineBookable=?, isApprovalRequired=?, consentFormRequired=?, isActive=? WHERE id=?",
  ).run(
    name,
    description,
    duration,
    price,
    category,
    priceType || "fixed",
    boolToInt(depositRequired),
    depositAmount || 0,
    preBuffer || 0,
    postBuffer || 0,
    boolToInt(isOnlineBookable, true),
    boolToInt(isApprovalRequired),
    boolToInt(consentFormRequired),
    boolToInt(isActive, true),
    req.params.id,
  );
  logAudit(user.id, "update", "service", req.params.id, old, req.body);
  res.json(req.body);
});

router.delete("/:id", requireAdmin, (req: Request, res: Response) => {
  const user = getUser(req);
  const existing = db.prepare("SELECT id FROM services WHERE id = ?").get(req.params.id) as
    | Pick<ServiceRow, "id">
    | undefined;
  if (!existing) return res.status(404).json({ error: "Service not found" });

  db.prepare("DELETE FROM services WHERE id=?").run(req.params.id);
  logAudit(user.id, "delete", "service", req.params.id, null, null);
  res.json({ success: true });
});

// --- Service Add-on Links ---
router.get("/:id/add-ons", (req, res) => {
  const addOns = db
    .prepare(
      `
        SELECT a.* FROM add_ons a
        JOIN service_add_ons sa ON sa.addOnId = a.id
        WHERE sa.serviceId = ? AND a.isActive = 1
    `,
    )
    .all(req.params.id);
  res.json(addOns);
});

router.post("/:id/add-ons", validateBody(serviceAddOnLinkSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const { addOnIds } = req.body;
  const del = db.prepare("DELETE FROM service_add_ons WHERE serviceId = ?");
  const ins = db.prepare("INSERT INTO service_add_ons (serviceId, addOnId) VALUES (?, ?)");
  db.transaction(() => {
    del.run(req.params.id);
    for (const addOnId of addOnIds) {
      ins.run(req.params.id, addOnId);
    }
  })();
  logAudit(user.id, "update", "service_add_ons", req.params.id, null, { addOnIds });
  res.json({ success: true });
});

// --- Add-ons ---
export const addOnRouter = Router();

addOnRouter.get("/", (req, res) => {
  const addOns = db.prepare("SELECT * FROM add_ons WHERE isActive = 1").all();
  res.json(addOns);
});

addOnRouter.post("/", validateBody(addOnSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const { name, description, price, duration, isOptional, isActive } = req.body;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO add_ons (id, name, description, price, duration, isOptional, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    name,
    description || null,
    price || 0,
    duration || 0,
    boolToInt(isOptional, true),
    boolToInt(isActive, true),
  );
  logAudit(user.id, "create", "add_on", id, null, req.body);
  res.json({ ...req.body, id });
});

addOnRouter.put("/:id", validateBody(addOnSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const { name, description, price, duration, isOptional, isActive } = req.body;
  const old = db.prepare("SELECT * FROM add_ons WHERE id = ?").get(req.params.id) as AddOnRow | undefined;
  if (!old) return res.status(404).json({ error: "Add-on not found" });

  db.prepare(`UPDATE add_ons SET name=?, description=?, price=?, duration=?, isOptional=?, isActive=? WHERE id=?`).run(
    name,
    description || null,
    price || 0,
    duration || 0,
    boolToInt(isOptional, true),
    boolToInt(isActive, true),
    req.params.id,
  );
  logAudit(user.id, "update", "add_on", req.params.id, old, req.body);
  res.json({ id: req.params.id, ...req.body });
});

addOnRouter.delete("/:id", (req: Request, res: Response) => {
  const user = getUser(req);
  const old = db.prepare("SELECT * FROM add_ons WHERE id = ?").get(req.params.id) as AddOnRow | undefined;
  if (!old) return res.status(404).json({ error: "Add-on not found" });

  db.prepare("UPDATE add_ons SET isActive = 0 WHERE id = ?").run(req.params.id);
  logAudit(user.id, "archive", "add_on", req.params.id, old, null);
  res.json({ success: true });
});

export default router;
