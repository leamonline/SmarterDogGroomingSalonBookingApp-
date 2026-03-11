import db from "../db.js";

export function logAudit(
  userId: string | null | undefined,
  action: string,
  entityType: string,
  entityId: string | null | undefined,
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
