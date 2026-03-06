import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { JWT_SECRET, authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validatePasswordStrength } from '../helpers/password.js';
import { autoNotify } from '../helpers/messaging.js';
import type { UserRow, ServiceRow } from '../types.js';
import type { RawScheduleRow } from '../helpers/schedule.js';
import {
    getAppointmentAvailability,
    getAvailabilityErrorMessage,
    getAvailabilityReason,
    getAvailableSlotsForDate,
    getNextAvailableSlots,
} from '../helpers/appointments.js';
import { normalizeScheduleRows } from '../helpers/schedule.js';

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public: list bookable services
router.get('/services', (req, res) => {
    const services = db.prepare(
        'SELECT id, name, description, duration, price, category, priceType, depositRequired, depositAmount FROM services WHERE isOnlineBookable = 1 AND isActive = 1'
    ).all();
    res.json(services);
});

// Public: shop schedule
router.get('/schedule', (req, res) => {
    const rows = db.prepare('SELECT * FROM schedule').all() as RawScheduleRow[];
    res.json(normalizeScheduleRows(rows));
});

// Public: get available slots for a date
router.get('/available-slots', (req, res) => {
    const { date, duration } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const dateStr = date as string;
    const dur = parseInt(duration as string) || 60;

    const slots = getAvailableSlotsForDate(dateStr, dur);
    res.json({ slots, date: dateStr, duration: dur });
});

// Public: customer registration
router.post('/register', (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password || !firstName) {
        return res.status(400).json({ error: 'Email, password, and first name are required' });
    }
    const pwError = validatePasswordStrength(password);
    if (pwError) return res.status(400).json({ error: pwError });

    try {
        const userId = crypto.randomUUID();
        const hash = bcrypt.hashSync(password, 10);
        db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(userId, email, hash, 'customer');

        const customerId = crypto.randomUUID();
        db.prepare('INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)').run(
            customerId, `${firstName} ${lastName || ''}`.trim(), email, phone || ''
        );

        const token = jwt.sign({ id: userId, email, role: 'customer' }, JWT_SECRET!, { expiresIn: '24h' });
        res.json({ token, user: { id: userId, email, role: 'customer', customerId } });
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Public: customer login
router.post('/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;

    if (user && bcrypt.compareSync(password, user.password)) {
        const role = user.role || 'customer';
        const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET!, { expiresIn: '24h' });

        const customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email) as { id: string } | undefined;
        res.json({
            token,
            user: { id: user.id, email: user.email, role, customerId: customer?.id || null }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Public: submit a booking (requires customer auth token)
router.post('/bookings', authenticateToken, (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { serviceId, date, petName, breed, notes, customerId } = req.body;
    if (!serviceId || !date || !petName) {
        return res.status(400).json({ error: 'serviceId, date, and petName are required' });
    }

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) as ServiceRow | undefined;
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const availability = getAppointmentAvailability(date, service.duration);
    const conflictReason = getAvailabilityReason(availability);
    if (conflictReason) {
        return res.status(400).json({
            error: getAvailabilityErrorMessage(conflictReason),
            suggestions: getNextAvailableSlots(date, service.duration, 3),
        });
    }

    const status = service.isApprovalRequired ? 'pending-approval' : 'confirmed';
    const apptId = crypto.randomUUID();

    db.prepare(`
        INSERT INTO appointments (id, petName, breed, ownerName, service, date, duration, status, price, avatar, customerId, notes, depositRequired, depositAmount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        apptId, petName, breed || '', '', service.name, date, service.duration, status, service.price,
        'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&h=150&fit=crop&q=80',
        customerId || null, notes || '', service.depositRequired ? 1 : 0, service.depositAmount || 0
    );

    logAudit(authReq.user.id, 'book', 'appointment', apptId, null, { serviceId, petName, status });

    const triggerKey = status === 'pending-approval' ? 'booking_pending' : 'booking_confirmed';
    autoNotify(
        triggerKey,
        { id: apptId, ownerName: petName, petName, service: service.name, date, price: service.price, customerId },
    );

    res.json({
        id: apptId, status,
        message: status === 'pending-approval'
            ? 'Your booking request has been submitted and is awaiting approval.'
            : 'Your booking has been confirmed!',
        depositRequired: service.depositRequired ? service.depositAmount : 0,
    });
});

export default router;
