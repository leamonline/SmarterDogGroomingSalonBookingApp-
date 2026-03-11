import { Router, type Request, type Response } from "express";
import db from "../db.js";
import { requireAdmin, getUser } from "../middleware/auth.js";
import { logAudit } from "../helpers/audit.js";
import { validateBody, settingsSchema } from "../schema.js";
import type { RawScheduleRow } from "../helpers/schedule.js";
import {
  BOOKING_CLOSE_TIME,
  BOOKING_OPEN_TIME,
  normalizeScheduleRows,
  serializeSlotConfig,
} from "../helpers/schedule.js";

const router = Router();

// --- Settings & Schedule ---
router.get("/", (req, res) => {
  const settingsRows = db.prepare("SELECT * FROM settings").all() as { key: string; value: string }[];
  const settings = settingsRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

  const scheduleRows = db.prepare("SELECT * FROM schedule").all() as RawScheduleRow[];
  const schedule = normalizeScheduleRows(scheduleRows);
  res.json({ ...settings, schedule });
});

router.post("/", requireAdmin, validateBody(settingsSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const { shopName, shopPhone, shopAddress, schedule } = req.body;

  const oldSettings = db.prepare("SELECT * FROM settings").all() as { key: string; value: string }[];
  const oldMap = oldSettings.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {} as Record<string, string>);

  const updateSetting = db.prepare("UPDATE settings SET value = ? WHERE key = ?");
  if (shopName) updateSetting.run(shopName, "shopName");
  if (shopPhone) updateSetting.run(shopPhone, "shopPhone");
  if (shopAddress) updateSetting.run(shopAddress, "shopAddress");

  if (schedule && Array.isArray(schedule)) {
    const upsertSchedule = db.prepare(`
            INSERT INTO schedule (day, openTime, closeTime, isClosed, slotConfig)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(day) DO UPDATE SET
                openTime = excluded.openTime,
                closeTime = excluded.closeTime,
                isClosed = excluded.isClosed,
                slotConfig = excluded.slotConfig
        `);
    db.transaction(() => {
      for (const s of schedule) {
        upsertSchedule.run(
          s.day,
          BOOKING_OPEN_TIME,
          BOOKING_CLOSE_TIME,
          s.isClosed ? 1 : 0,
          serializeSlotConfig(s.slots),
        );
      }
    })();
  }

  logAudit(user.id, "update", "settings", null, oldMap, req.body);
  res.json({ success: true });
});

// --- Notifications ---
router.get("/notifications", (req, res) => {
  const notifs = db.prepare("SELECT * FROM notifications ORDER BY createdAt DESC").all();
  res.json(notifs);
});

export default router;
