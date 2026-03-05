import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { autoNotify } from '../helpers/messaging.js';

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
    const rows = db.prepare('SELECT day, openTime, closeTime, isClosed FROM schedule').all();
    res.json(rows);
});

// Public: get available slots for a date
router.get('/available-slots', (req, res) => {
    const { date, duration } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const dateStr = date as string;
    const dur = parseInt(duration as string) || 60;

    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[localDate.getDay()];

    const scheduleRow = db.prepare('SELECT * FROM schedule WHERE day = ?').get(dayOfWeek) as any;
    if (!scheduleRow || scheduleRow.isClosed) {
        return res.json({ slots: [], message: 'Shop is closed on this day' });
    }

    const openTime = scheduleRow.openTime || '08:00';
    const closeTime = scheduleRow.closeTime || '17:00';

    const existing = db.prepare(
        "SELECT date, duration FROM appointments WHERE date LIKE ? AND status NOT IN ('cancelled-by-customer', 'cancelled-by-salon', 'no-show')"
    ).all(`${dateStr}%`) as any[];

    const slots: string[] = [];
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    for (let m = openMinutes; m + dur <= closeMinutes; m += 30) {
        const slotH = Math.floor(m / 60);
        const slotM = m % 60;
        const slotStart = new Date(year, month - 1, day, slotH, slotM, 0);
        const slotEnd = new Date(slotStart.getTime() + dur * 60000);

        const hasConflict = existing.some((appt: any) => {
            const apptStart = new Date(appt.date);
            const apptEnd = new Date(apptStart.getTime() + (appt.duration || 60) * 60000);
            return slotStart < apptEnd && slotEnd > apptStart;
        });

        if (!hasConflict) {
            slots.push(slotStart.toISOString());
        }
    }

    res.json({ slots, date: dateStr, duration: dur });
});

// Public: customer registration
router.post('/register', (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password || !firstName) {
        return res.status(400).json({ error: 'Email, password, and first name are required' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Password must contain uppercase, lowercase, and a number' });
    }

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
    } catch (err: any) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Public: customer login
router.post('/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (user && bcrypt.compareSync(password, user.password)) {
        const role = user.role || 'customer';
        const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET!, { expiresIn: '24h' });

        const customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email) as any;
        res.json({
            token,
            user: { id: user.id, email: user.email, role, customerId: customer?.id || null }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Public: submit a booking (requires customer auth token)
router.post('/bookings', authenticateToken, (req: any, res: any) => {
    const { serviceId, date, petName, breed, notes, customerId } = req.body;
    if (!serviceId || !date || !petName) {
        return res.status(400).json({ error: 'serviceId, date, and petName are required' });
    }

    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) as any;
    if (!service) return res.status(404).json({ error: 'Service not found' });

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

    logAudit(req.user.id, 'book', 'appointment', apptId, null, { serviceId, petName, status });

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
