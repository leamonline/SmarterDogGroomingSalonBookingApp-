import { Router } from 'express';
import db from '../db.js';
import { requireOwner } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validateBody, tagsSchema, clampLimit } from '../schema.js';

const router = Router();

// --- Search ---
router.get('/search', (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.json({ customers: [], pets: [], appointments: [] });

    const sanitized = q.replace(/[%_\\]/g, '\\$&');
    const queryLike = `%${sanitized}%`;

    const customers = db.prepare("SELECT * FROM customers WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\'").all(queryLike, queryLike, queryLike);
    const pets = db.prepare("SELECT * FROM pets WHERE name LIKE ? ESCAPE '\\' OR breed LIKE ? ESCAPE '\\'").all(queryLike, queryLike);
    const appointments = db.prepare("SELECT * FROM appointments WHERE petName LIKE ? ESCAPE '\\' OR ownerName LIKE ? ESCAPE '\\' OR service LIKE ? ESCAPE '\\'").all(queryLike, queryLike, queryLike);

    res.json({ customers, pets, appointments });
});

// --- Dog Tags ---
router.get('/dogs/:id/tags', (req, res) => {
    const tags = db.prepare('SELECT tag FROM dog_tags WHERE dogId = ?').all(req.params.id) as { tag: string }[];
    res.json(tags.map(t => t.tag));
});

router.post('/dogs/:id/tags', validateBody(tagsSchema), (req: any, res: any) => {
    const { tags } = req.body;
    const del = db.prepare('DELETE FROM dog_tags WHERE dogId = ?');
    const ins = db.prepare('INSERT INTO dog_tags (dogId, tag) VALUES (?, ?)');
    db.transaction(() => {
        del.run(req.params.id);
        for (const tag of tags) { ins.run(req.params.id, tag); }
    })();
    logAudit(req.user?.id || null, 'update', 'dog_tags', req.params.id, null, { tags });
    res.json({ success: true });
});

// --- Audit Log ---
router.get('/audit-log', requireOwner, (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = clampLimit(req.query.limit as string);
    const offset = (page - 1) * limit;
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;

    let query = 'SELECT * FROM audit_log';
    const params: any[] = [];
    const conditions: string[] = [];

    if (entityType) { conditions.push('entityType = ?'); params.push(entityType); }
    if (entityId) { conditions.push('entityId = ?'); params.push(entityId); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const total = (db.prepare(countQuery).get(...params) as any).count;

    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const entries = db.prepare(query).all(...params);
    res.json({
        data: entries,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
});

// --- Analytics ---
router.get('/analytics', (req, res) => {
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
router.get('/reports', (req, res) => {
    const { start, end } = req.query as { start?: string; end?: string };
    const startDate = start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end || new Date().toISOString();

    const appointments = db.prepare(`
        SELECT id, petName, ownerName, service, date, duration, status, price
        FROM appointments WHERE date BETWEEN ? AND ? ORDER BY date DESC
    `).all(startDate, endDate) as any[];

    const revenueByDay = db.prepare(`
        SELECT substr(date, 1, 10) as day, SUM(price) as revenue, COUNT(*) as count
        FROM appointments WHERE date BETWEEN ? AND ? AND status = 'completed'
        GROUP BY day ORDER BY day
    `).all(startDate, endDate) as any[];

    const serviceBreakdown = db.prepare(`
        SELECT service as name, COUNT(*) as count, SUM(price) as revenue
        FROM appointments WHERE date BETWEEN ? AND ? AND status = 'completed'
        GROUP BY service ORDER BY revenue DESC
    `).all(startDate, endDate) as any[];

    res.json({ appointments, revenueByDay, serviceBreakdown });
});

export default router;
