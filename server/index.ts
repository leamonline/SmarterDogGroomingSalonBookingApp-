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
import { validateBody, customerSchema, appointmentSchema, serviceSchema, settingsSchema } from './schema.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json());



const JWT_SECRET = process.env.JWT_SECRET;
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
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email } });
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

app.get('/api/staff', authenticateToken, (req, res) => {
    const users = db.prepare('SELECT id, email FROM users').all();
    res.json(users);
});

app.post('/api/staff', authenticateToken, (req: any, res: any) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const id = crypto.randomUUID();
        const hash = bcrypt.hashSync(password, 10);
        db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)').run(id, email, hash);
        res.json({ success: true, id, email });
    } catch (err: any) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Failed to create staff' });
    }
});

// Apply auth middleware to all routes below this point
app.use('/api', authenticateToken);

// --- Customers ---
app.get('/api/customers', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as any).count;
    const customers = db.prepare('SELECT * FROM customers LIMIT ? OFFSET ?').all(limit, offset) as any[];
    if (customers.length === 0) return res.json(customers);

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

        // Delete existing relations and recreate for simplicity
        db.prepare('DELETE FROM customer_warnings WHERE customerId = ?').run(customerId);
        db.prepare('DELETE FROM pets WHERE customerId = ?').run(customerId);
        db.prepare('DELETE FROM documents WHERE customerId = ?').run(customerId);

        const insertWarning = db.prepare('INSERT INTO customer_warnings (customerId, warning) VALUES (?, ?)');
        (warnings || []).forEach((w: string) => insertWarning.run(customerId, noUndef(w)));

        const insertPet = db.prepare('INSERT INTO pets (id, customerId, name, breed, weight, dob, coatType) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertBehavior = db.prepare('INSERT INTO pet_behavioral_notes (petId, note) VALUES (?, ?)');
        const insertVax = db.prepare('INSERT INTO vaccinations (petId, name, expiryDate, status) VALUES (?, ?, ?, ?)');

        (pets || []).forEach((p: any) => {
            insertPet.run(noUndef(p.id), noUndef(customerId), noUndef(p.name), noUndef(p.breed), noUndef(p.weight), noUndef(p.dob), noUndef(p.coatType));
            (p.behavioralNotes || []).forEach((bn: string) => insertBehavior.run(noUndef(p.id), noUndef(bn)));
            (p.vaccinations || []).forEach((v: any) => insertVax.run(noUndef(p.id), noUndef(v.name), noUndef(v.expiryDate), noUndef(v.status)));
        });

        const insertDoc = db.prepare('INSERT INTO documents (id, customerId, name, type, uploadDate, url) VALUES (?, ?, ?, ?, ?, ?)');
        (documents || []).forEach((d: any) => insertDoc.run(noUndef(d.id), noUndef(customerId), noUndef(d.name), noUndef(d.type), noUndef(d.uploadDate), noUndef(d.url)));
    })();

    res.json(req.body);
});

app.delete('/api/customers/:id', (req, res) => {
    db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// --- Appointments ---
// Helper to check for overlapping appointments
const hasOverlap = (dateString: string, duration: number, excludeId?: string) => {
    const start = new Date(dateString).getTime();
    const end = start + duration * 60000;

    const appointments = db.prepare('SELECT id, date, duration FROM appointments').all() as any[];
    for (const apt of appointments) {
        if (excludeId && apt.id === excludeId) continue;

        const aptStart = new Date(apt.date).getTime();
        const aptEnd = aptStart + apt.duration * 60000;

        if (start < aptEnd && end > aptStart) {
            return true;
        }
    }
    return false;
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

app.post('/api/appointments', validateBody(appointmentSchema), (req, res) => {
    const { id, petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar } = req.body;

    if (hasOverlap(date, duration)) {
        return res.status(400).json({ error: 'This time slot overlaps with an existing appointment.' });
    }

    const stmt = db.prepare(`
    INSERT INTO appointments (id, petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(id, petName, breed, age || null, notes || null, ownerName, phone || null, service, date, duration, status, price, avatar);
    res.json(req.body);
});

app.put('/api/appointments/:id', validateBody(appointmentSchema), (req, res) => {
    const { petName, breed, age, notes, ownerName, phone, service, date, duration, status, price, avatar } = req.body;

    if (hasOverlap(date, duration, req.params.id)) {
        return res.status(400).json({ error: 'This time slot overlaps with an existing appointment.' });
    }

    const stmt = db.prepare(`
    UPDATE appointments SET petName=?, breed=?, age=?, notes=?, ownerName=?, phone=?, service=?, date=?, duration=?, status=?, price=?, avatar=? WHERE id=?
  `);
    stmt.run(petName, breed, age || null, notes || null, ownerName, phone || null, service, date, duration, status, price, avatar, req.params.id);
    res.json(req.body);
});

app.delete('/api/appointments/:id', (req, res) => {
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
    const { id, name, description, duration, price, category } = req.body;
    const stmt = db.prepare('INSERT INTO services (id, name, description, duration, price, category) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(id, name, description, duration, price, category);
    res.json(req.body);
});

app.put('/api/services/:id', validateBody(serviceSchema), (req, res) => {
    const { name, description, duration, price, category } = req.body;
    const stmt = db.prepare('UPDATE services SET name=?, description=?, duration=?, price=?, category=? WHERE id=?');
    stmt.run(name, description, duration, price, category, req.params.id);
    res.json(req.body);
});

app.delete('/api/services/:id', (req, res) => {
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

app.post('/api/settings', validateBody(settingsSchema), (req, res) => {
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

// --- Analytics ---
app.get('/api/analytics', (req, res) => {
    const stats: any = {
        totalRevenue: 0,
        appointments: 0,
        activeRate: 89,
        newCustomers: 12
    };

    const appointments = db.prepare('SELECT price, status FROM appointments').all() as any[];
    stats.appointments = appointments.length;
    stats.totalRevenue = appointments.filter(a => a.status === 'completed' || a.status === 'in-progress').reduce((sum, a) => sum + (a.price || 0), 0);

    const customers = db.prepare('SELECT lastVisit FROM customers').all() as any[];
    const activeCustomers = customers.filter(c => c.lastVisit && c.lastVisit !== 'Never').length;
    stats.activeRate = customers.length ? Math.round((activeCustomers / customers.length) * 100) : 0;

    // Basic replacement for real metric instead of faking it
    stats.newCustomers = activeCustomers;

    res.json(stats);
});

// Database backup loop
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
