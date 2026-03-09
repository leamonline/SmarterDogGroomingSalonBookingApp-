import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { JWT_SECRET, authenticateToken, requireAdmin, requireOwner, getUser, type Role } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validatePasswordStrength, isWeakPassword } from '../helpers/password.js';
import { logger } from '../lib/logger.js';
import type { UserRow } from '../types.js';

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

router.post('/auth/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;

    if (user && bcrypt.compareSync(password, user.password)) {
        const role = user.role || 'owner';
        const token = jwt.sign(
            { id: user.id, email: user.email, role },
            JWT_SECRET!,
            { expiresIn: '24h' }
        );

        // Flag weak passwords so the frontend can prompt a change
        const isWeak = isWeakPassword(password);

        // Set token as httpOnly cookie AND return in body for backward compat
        res.cookie('petspa_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24h
            path: '/',
        });

        res.json({
            token,
            user: { id: user.id, email: user.email, role },
            ...(isWeak ? { passwordChangeRequired: true } : {}),
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

router.post('/auth/password', authenticateToken, (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
    }

    // Enforce password strength on change
    const pwError = validatePasswordStrength(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const currentUser = getUser(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(currentUser.id) as UserRow | undefined;
    if (!user) return res.status(401).json({ error: 'User not found' });

    const match = bcrypt.compareSync(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect current password' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, currentUser.id);
    logAudit(currentUser.id, 'update', 'user_password', currentUser.id, null, null);
    res.json({ success: true });
});

// --- Password Reset Flow ---
// Rate-limit reset requests to prevent email enumeration / abuse
const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { error: 'Too many reset attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// In-memory store for reset tokens (production: use DB table or Redis)
const resetTokens = new Map<string, { userId: string; expiresAt: number }>();

router.post('/auth/password-reset/request', resetLimiter, (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Always return success to prevent email enumeration
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as Pick<UserRow, 'id'> | undefined;
    if (user) {
        const token = crypto.randomUUID();
        resetTokens.set(token, {
            userId: user.id,
            expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
        });
        // TODO: send email with reset link containing token
        // For now, log to console in development for testing
        if (process.env.NODE_ENV !== 'production') {
            logger.info('Password reset token generated', { email, token });
        }
        logAudit(null, 'password_reset_request', 'user', user.id, null, null);
    }

    res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
});

router.post('/auth/password-reset/confirm', (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }

    const entry = resetTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
        resetTokens.delete(token);
        return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const pwError = validatePasswordStrength(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, entry.userId);
    resetTokens.delete(token);
    logAudit(null, 'password_reset_complete', 'user', entry.userId, null, null);
    res.json({ success: true });
});

router.post('/auth/logout', (_req, res) => {
    res.clearCookie('petspa_token', { path: '/' });
    res.json({ success: true });
});

router.get('/auth/me', authenticateToken, (req: Request, res: Response) => {
    const currentUser = getUser(req);
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(currentUser.id) as Pick<UserRow, 'id' | 'email' | 'role'> | undefined;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, role: user.role || 'owner' });
});

// --- Staff Management (admin only) ---
router.get('/staff', authenticateToken, requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, email, role FROM users').all();
    res.json(users);
});

router.post('/staff', authenticateToken, requireAdmin, (req: Request, res: Response) => {
    const user = getUser(req);
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const pwError = validatePasswordStrength(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const validRoles: Role[] = ['customer', 'groomer', 'receptionist', 'owner'];
    const assignedRole = validRoles.includes(role) ? role : 'groomer';

    if (assignedRole === 'owner' && user.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can create owner accounts' });
    }

    try {
        const id = crypto.randomUUID();
        const hash = bcrypt.hashSync(password, 10);
        db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(id, email, hash, assignedRole);
        logAudit(user.id, 'create', 'user', id, null, { email, role: assignedRole });
        res.json({ success: true, id, email, role: assignedRole });
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Failed to create staff' });
    }
});

router.put('/staff/:id/role', authenticateToken, requireOwner, (req: Request, res: Response) => {
    const user = getUser(req);
    const { role } = req.body;
    const validRoles: Role[] = ['customer', 'groomer', 'receptionist', 'owner'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const target = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.params.id) as Pick<UserRow, 'id' | 'email' | 'role'> | undefined;
    if (!target) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    logAudit(user.id, 'update_role', 'user', req.params.id, { role: target.role }, { role });
    res.json({ success: true, id: req.params.id, role });
});

export default router;
