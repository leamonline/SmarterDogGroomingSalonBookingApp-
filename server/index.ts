import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import db from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { validateBody, customerSchema, appointmentSchema, serviceSchema, settingsSchema, addOnSchema, paymentSchema, formSchema, formSubmissionSchema } from './schema.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(express.json());



const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : undefined);
if (!JWT_SECRET) {
    console.error('CRITICAL ERROR: JWT_SECRET environment variable is required.');
    process.exit(1);
}

// --- Auth Middleware ---
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        (req as any).user = user;
        next();
    });
};

// --- Role-Based Access Control ---
type Role = 'customer' | 'groomer' | 'receptionist' | 'owner';

const ROLE_HIERARCHY: Record<Role, number> = {
    'customer': 0,
    'groomer': 1,
    'receptionist': 2,
    'owner': 3,
};

// Allows the given roles AND any role higher in the hierarchy.
const requireRole = (...allowedRoles: Role[]) => {
    const minLevel = Math.min(...allowedRoles.map(r => ROLE_HIERARCHY[r]));
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const user = (req as any).user;
        if (!user || !user.role) {
            return res.status(403).json({ error: 'Access denied: no role assigned' });
        }
        const userLevel = ROLE_HIERARCHY[user.role as Role] ?? -1;
        if (userLevel < minLevel) {
            return res.status(403).json({ error: `Access denied: requires ${allowedRoles.join(' or ')} role or higher` });
        }
        next();
    };
};

// Shortcut: any staff (not customer)
const requireStaff = requireRole('groomer', 'receptionist', 'owner');
// Shortcut: admin-level (receptionist or owner)
const requireAdmin = requireRole('receptionist', 'owner');
// Shortcut: owner only
const requireOwner = requireRole('owner');

// --- Auth ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (user && bcrypt.compareSync(password, user.password)) {
        const role = user.role || 'owner'; // Default existing users to owner role
        const token = jwt.sign(
            { id: user.id, email: user.email, role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ token, user: { id: user.id, email: user.email, role } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/auth/password', authenticateToken, (req: any, res: any) => {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(401).json({ error: 'User not found' });

    const match = bcrypt.compareSync(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect current password' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ success: true });
});

// Get current user info (for frontend)
app.get('/api/auth/me', authenticateToken, (req: any, res: any) => {
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, role: user.role || 'owner' });
});

// --- Staff Management (admin only) ---
app.get('/api/staff', authenticateToken, requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, email, role FROM users').all();
    res.json(users);
});

app.post('/api/staff', authenticateToken, requireAdmin, (req: any, res: any) => {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const validRoles: Role[] = ['customer', 'groomer', 'receptionist', 'owner'];
    const assignedRole = validRoles.includes(role) ? role : 'groomer';

    // Only owners can create other owners
    if (assignedRole === 'owner' && req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can create owner accounts' });
    }

    try {
        const id = crypto.randomUUID();
        const hash = bcrypt.hashSync(password, 10);
        db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(id, email, hash, assignedRole);
        logAudit(req.user.id, 'create', 'user', id, null, { email, role: assignedRole });
        res.json({ success: true, id, email, role: assignedRole });
    } catch (err: any) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Failed to create staff' });
    }
});

// Update staff role (owner only)
app.put('/api/staff/:id/role', authenticateToken, requireOwner, (req: any, res: any) => {
    const { role } = req.body;
    const validRoles: Role[] = ['customer', 'groomer', 'receptionist', 'owner'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const target = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.params.id) as any;
    if (!target) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    logAudit(req.user.id, 'update_role', 'user', req.params.id, { role: target.role }, { role });
    res.json({ success: true, id: req.params.id, role });
});

// ══════════════════════════════════════════════
// PUBLIC BOOKING API (no auth required)
// ══════════════════════════════════════════════

// Public: list bookable services
app.get('/api/public/services', (req, res) => {
    const services = db.prepare(
        'SELECT id, name, description, duration, price, category, priceType, depositRequired, depositAmount FROM services WHERE isOnlineBookable = 1 AND isActive = 1'
    ).all();
    res.json(services);
});

// Public: shop schedule (so the booking calendar can disable closed days)
app.get('/api/public/schedule', (req, res) => {
    const rows = db.prepare('SELECT day, openTime, closeTime, isClosed FROM schedule').all();
    res.json(rows);
});

