import { Router } from 'express';
import db from '../db.js';
import { logAudit } from '../helpers/audit.js';
import { validateBody, paymentSchema, clampLimit } from '../schema.js';

const router = Router();

router.get('/', (req, res) => {
    const { appointmentId } = req.query;
    if (appointmentId) {
        const payments = db.prepare('SELECT * FROM payments WHERE appointmentId = ? ORDER BY createdAt DESC').all(appointmentId);
        return res.json(payments);
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = clampLimit(req.query.limit as string);
    const offset = (page - 1) * limit;
    const total = (db.prepare('SELECT COUNT(*) as count FROM payments').get() as any).count;
    const payments = db.prepare('SELECT * FROM payments ORDER BY createdAt DESC LIMIT ? OFFSET ?').all(limit, offset);
    res.json({
        data: payments,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
});

router.post('/', validateBody(paymentSchema), (req: any, res: any) => {
    const { appointmentId, customerId, amount, method, type, status, notes } = req.body;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(`INSERT INTO payments (id, appointmentId, customerId, amount, method, type, status, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, appointmentId, customerId || null, amount, method, type, status || 'completed', notes || null, createdAt);

    if (type === 'deposit') {
        db.prepare('UPDATE appointments SET depositPaid = 1 WHERE id = ?').run(appointmentId);
    }

    logAudit(req.user?.id || null, 'create', 'payment', id, null, req.body);
    res.json({ ...req.body, id, createdAt });
});

export default router;
