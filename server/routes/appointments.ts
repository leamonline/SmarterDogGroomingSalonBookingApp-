import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { requireAdmin, getUser } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { autoNotify } from '../helpers/messaging.js';
import {
    getAppointmentAvailability,
    getAvailabilityErrorMessage,
    getAvailabilityReason,
    getNextAvailableSlots,
} from '../helpers/appointments.js';
import { validateBody, appointmentSchema, clampLimit } from '../schema.js';
import type { AppointmentRow, CountRow } from '../types.js';
import type { AvailabilityReason } from '../helpers/appointments.js';

interface TxCreateResult { conflict: boolean; suggestions?: string[]; reason?: AvailabilityReason; }
interface TxUpdateResult { notFound: boolean; conflict: boolean; suggestions?: string[]; reason?: AvailabilityReason; old: AppointmentRow | null; }

const router = Router();

router.get('/', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = clampLimit(req.query.limit as string);
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM appointments').get() as CountRow).count;
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

router.post('/', validateBody(appointmentSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const { petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar } = req.body;
    const id = crypto.randomUUID();

    const result: TxCreateResult = db.transaction(() => {
        const availability = getAppointmentAvailability(date, duration);
        const conflictReason = getAvailabilityReason(availability);
        if (conflictReason) {
            const suggestions = getNextAvailableSlots(date, duration, 3);
            return { conflict: true, suggestions, reason: conflictReason };
        }
        db.prepare(`INSERT INTO appointments (id, petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, petName, breed, age || null, notes || null, ownerName, phone || null, service, date, duration, status, price, avatar);
        return { conflict: false };
    })();

    if (result.conflict) {
        return res.status(400).json({
            error: getAvailabilityErrorMessage(result.reason),
            suggestions: result.suggestions,
        });
    }

    logAudit(user.id, 'create', 'appointment', id, null, req.body);
    res.json({ ...req.body, id });
});

router.put('/:id', validateBody(appointmentSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const { petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar,
        checkedInAt, checkedInNotes, groomNotes, productsUsed, behaviourDuringGroom,
        completedAt, aftercareNotes, readyForCollectionAt, surcharge, surchargeReason, finalPrice,
        cancelledAt, cancellationReason, customerId } = req.body;

    const txResult: TxUpdateResult = db.transaction(() => {
        const old = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id) as AppointmentRow | undefined;
        if (!old) return { notFound: true, conflict: false, old: null };

        const availability = getAppointmentAvailability(date, duration, req.params.id);
        const conflictReason = getAvailabilityReason(availability);
        if (conflictReason) {
            const suggestions = getNextAvailableSlots(date, duration, 3, { excludeId: req.params.id });
            return { notFound: false, conflict: true, suggestions, reason: conflictReason, old: null };
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
        return res.status(400).json({
            error: getAvailabilityErrorMessage(txResult.reason),
            suggestions: txResult.suggestions,
        });
    }

    const old = txResult.old;
    logAudit(user.id, 'update', 'appointment', req.params.id, old, req.body);

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

router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
    const user = getUser(req);
    const existing = db.prepare('SELECT id FROM appointments WHERE id = ?').get(req.params.id) as Pick<AppointmentRow, 'id'> | undefined;
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    db.prepare('DELETE FROM appointments WHERE id=?').run(req.params.id);
    logAudit(user.id, 'delete', 'appointment', req.params.id, null, null);
    res.json({ success: true });
});

export default router;
