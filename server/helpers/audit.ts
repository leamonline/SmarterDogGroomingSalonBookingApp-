import db from "../db.js";

export function logAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValue?: any,
  newValue?: any,
) {
  db.prepare(
    `INSERT INTO audit_log (userId, action, entityType, entityId, oldValue, newValue, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    action,
    entityType,
    entityId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    new Date().toISOString(),
  );
}
