// env.ts MUST be the first import — it runs dotenv.config() so that
// process.env is populated before any other module reads it (ESM ordering).
import './env.js';

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import db from './db.js';

// Middleware
import { authenticateToken } from './middleware/auth.js';

// Route modules
import authRouter from './routes/auth.js';
import publicRouter from './routes/public.js';
import customersRouter from './routes/customers.js';
import appointmentsRouter from './routes/appointments.js';
import servicesRouter, { addOnRouter } from './routes/services.js';
import settingsRouter from './routes/settings.js';
import paymentsRouter from './routes/payments.js';
import formsRouter, { formSubmissionsRouter } from './routes/forms.js';
import reportsRouter from './routes/reports.js';
import messagingRouter from './routes/messaging.js';

const app = express();

// --- Global middleware ---
app.use(cors({
    origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000'),
    credentials: true,
}));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(express.json({ limit: '1mb' }));

// ══════════════════════════════════════════════
// Health check (no auth required)
// ══════════════════════════════════════════════
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ══════════════════════════════════════════════
// Rate limiter for public endpoints
// ══════════════════════════════════════════════
const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests from this IP, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ══════════════════════════════════════════════
// ROUTES — Public (no auth required)
// ══════════════════════════════════════════════
app.use('/api', authRouter);           // /api/auth/login, /api/auth/password, /api/auth/me, /api/staff
app.use('/api/public', publicLimiter, publicRouter);  // /api/public/services, /api/public/schedule, etc.

// ══════════════════════════════════════════════
// ROUTES — Authenticated (token required)
// ══════════════════════════════════════════════
app.use('/api', authenticateToken);    // Everything below requires a valid JWT

app.use('/api/customers', customersRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/add-ons', addOnRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/forms', formsRouter);
app.use('/api/form-submissions', formSubmissionsRouter); // backward-compatible path
app.use('/api', reportsRouter);        // /api/search, /api/dogs/:id/tags, /api/audit-log, /api/analytics, /api/reports
app.use('/api/messages', messagingRouter);

// ══════════════════════════════════════════════
// Global error handler — catches unhandled errors in routes
// ══════════════════════════════════════════════
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error('Unhandled route error:', err);
    } else {
        console.error('Unhandled route error:', err.message);
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error',
    });
});

// ══════════════════════════════════════════════
// Database backup (every 6 hours) with retention
// ══════════════════════════════════════════════
if (process.env.NODE_ENV !== 'test') {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '20');

    const pruneOldBackups = () => {
        try {
            const files = fs.readdirSync(backupDir)
                .filter(f => f.startsWith('database_backup_') && f.endsWith('.db'))
                .sort();
            while (files.length > MAX_BACKUPS) {
                const oldest = files.shift()!;
                fs.unlinkSync(path.join(backupDir, oldest));
                console.log(`Pruned old backup: ${oldest}`);
            }
        } catch (err) {
            console.error('Backup pruning failed:', err);
        }
    };

    setInterval(() => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `database_backup_${timestamp}.db`);
        try {
            db.backup(backupPath).then(() => {
                console.log(`Database backed up to ${backupPath}`);
                pruneOldBackups();
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
