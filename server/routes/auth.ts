import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { JWT_SECRET, authenticateToken, requireAdmin, requireOwner, type Role } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/auth/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (user && bcrypt.compareSync(password, user.password)) {
        const role = user.role || 'owner';
        const token = jwt.sign(
            { id: user.id, email: user.email, role },
            JWT_SECRET!,
            { expiresIn: '24h' }
        );
        res.json({ token, user: { id: user.id, email: user.email, role } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

router.post('/auth/password', authenticateToken, (req: any, res: any) => {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(401).json({ error: 'User not found' });

    const match = bcrypt.compareSync(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect current password' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ success: true });
});

router.get('/auth/me', authenticateToken, (req: any, res: any) => {
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, role: user.role || 'owner' });
});

// --- Staff Management (admin only) ---
router.get('/staff', authenticateToken, requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, email, role FROM users').all();
    res.json(users);
});

router.post('/staff', authenticateToken, requireAdmin, (req: any, res: any) => {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Password must contain uppercase, lowercase, and a number' });
    }

    const validRoles: Role[] = ['customer', 'groomer', 'receptionist', 'owner'];
    const assignedRole = validRoles.includes(role) ? role : 'groomer';

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

router.put('/staff/:id/role', authenticateToken, requireOwner, (req: any, res: any) => {
    const { role } = req.body;
    const validRoles: Role[] = ['customer', 'groomer', 'receptionist', 'owner'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const target = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.params.id) as any;
    if (!target) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    logAudit(req.user.id, 'update_role', 'user', req.params.id, { role: target.role }, { role });
    res.json({ success: true, id: req.params.id, role });
});

export default router;
