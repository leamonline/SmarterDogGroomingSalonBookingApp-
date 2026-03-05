import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { autoNotify } from '../helpers/messaging.js';
import { hasOverlap, getNextAvailableSlots } from '../helpers/appointments.js';
import { validateBody, appointmentSchema, clampLimit } from '../schema.js';

const router = Router();

router.get('/', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = clampLimit(req.query.limit as string);
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM appointments').get() as any).count;
    const appointments = db.prepare('SELECT * FROM appointments ORDER BY date DESC LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
        data: appointments,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
});

router.get('/next-available', (req, res) => {
    const duration = Math.max(15, parseInt(req.query.duration as string) || 60);
    const from = (req.query.from as string) || new Date().toISOString();
    const slots = getNextAvailableSlots(from, duration, 5);
    res.json({ data: slots });
});

router.post('/', validateBody(appointmentSchema), (req: any, res: any) => {
    const { petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar } = req.body;
    const id = crypto.randomUUID();

    const result = db.transaction(() => {
        if (hasOverlap(date, duration)) {
            const suggestions = getNextAvailableSlots(date, duration, 3);
            return { conflict: true, suggestions };
        }
        db.prepare(`INSERT INTO appointments (id, petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, petName, breed, age || null, notes || null, ownerName, phone || null, service, date, duration, status, price, avatar);
        return { conflict: false };
    })();

    if (result.conflict) {
        return res.status(400).json({ error: 'This time slot overlaps with an existing appointment.', suggestions: result.suggestions });
    }

    logAudit(req.user?.id || null, 'create', 'appointment', id, null, req.body);
    res.json({ ...req.body, id });
});

router.put('/:id', validateBody(appointmentSchema), (req: any, res: any) => {
    const { petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar,
        checkedInAt, checkedInNotes, groomNotes, productsUsed, behaviourDuringGroom,
        completedAt, aftercareNotes, readyForCollectionAt, surcharge, surchargeReason, finalPrice,
        cancelledAt, cancellationReason, customerId } = req.body;

    const txResult = db.transaction(() => {
        const old = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id) as any;
        if (!old) return { notFound: true, conflict: false, old: null as any };

        if (hasOverlap(date, duration, req.params.id)) {
            const suggestions = getNextAvailableSlots(date, duration, 3);
            return { notFound: false, conflict: true, suggestions, old: null as any };
        }

        db.prepare(`
            UPDATE appointments SET
                petName=?, breed=?, age=?, notes=?, ownerName=?, phone=?, service=?, date=?, duration=?, status=?, price=?, avatar=?,
                checkedInAt=?, checkedInNotes=?, groomNotes=?, productsUsed=?, behaviourDuringGroom=?,
                completedAt=?, aftercareNotes=?, readyForCollectionAt=?, surcharge=?, surchargeReason=?, finalPrice=?,
                cancelledAt=?, cancellationReason=?, customerId=?
            WHERE id=?
        `).run(
            petName, breed, age ?? null, notes ?? null, ownerName, phone ?? null, service, date, duration, status, price, avatar,
            checkedInAt ?? null, checkedInNotes ?? null, groomNotes ?? null, productsUsed ?? null, behaviourDuringGroom ?? null,
            completedAt ?? null, aftercareNotes ?? null, readyForCollectionAt ?? null, surcharge ?? null, surchargeReason ?? null, finalPrice ?? null,
            cancelledAt ?? null, cancellationReason ?? null, customerId ?? null,
            req.params.id,
        );

        return { notFound: false, conflict: false, old };
    })();

    if (txResult.notFound) {
        return res.status(404).json({ error: 'Appointment not found' });
    }
    if (txResult.conflict) {
        return res.status(400).json({ error: 'This time slot overlaps with an existing appointment.', suggestions: (txResult as any).suggestions });
    }

    const old = txResult.old;
    logAudit(req.user?.id, 'update', 'appointment', req.params.id, old, req.body);

    // Auto-notify on key status transitions
    if (old && old.status !== status) {
        if (status === 'ready-for-collection') {
            autoNotify('ready_for_collection', { ...req.body, id: req.params.id });
        }
        if (status === 'cancelled-by-salon' || status === 'cancelled-by-customer') {
            autoNotify('booking_cancelled', { ...req.body, id: req.params.id });
        }
    }

    res.json(req.body);
});

router.delete('/:id', requireAdmin, (req: any, res: any) => {
    const existing = db.prepare('SELECT id FROM appointments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    db.prepare('DELETE FROM appointments WHERE id=?').run(req.params.id);
    logAudit(req.user.id, 'delete', 'appointment', req.params.id, null, null);
    res.json({ success: true });
});

export default router;
