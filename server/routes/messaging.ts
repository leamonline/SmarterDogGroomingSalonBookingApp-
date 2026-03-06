import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { dispatchMessage } from '../helpers/messaging.js';
import { validateBody, manualMessageSchema, clampLimit } from '../schema.js';

const router = Router();

// GET /api/messages — list sent messages (admin/owner)
router.get('/', requireAdmin, (req: Request, res: Response) => {
    const limit = clampLimit(req.query.limit as string, 100);
    const rows = db.prepare('SELECT * FROM messages ORDER BY createdAt DESC LIMIT ?').all(limit);
    res.json(rows);
});

// POST /api/messages/send — manual send (staff+)
router.post('/send', validateBody(manualMessageSchema), (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { recipientEmail, recipientPhone, channel, subject, body, customerId, appointmentId } = req.body;

    if (channel === 'email' && !recipientEmail) return res.status(400).json({ error: 'recipientEmail required for email channel' });
    if (channel === 'sms' && !recipientPhone) return res.status(400).json({ error: 'recipientPhone required for sms channel' });

    const result = dispatchMessage({
        customerId: customerId ?? null,
        appointmentId: appointmentId ?? null,
        recipientEmail: recipientEmail ?? null,
        recipientPhone: recipientPhone ?? null,
        channel: channel || 'email',
        templateName: 'manual',
        subject: subject ?? null,
        body,
    });
    logAudit(authReq.user?.id, 'send', 'message', result.id, null, { channel, recipientEmail, recipientPhone });
    res.json({ id: result.id, status: result.status });
});

export default router;