// Public: get available slots for a date
app.get('/api/public/available-slots', (req, res) => {
    const { date, duration } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const dateStr = date as string;
    const dur = parseInt(duration as string) || 60;

    // Parse the date string directly to avoid UTC-offset day-of-week errors.
    // "2024-01-15" -> year=2024, month=0, day=15 (local time, not UTC midnight)
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[localDate.getDay()];

    // Get schedule for this day
    const scheduleRow = db.prepare('SELECT * FROM schedule WHERE day = ?').get(dayOfWeek) as any;
    if (!scheduleRow || scheduleRow.isClosed) {
        return res.json({ slots: [], message: 'Shop is closed on this day' });
    }

    const openTime = scheduleRow.openTime || '08:00';
    const closeTime = scheduleRow.closeTime || '17:00';

    // Get existing appointments for this date (filter by YYYY-MM-DD prefix)
    const existing = db.prepare(
        "SELECT date, duration FROM appointments WHERE date LIKE ? AND status NOT IN ('cancelled-by-customer', 'cancelled-by-salon', 'no-show')"
    ).all(`${dateStr}%`) as any[];

    // Generate 30-min interval slots
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

        // Check for conflicts
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
app.post('/api/public/register', (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password || !firstName) {
        return res.status(400).json({ error: 'Email, password, and first name are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const userId = crypto.randomUUID();
        const hash = bcrypt.hashSync(password, 10);
        db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(userId, email, hash, 'customer');

        // Also create a customer record
        const customerId = crypto.randomUUID();
        db.prepare('INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)').run(
            customerId, `${firstName} ${lastName || ''}`.trim(), email, phone || ''
        );

        const token = jwt.sign({ id: userId, email, role: 'customer' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: userId, email, role: 'customer', customerId } });
    } catch (err: any) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Public: customer login (same as staff but returns customer-specific info)
app.post('/api/public/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (user && bcrypt.compareSync(password, user.password)) {
        const role = user.role || 'customer';
        const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: '24h' });

        // Find linked customer record
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
app.post('/api/public/bookings', authenticateToken, (req: any, res: any) => {
    const { serviceId, date, petName, breed, notes, customerId } = req.body;
    if (!serviceId || !date || !petName) {
        return res.status(400).json({ error: 'serviceId, date, and petName are required' });
    }

    // Get service details
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId) as any;
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const status = service.isApprovalRequired ? 'pending-approval' : 'confirmed';
    const apptId = crypto.randomUUID();

    db.prepare(`
        INSERT INTO appointments (id, petName, breed, ownerName, service, date, duration, status, price, avatar, customerId, notes, depositRequired, depositAmount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        apptId,
        petName,
        breed || '',
        '', // ownerName will be linked via customerId
        service.name,
        date,
        service.duration,
        status,
        service.price,
        'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&h=150&fit=crop&q=80',
        customerId || null,
        notes || '',
        service.depositRequired ? 1 : 0,
        service.depositAmount || 0
    );

    logAudit(req.user.id, 'book', 'appointment', apptId, null, { serviceId, petName, status });

    // Auto-notify customer
    const customer = customerId
        ? (db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(customerId) as any)
        : null;
    const triggerKey = status === 'pending-approval' ? 'booking_pending' : 'booking_confirmed';
    autoNotify(
        triggerKey,
        { id: apptId, ownerName: customer?.name || petName, petName, service: service.name, date, price: service.price, customerId },
        customer?.email ?? null,
        customer?.phone ?? null,
    );

    res.json({
        id: apptId,
        status,
        message: status === 'pending-approval'
            ? 'Your booking request has been submitted and is awaiting approval.'
            : 'Your booking has been confirmed!',
        depositRequired: service.depositRequired ? service.depositAmount : 0,
    });
});

// ══════════════════════════════════════════════
// PRIVATE API — auth required for all routes below.
// IMPORTANT: all public /api routes MUST be registered ABOVE this line.
// Adding a new private route below is safe. Adding a new public
// route below will silently require authentication for it.
// ══════════════════════════════════════════════
app.use('/api', authenticateToken);

// --- Customers ---
app.get('/api/customers', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as any).count;
    const customers = db.prepare('SELECT * FROM customers LIMIT ? OFFSET ?').all(limit, offset) as any[];
    if (customers.length === 0) {
        return res.json({
            data: customers,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    }

    const customerIds = customers.map(c => c.id);
    const placeholders = customerIds.map(() => '?').join(',');

    const warnings = db.prepare(`SELECT customerId, warning FROM customer_warnings WHERE customerId IN (${placeholders})`).all(...customerIds) as any[];
    const pets = db.prepare(`SELECT * FROM pets WHERE customerId IN (${placeholders})`).all(...customerIds) as any[];
    const documents = db.prepare(`SELECT * FROM documents WHERE customerId IN (${placeholders})`).all(...customerIds) as any[];

    const petIds = pets.map(p => p.id);
    const petPlaceholders = petIds.map(() => '?').join(',');

    const behavioralNotes = petIds.length > 0
        ? db.prepare(`SELECT petId, note FROM pet_behavioral_notes WHERE petId IN (${petPlaceholders})`).all(...petIds) as any[]
        : [];
    const vaccinations = petIds.length > 0
        ? db.prepare(`SELECT * FROM vaccinations WHERE petId IN (${petPlaceholders})`).all(...petIds) as any[]
        : [];

    const warningsByCustomer: Record<string, string[]> = {};
    for (const w of warnings) { warningsByCustomer[w.customerId] = warningsByCustomer[w.customerId] || []; warningsByCustomer[w.customerId].push(w.warning); }

    const notesByPet: Record<string, string[]> = {};
    for (const n of behavioralNotes) { notesByPet[n.petId] = notesByPet[n.petId] || []; notesByPet[n.petId].push(n.note); }

    const vaxByPet: Record<string, any[]> = {};
    for (const v of vaccinations) { vaxByPet[v.petId] = vaxByPet[v.petId] || []; vaxByPet[v.petId].push(v); }

    const petsByCustomer: Record<string, any[]> = {};
    for (const p of pets) {
        p.behavioralNotes = notesByPet[p.id] || [];
        p.vaccinations = vaxByPet[p.id] || [];
        petsByCustomer[p.customerId] = petsByCustomer[p.customerId] || [];
        petsByCustomer[p.customerId].push(p);
    }

    const docsByCustomer: Record<string, any[]> = {};
    for (const d of documents) { docsByCustomer[d.customerId] = docsByCustomer[d.customerId] || []; docsByCustomer[d.customerId].push(d); }

    for (const c of customers) {
        c.warnings = warningsByCustomer[c.id] || [];
        c.pets = petsByCustomer[c.id] || [];
        c.documents = docsByCustomer[c.id] || [];
        c.emergencyContact = { name: c.emergencyContactName, phone: c.emergencyContactPhone };
    }

    res.json({
        data: customers,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
});

app.post('/api/customers', validateBody(customerSchema), (req, res) => {
    const { id, name, email, phone, address, emergencyContact, notes, lastVisit, totalSpent, warnings, pets, documents } = req.body;

    const noUndef = (val: any) => val === undefined ? null : val;

    db.transaction(() => {
        const stmt = db.prepare(`
            INSERT INTO customers (id, name, email, phone, address, emergencyContactName, emergencyContactPhone, notes, lastVisit, totalSpent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            noUndef(id), noUndef(name), noUndef(email), noUndef(phone), noUndef(address),
            noUndef(emergencyContact?.name), noUndef(emergencyContact?.phone),
            noUndef(notes), noUndef(lastVisit), noUndef(totalSpent)
        );

        const insertWarning = db.prepare('INSERT INTO customer_warnings (customerId, warning) VALUES (?, ?)');
        (warnings || []).forEach((w: string) => insertWarning.run(id, noUndef(w)));

        const insertPet = db.prepare('INSERT INTO pets (id, customerId, name, breed, weight, dob, coatType) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertBehavior = db.prepare('INSERT INTO pet_behavioral_notes (petId, note) VALUES (?, ?)');
        const insertVax = db.prepare('INSERT INTO vaccinations (petId, name, expiryDate, status) VALUES (?, ?, ?, ?)');

        (pets || []).forEach((p: any) => {
            insertPet.run(noUndef(p.id), noUndef(id), noUndef(p.name), noUndef(p.breed), noUndef(p.weight), noUndef(p.dob), noUndef(p.coatType));
            (p.behavioralNotes || []).forEach((bn: string) => insertBehavior.run(noUndef(p.id), noUndef(bn)));
            (p.vaccinations || []).forEach((v: any) => insertVax.run(noUndef(p.id), noUndef(v.name), noUndef(v.expiryDate), noUndef(v.status)));
        });

        const insertDoc = db.prepare('INSERT INTO documents (id, customerId, name, type, uploadDate, url) VALUES (?, ?, ?, ?, ?, ?)');
        (documents || []).forEach((d: any) => insertDoc.run(noUndef(d.id), noUndef(id), noUndef(d.name), noUndef(d.type), noUndef(d.uploadDate), noUndef(d.url)));
    })();

    res.json(req.body);
});

app.put('/api/customers/:id', validateBody(customerSchema), (req, res) => {
    const customerId = req.params.id;
    const { name, email, phone, address, emergencyContact, notes, lastVisit, totalSpent, warnings, pets, documents } = req.body;

    const noUndef = (val: any) => val === undefined ? null : val;

    db.transaction(() => {
        const stmt = db.prepare(`
            UPDATE customers SET name=?, email=?, phone=?, address=?, emergencyContactName=?, emergencyContactPhone=?, notes=?, lastVisit=?, totalSpent=? WHERE id=?
        `);
        stmt.run(
            noUndef(name), noUndef(email), noUndef(phone), noUndef(address),
            noUndef(emergencyContact?.name), noUndef(emergencyContact?.phone),
            noUndef(notes), noUndef(lastVisit), noUndef(totalSpent), noUndef(customerId)
        );

        // Warnings: simple replace (no stable ID on the client side)
        db.prepare('DELETE FROM customer_warnings WHERE customerId = ?').run(customerId);
        const insertWarning = db.prepare('INSERT INTO customer_warnings (customerId, warning) VALUES (?, ?)');
        (warnings || []).forEach((w: string) => insertWarning.run(customerId, noUndef(w)));

        // Pets: upsert to preserve IDs (and their downstream FK relationships).
        // Remove only pets that were deleted on the client.
        const incomingPetIds = (pets || []).map((p: any) => p.id).filter(Boolean);
        if (incomingPetIds.length > 0) {
            const placeholders = incomingPetIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM pets WHERE customerId = ? AND id NOT IN (${placeholders})`).run(customerId, ...incomingPetIds);
        } else {
            db.prepare('DELETE FROM pets WHERE customerId = ?').run(customerId);
        }

        const upsertPet = db.prepare(`
            INSERT INTO pets (id, customerId, name, breed, weight, dob, coatType)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, breed=excluded.breed, weight=excluded.weight,
                dob=excluded.dob, coatType=excluded.coatType
        `);
        const deleteBehavior = db.prepare('DELETE FROM pet_behavioral_notes WHERE petId = ?');
        const insertBehavior = db.prepare('INSERT INTO pet_behavioral_notes (petId, note) VALUES (?, ?)');
        const deleteVax = db.prepare('DELETE FROM vaccinations WHERE petId = ?');
        const insertVax = db.prepare('INSERT INTO vaccinations (petId, name, expiryDate, status) VALUES (?, ?, ?, ?)');

        (pets || []).forEach((p: any) => {
            upsertPet.run(noUndef(p.id), noUndef(customerId), noUndef(p.name), noUndef(p.breed), noUndef(p.weight), noUndef(p.dob), noUndef(p.coatType));
            // Replace notes and vaccinations for each pet
            deleteBehavior.run(noUndef(p.id));
            (p.behavioralNotes || []).forEach((bn: string) => insertBehavior.run(noUndef(p.id), noUndef(bn)));
            deleteVax.run(noUndef(p.id));
            (p.vaccinations || []).forEach((v: any) => insertVax.run(noUndef(p.id), noUndef(v.name), noUndef(v.expiryDate), noUndef(v.status)));
        });

        // Documents: simple replace (URLs are the stable reference)
        db.prepare('DELETE FROM documents WHERE customerId = ?').run(customerId);
        const insertDoc = db.prepare('INSERT INTO documents (id, customerId, name, type, uploadDate, url) VALUES (?, ?, ?, ?, ?, ?)');
        (documents || []).forEach((d: any) => insertDoc.run(noUndef(d.id), noUndef(customerId), noUndef(d.name), noUndef(d.type), noUndef(d.uploadDate), noUndef(d.url)));
    })();

    res.json(req.body);
});

app.delete('/api/customers/:id', requireAdmin, (req: any, res: any) => {
    db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
    logAudit(req.user.id, 'delete', 'customer', req.params.id, null, null);
    res.json({ success: true });
});

// --- Appointments ---
// Maximum grooming appointment duration used to bound the overlap query window.
const MAX_DURATION_MINUTES = 480; // 8 hours, generous upper bound

// Helper to check for overlapping appointments.
// Uses a bounded time-window query instead of a full table scan.
const hasOverlap = (dateString: string, duration: number, excludeId?: string) => {
    const start = new Date(dateString).getTime();
    const end = start + duration * 60000;

    // Only fetch rows that could possibly overlap this window
    const windowStart = new Date(start - MAX_DURATION_MINUTES * 60000).toISOString();
    const windowEnd = new Date(end).toISOString();

    const appointments = db.prepare(`
        SELECT id, date, duration FROM appointments
        WHERE date BETWEEN ? AND ?
          AND status NOT IN ('cancelled-by-customer', 'cancelled-by-salon', 'no-show')
    `).all(windowStart, windowEnd) as any[];

    for (const apt of appointments) {
        if (excludeId && apt.id === excludeId) continue;
        const aptStart = new Date(apt.date).getTime();
        const aptEnd = aptStart + (apt.duration || 60) * 60000;
        if (start < aptEnd && end > aptStart) return true;
    }
    return false;
};


const getNextAvailableSlots = (fromIso: string, duration: number, maxResults = 5) => {
    const scheduleRows = db.prepare('SELECT day, openTime, closeTime, isClosed FROM schedule').all() as any[];
    const scheduleByDay = new Map(scheduleRows.map((r) => [r.day, r]));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const upcoming: string[] = [];
    const cursor = new Date(fromIso);
    const now = Number.isNaN(cursor.getTime()) ? new Date() : cursor;

    // Pre-fetch all appointments in the next 14-day window once, rather than
    // hitting the DB for every candidate slot inside hasOverlap.
    const searchWindowStart = now.toISOString();
    const searchWindowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const existingAppts = db.prepare(`
        SELECT id, date, duration FROM appointments
        WHERE date BETWEEN ? AND ?
          AND status NOT IN ('cancelled-by-customer', 'cancelled-by-salon', 'no-show')
    `).all(searchWindowStart, searchWindowEnd) as any[];

    const slotConflicts = (slotStart: number, slotDur: number) => {
        const slotEnd = slotStart + slotDur * 60000;
        return existingAppts.some(apt => {
            const aptStart = new Date(apt.date).getTime();
            const aptEnd = aptStart + (apt.duration || 60) * 60000;
            return slotStart < aptEnd && slotEnd > aptStart;
        });
    };

    for (let dayOffset = 0; dayOffset < 14 && upcoming.length < maxResults; dayOffset++) {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() + dayOffset);
        const dayName = dayNames[dayDate.getDay()];
        const daySchedule = scheduleByDay.get(dayName);
        if (!daySchedule || daySchedule.isClosed) continue;

        const [openHour, openMin] = (daySchedule.openTime || '08:00').split(':').map(Number);
        const [closeHour, closeMin] = (daySchedule.closeTime || '17:00').split(':').map(Number);

        const windowStart = new Date(dayDate);
        windowStart.setHours(openHour, openMin, 0, 0);
        const windowEnd = new Date(dayDate);
        windowEnd.setHours(closeHour, closeMin, 0, 0);

        const slot = new Date(windowStart);
        while (slot.getTime() + duration * 60000 <= windowEnd.getTime() && upcoming.length < maxResults) {
            if (slot.getTime() >= now.getTime() && !slotConflicts(slot.getTime(), duration)) {
                upcoming.push(slot.toISOString());
            }
            slot.setMinutes(slot.getMinutes() + 15);
        }
    }

    return upcoming;
};

app.get('/api/appointments', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM appointments').get() as any).count;
    const appointments = db.prepare('SELECT * FROM appointments ORDER BY date DESC LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
        data: appointments,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
});


app.get('/api/appointments/next-available', (req, res) => {
    const duration = Math.max(15, parseInt(req.query.duration as string) || 60);
    const from = (req.query.from as string) || new Date().toISOString();
    const slots = getNextAvailableSlots(from, duration, 5);
    res.json({ data: slots });
});

app.post('/api/appointments', validateBody(appointmentSchema), (req, res) => {
    const { id, petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar } = req.body;

    if (hasOverlap(date, duration)) {
        const suggestions = getNextAvailableSlots(date, duration, 3);
        return res.status(400).json({ error: 'This time slot overlaps with an existing appointment.', suggestions });
    }

    const stmt = db.prepare(`
    INSERT INTO appointments (id, petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(id, petName, breed, age || null, notes || null, ownerName, phone || null, service, date, duration, status, price, avatar);
    res.json(req.body);
});

app.put('/api/appointments/:id', validateBody(appointmentSchema), (req: any, res: any) => {
    const { petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar,
        checkedInAt, checkedInNotes, groomNotes, productsUsed, behaviourDuringGroom,
        completedAt, aftercareNotes, readyForCollectionAt, surcharge, surchargeReason, finalPrice,
        cancelledAt, cancellationReason, customerId } = req.body;

    if (hasOverlap(date, duration, req.params.id)) {
        const suggestions = getNextAvailableSlots(date, duration, 3);
        return res.status(400).json({ error: 'This time slot overlaps with an existing appointment.', suggestions });
    }

    const old = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id) as any;

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

    logAudit(req.user?.id, 'update', 'appointment', req.params.id, old, req.body);

    // Auto-notify on key status transitions
    if (old && old.status !== status) {
        const cust = customerId
            ? (db.prepare('SELECT email, phone FROM customers WHERE id = ?').get(customerId) as any)
            : null;
        if (status === 'ready-for-collection') {
            autoNotify('ready_for_collection', { ...req.body, id: req.params.id }, cust?.email, cust?.phone);
        }
        if (status === 'cancelled-by-salon' || status === 'cancelled-by-customer') {
            autoNotify('booking_cancelled', { ...req.body, id: req.params.id }, cust?.email, cust?.phone);
        }
    }

    res.json(req.body);
});

app.delete('/api/appointments/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM appointments WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// --- Services ---
app.get('/api/services', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM services').get() as any).count;
    const services = db.prepare('SELECT * FROM services LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
        data: services,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
});

app.post('/api/services', validateBody(serviceSchema), (req, res) => {
    const { id, name, description, duration, price, category, priceType, depositRequired, depositAmount, preBuffer, postBuffer, isOnlineBookable, isApprovalRequired, consentFormRequired, isActive } = req.body;
    const stmt = db.prepare('INSERT INTO services (id, name, description, duration, price, category, priceType, depositRequired, depositAmount, preBuffer, postBuffer, isOnlineBookable, isApprovalRequired, consentFormRequired, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, name, description, duration, price, category, priceType || 'fixed', depositRequired ? 1 : 0, depositAmount || 0, preBuffer || 0, postBuffer || 0, isOnlineBookable !== false ? 1 : 0, isApprovalRequired ? 1 : 0, consentFormRequired ? 1 : 0, isActive !== false ? 1 : 0);
    res.json(req.body);
});

app.put('/api/services/:id', validateBody(serviceSchema), (req, res) => {
    const { name, description, duration, price, category, priceType, depositRequired, depositAmount, preBuffer, postBuffer, isOnlineBookable, isApprovalRequired, consentFormRequired, isActive } = req.body;
    const stmt = db.prepare('UPDATE services SET name=?, description=?, duration=?, price=?, category=?, priceType=?, depositRequired=?, depositAmount=?, preBuffer=?, postBuffer=?, isOnlineBookable=?, isApprovalRequired=?, consentFormRequired=?, isActive=? WHERE id=?');
    stmt.run(name, description, duration, price, category, priceType || 'fixed', depositRequired ? 1 : 0, depositAmount || 0, preBuffer || 0, postBuffer || 0, isOnlineBookable !== false ? 1 : 0, isApprovalRequired ? 1 : 0, consentFormRequired ? 1 : 0, isActive !== false ? 1 : 0, req.params.id);
    res.json(req.body);
});

app.delete('/api/services/:id', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// --- Settings & Schedule ---
app.get('/api/settings', (req, res) => {
    const settingsRows = db.prepare('SELECT * FROM settings').all() as { key: string, value: string }[];
    const settings = settingsRows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

    const schedule = db.prepare('SELECT * FROM schedule').all();
    res.json({ ...settings, schedule });
});

app.post('/api/settings', requireAdmin, validateBody(settingsSchema), (req, res) => {
    const { shopName, shopPhone, shopAddress, schedule } = req.body;

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

    res.json({ success: true });
});

// --- Notifications ---
app.get('/api/notifications', (req, res) => {
    const notifs = db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC').all();
    res.json(notifs);
});

// --- Search ---
app.get('/api/search', (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.json({ customers: [], pets: [], appointments: [] });

    const queryLike = `%${q}%`;

    const customers = db.prepare('SELECT * FROM customers WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?').all(queryLike, queryLike, queryLike);
    const pets = db.prepare('SELECT * FROM pets WHERE name LIKE ? OR breed LIKE ?').all(queryLike, queryLike);
    const appointments = db.prepare('SELECT * FROM appointments WHERE petName LIKE ? OR ownerName LIKE ? OR service LIKE ?').all(queryLike, queryLike, queryLike);

    res.json({ customers, pets, appointments });
});

// --- Audit Log Helper ---
function logAudit(userId: string | null, action: string, entityType: string, entityId: string | null, oldValue?: any, newValue?: any) {
    db.prepare(`INSERT INTO audit_log (userId, action, entityType, entityId, oldValue, newValue, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, new Date().toISOString());
}

// --- Add-ons ---
app.get('/api/add-ons', (req, res) => {
    const addOns = db.prepare('SELECT * FROM add_ons WHERE isActive = 1').all();
    res.json(addOns);
});

app.post('/api/add-ons', validateBody(addOnSchema), (req: any, res: any) => {
    const { name, description, price, duration, isOptional, isActive } = req.body;
    const id = req.body.id || crypto.randomUUID();
    db.prepare(`INSERT INTO add_ons (id, name, description, price, duration, isOptional, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, name, description || null, price || 0, duration || 0, isOptional !== false ? 1 : 0, isActive !== false ? 1 : 0);
    logAudit(req.user?.id || null, 'create', 'add_on', id, null, req.body);
    res.json({ id, ...req.body });
});

app.put('/api/add-ons/:id', validateBody(addOnSchema), (req: any, res: any) => {
    const { name, description, price, duration, isOptional, isActive } = req.body;
    const old = db.prepare('SELECT * FROM add_ons WHERE id = ?').get(req.params.id);
    db.prepare(`UPDATE add_ons SET name=?, description=?, price=?, duration=?, isOptional=?, isActive=? WHERE id=?`)
        .run(name, description || null, price || 0, duration || 0, isOptional !== false ? 1 : 0, isActive !== false ? 1 : 0, req.params.id);
    logAudit(req.user?.id || null, 'update', 'add_on', req.params.id, old, req.body);
    res.json({ id: req.params.id, ...req.body });
});

app.delete('/api/add-ons/:id', (req: any, res: any) => {
    const old = db.prepare('SELECT * FROM add_ons WHERE id = ?').get(req.params.id);
    db.prepare('UPDATE add_ons SET isActive = 0 WHERE id = ?').run(req.params.id);
    logAudit(req.user?.id || null, 'archive', 'add_on', req.params.id, old, null);
    res.json({ success: true });
});

// --- Service Add-on Links ---
app.get('/api/services/:id/add-ons', (req, res) => {
    const addOns = db.prepare(`
        SELECT a.* FROM add_ons a
        JOIN service_add_ons sa ON sa.addOnId = a.id
        WHERE sa.serviceId = ? AND a.isActive = 1
    `).all(req.params.id);
    res.json(addOns);
});

app.post('/api/services/:id/add-ons', (req: any, res: any) => {
    const { addOnIds } = req.body;
    if (!Array.isArray(addOnIds)) return res.status(400).json({ error: 'addOnIds must be an array' });
    const del = db.prepare('DELETE FROM service_add_ons WHERE serviceId = ?');
    const ins = db.prepare('INSERT INTO service_add_ons (serviceId, addOnId) VALUES (?, ?)');
    db.transaction(() => {
        del.run(req.params.id);
        for (const addOnId of addOnIds) {
            ins.run(req.params.id, addOnId);
        }
    })();
    logAudit(req.user?.id || null, 'update', 'service_add_ons', req.params.id, null, { addOnIds });
    res.json({ success: true });
});

// --- Payments ---
app.get('/api/payments', (req, res) => {
    const { appointmentId } = req.query;
    if (appointmentId) {
        const payments = db.prepare('SELECT * FROM payments WHERE appointmentId = ? ORDER BY createdAt DESC').all(appointmentId);
        return res.json(payments);
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const payments = db.prepare('SELECT * FROM payments ORDER BY createdAt DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = (db.prepare('SELECT COUNT(*) as count FROM payments').get() as any).count;
    res.json({ data: payments, total, page, limit });
});

app.post('/api/payments', validateBody(paymentSchema), (req: any, res: any) => {
    const { appointmentId, customerId, amount, method, type, status, notes } = req.body;
    const id = req.body.id || crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(`INSERT INTO payments (id, appointmentId, customerId, amount, method, type, status, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, appointmentId, customerId || null, amount, method, type, status || 'completed', notes || null, createdAt);

    // Auto-update appointment deposit status if this is a deposit payment
    if (type === 'deposit') {
        db.prepare('UPDATE appointments SET depositPaid = 1 WHERE id = ?').run(appointmentId);
    }

    logAudit(req.user?.id || null, 'create', 'payment', id, null, req.body);
    res.json({ id, createdAt, ...req.body });
});

// --- Customer Tags ---
app.get('/api/customers/:id/tags', (req, res) => {
    const tags = db.prepare('SELECT tag FROM customer_tags WHERE customerId = ?').all(req.params.id) as { tag: string }[];
    res.json(tags.map(t => t.tag));
});

app.post('/api/customers/:id/tags', (req: any, res: any) => {
    const { tags } = req.body;
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array' });
    const del = db.prepare('DELETE FROM customer_tags WHERE customerId = ?');
    const ins = db.prepare('INSERT INTO customer_tags (customerId, tag) VALUES (?, ?)');
    db.transaction(() => {
        del.run(req.params.id);
        for (const tag of tags) {
            ins.run(req.params.id, tag);
        }
    })();
    logAudit(req.user?.id || null, 'update', 'customer_tags', req.params.id, null, { tags });
    res.json({ success: true });
});

// --- Dog Tags ---
app.get('/api/dogs/:id/tags', (req, res) => {
    const tags = db.prepare('SELECT tag FROM dog_tags WHERE dogId = ?').all(req.params.id) as { tag: string }[];
    res.json(tags.map(t => t.tag));
});

app.post('/api/dogs/:id/tags', (req: any, res: any) => {
    const { tags } = req.body;
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array' });
    const del = db.prepare('DELETE FROM dog_tags WHERE dogId = ?');
    const ins = db.prepare('INSERT INTO dog_tags (dogId, tag) VALUES (?, ?)');
    db.transaction(() => {
        del.run(req.params.id);
        for (const tag of tags) {
            ins.run(req.params.id, tag);
        }
    })();
    logAudit(req.user?.id || null, 'update', 'dog_tags', req.params.id, null, { tags });
    res.json({ success: true });
});

// --- Audit Log ---
app.get('/api/audit-log', requireOwner, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;

    let query = 'SELECT * FROM audit_log';
    const params: any[] = [];
    const conditions: string[] = [];

    if (entityType) { conditions.push('entityType = ?'); params.push(entityType); }
    if (entityId) { conditions.push('entityId = ?'); params.push(entityId); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const entries = db.prepare(query).all(...params);
    res.json(entries);
});

// --- Forms ---
app.get('/api/forms', (req, res) => {
    const forms = db.prepare('SELECT * FROM forms WHERE isActive = 1 ORDER BY createdAt DESC').all();
    res.json(forms);
});

app.post('/api/forms', validateBody(formSchema), (req: any, res: any) => {
    const { name, description, version, fields, isActive } = req.body;
    const id = req.body.id || crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(`INSERT INTO forms (id, name, description, version, fields, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, name, description || null, version || 1, fields, isActive !== false ? 1 : 0, createdAt);
    logAudit(req.user?.id || null, 'create', 'form', id, null, req.body);
    res.json({ id, createdAt, ...req.body });
});

app.put('/api/forms/:id', validateBody(formSchema), (req: any, res: any) => {
    const { name, description, version, fields, isActive } = req.body;
    const old = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    db.prepare(`UPDATE forms SET name=?, description=?, version=?, fields=?, isActive=?, updatedAt=? WHERE id=?`)
        .run(name, description || null, version || 1, fields, isActive !== false ? 1 : 0, new Date().toISOString(), req.params.id);
    logAudit(req.user?.id || null, 'update', 'form', req.params.id, old, req.body);
    res.json({ id: req.params.id, ...req.body });
});

// --- Form Submissions ---
app.get('/api/form-submissions', (req, res) => {
    const { formId, customerId, dogId, appointmentId } = req.query;
    let query = 'SELECT * FROM form_submissions';
    const params: any[] = [];
    const conditions: string[] = [];
    if (formId) { conditions.push('formId = ?'); params.push(formId); }
    if (customerId) { conditions.push('customerId = ?'); params.push(customerId); }
    if (dogId) { conditions.push('dogId = ?'); params.push(dogId); }
    if (appointmentId) { conditions.push('appointmentId = ?'); params.push(appointmentId); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY submittedAt DESC';
    const submissions = db.prepare(query).all(...params);
    res.json(submissions);
});

app.post('/api/form-submissions', validateBody(formSubmissionSchema), (req: any, res: any) => {
    const { formId, customerId, dogId, appointmentId, data, signature } = req.body;
    const id = req.body.id || crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    db.prepare(`INSERT INTO form_submissions (id, formId, customerId, dogId, appointmentId, data, signature, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, formId, customerId || null, dogId || null, appointmentId || null, data, signature || null, submittedAt);
    logAudit(req.user?.id || null, 'create', 'form_submission', id, null, req.body);
    res.json({ id, submittedAt, ...req.body });
});

// --- Analytics ---
app.get('/api/analytics', (req, res) => {
    const stats: any = {
        totalRevenue: 0,
        appointments: 0,
        activeRate: 0,
        newCustomers: 0
    };

    const appointments = db.prepare('SELECT price, status FROM appointments').all() as any[];
    stats.appointments = appointments.length;
    stats.totalRevenue = appointments
        .filter(a => a.status === 'completed' || a.status === 'in-progress')
        .reduce((sum, a) => sum + (a.price || 0), 0);

    const customers = db.prepare('SELECT lastVisit FROM customers').all() as any[];
    const activeCustomers = customers.filter(c => c.lastVisit && c.lastVisit !== 'Never').length;
    stats.activeRate = customers.length ? Math.round((activeCustomers / customers.length) * 100) : 0;
    stats.newCustomers = activeCustomers;

    res.json(stats);
});

// --- Reports (server-side aggregated) ---
app.get('/api/reports', (req, res) => {
    const { start, end } = req.query as { start?: string; end?: string };
    const startDate = start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end || new Date().toISOString();

    // Core appointment data in range
    const appointments = db.prepare(`
        SELECT id, petName, ownerName, service, date, duration, status, price
        FROM appointments
        WHERE date BETWEEN ? AND ?
        ORDER BY date DESC
    `).all(startDate, endDate) as any[];

    // Revenue by day (completed only)
    const revenueByDay = db.prepare(`
        SELECT substr(date, 1, 10) as day, SUM(price) as revenue, COUNT(*) as count
        FROM appointments
        WHERE date BETWEEN ? AND ? AND status = 'completed'
        GROUP BY day
        ORDER BY day
    `).all(startDate, endDate) as any[];

    // Service breakdown (completed)
    const serviceBreakdown = db.prepare(`
        SELECT service as name, COUNT(*) as count, SUM(price) as revenue
        FROM appointments
        WHERE date BETWEEN ? AND ? AND status = 'completed'
        GROUP BY service
        ORDER BY revenue DESC
    `).all(startDate, endDate) as any[];

    res.json({ appointments, revenueByDay, serviceBreakdown });
});

// ══════════════════════════════════════════════
// MESSAGING
// ══════════════════════════════════════════════

/**
 * Interpolate {{variable}} placeholders in a message template.
 */
const interpolate = (template: string, vars: Record<string, string | number | undefined>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));

/**
 * Log a message to the DB and (optionally) send via email/SMS.
 * In production, set SMTP_HOST / SMTP_USER / SMTP_PASS env vars;
 * without them the message is queued as 'simulated'.
 */
const dispatchMessage = (opts: {
    customerId?: string | null;
    appointmentId?: string | null;
    recipientEmail?: string | null;
    recipientPhone?: string | null;
    channel: 'email' | 'sms';
    templateName: string;
    subject?: string;
    body: string;
}) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Determine status — if SMTP is not configured we log as 'simulated'
    const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    const status = smtpConfigured ? 'sent' : 'simulated';

    db.prepare(`
        INSERT INTO messages
            (id, customerId, appointmentId, recipientEmail, recipientPhone,
             channel, templateName, subject, body, status, sentAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        opts.customerId ?? null,
        opts.appointmentId ?? null,
        opts.recipientEmail ?? null,
        opts.recipientPhone ?? null,
        opts.channel,
        opts.templateName,
        opts.subject ?? null,
        opts.body,
        status,
        now,
        now,
    );

    // TODO: plug Nodemailer here when SMTP_HOST env var is set
    // if (smtpConfigured && opts.channel === 'email') { ... }

    return { id, status };
};

/**
 * Look up active templates from localStorage-equivalent server-side store.
 * For now templates live on the client (localStorage); we use DEFAULT_TEMPLATES
 * copied here so the server can render them without a round-trip.
 */
const SERVER_TEMPLATES: Record<string, { channel: 'email' | 'sms'; subject: string; body: string }> = {
    booking_confirmed: {
        channel: 'email',
        subject: 'Your appointment at Savvy Pet Spa is confirmed!',
        body: 'Hi {{customerName}},\n\nYour appointment for {{petName}} ({{service}}) has been confirmed.\n\n📅 {{date}}\n⏰ {{time}}\n💰 £{{price}}\n\nPlease arrive 5 minutes early.\n\nSee you soon!\nSavvy Pet Spa',
    },
    booking_pending: {
        channel: 'email',
        subject: "We've received your booking request",
        body: "Hi {{customerName}},\n\nThank you for your booking request for {{petName}} ({{service}}) on {{date}} at {{time}}.\n\nWe're reviewing it and will confirm shortly.\n\nSavvy Pet Spa",
    },
    ready_for_collection: {
        channel: 'sms',
        subject: '{{petName}} is ready for collection! 🐾',
        body: 'Hi {{customerName}}, {{petName}} is all done and looking fabulous! You can collect them now. – Savvy Pet Spa',
    },
    booking_cancelled: {
        channel: 'email',
        subject: 'Appointment cancelled',
        body: 'Hi {{customerName}},\n\nYour appointment for {{petName}} on {{date}} has been cancelled.\n\nIf you would like to rebook, visit our booking page.\n\nSavvy Pet Spa',
    },
};

/** Fire an automatic notification based on appointment event. */
const autoNotify = (
    triggerKey: keyof typeof SERVER_TEMPLATES,
    appointment: any,
    customerEmail?: string | null,
    customerPhone?: string | null,
) => {
    const tpl = SERVER_TEMPLATES[triggerKey];
    if (!tpl) return;

    const apptDate = new Date(appointment.date);
    const vars = {
        customerName: appointment.ownerName || 'Valued Customer',
        petName: appointment.petName || 'your pet',
        service: appointment.service || '',
        date: apptDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: apptDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        price: appointment.price ?? '',
    };

    dispatchMessage({
        customerId: appointment.customerId ?? null,
        appointmentId: appointment.id ?? null,
        recipientEmail: customerEmail ?? null,
        recipientPhone: customerPhone ?? null,
        channel: tpl.channel,
        templateName: triggerKey,
        subject: interpolate(tpl.subject, vars),
        body: interpolate(tpl.body, vars),
    });
};

// GET  /api/messages — list sent messages (admin/owner)
app.get('/api/messages', requireAdmin, (req: any, res: any) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const rows = db.prepare(
        'SELECT * FROM messages ORDER BY createdAt DESC LIMIT ?'
    ).all(limit);
    res.json(rows);
});

// POST /api/messages/send — manual send (staff+)
app.post('/api/messages/send', (req: any, res: any) => {
    const { recipientEmail, recipientPhone, channel, subject, body, customerId, appointmentId } = req.body;
    if (!body) return res.status(400).json({ error: 'body is required' });
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
    logAudit(req.user?.id, 'send', 'message', result.id, null, { channel, recipientEmail, recipientPhone });
    res.json({ id: result.id, status: result.status });
});


if (process.env.NODE_ENV !== 'test') {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    // Backup every 6 hours (6 * 60 * 60 * 1000 ms)
    setInterval(() => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `database_backup_${timestamp}.db`);
        try {
            db.backup(backupPath).then(() => {
                console.log(`Database backed up to ${backupPath}`);
            });
        } catch (err) {
            console.error('Database backup failed:', err);
        }
    }, 6 * 60 * 60 * 1000);
}

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`API server running on port ${PORT}`);
    });
}
export default app;
