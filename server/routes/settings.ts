import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validateBody, settingsSchema } from '../schema.js';

const router = Router();

// --- Settings & Schedule ---
router.get('/', (req, res) => {
    const settingsRows = db.prepare('SELECT * FROM settings').all() as { key: string, value: string }[];
    const settings = settingsRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

    const schedule = db.prepare('SELECT * FROM schedule').all();
    res.json({ ...settings, schedule });
});

router.post('/', requireAdmin, validateBody(settingsSchema), (req: any, res: any) => {
    const { shopName, shopPhone, shopAddress, schedule } = req.body;

    const oldSettings = db.prepare('SELECT * FROM settings').all() as { key: string, value: string }[];
    const oldMap = oldSettings.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {} as Record<string, string>);

    const updateSetting = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
    if (shopName) updateSetting.run(shopName, 'shopName');
    if (shopPhone) updateSetting.run(shopPhone, 'shopPhone');
    if (shopAddress) updateSetting.run(shopAddress, 'shopAddress');

    if (schedule && Array.isArray(schedule)) {
        const updateSched = db.prepare('UPDATE schedule SET openTime=?, closeTime=?, isClosed=? WHERE day=?');
        db.transaction(() => {
            for (const s of schedule) {
                updateSched.run(s.openTime, s.closeTime, s.isClosed ? 1 : 0, s.day);
            }
        })();
    }

    logAudit(req.user?.id || null, 'update', 'settings', null, oldMap, req.body);
    res.json({ success: true });
});

// --- Notifications ---
router.get('/notifications', (req, res) => {
    const notifs = db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC').all();
    res.json(notifs);
});

export default router;
