import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validateBody, serviceSchema, addOnSchema, serviceAddOnLinkSchema, clampLimit } from '../schema.js';

const router = Router();

// --- Services ---
router.get('/', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = clampLimit(req.query.limit as string);
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM services').get() as any).count;
    const services = db.prepare('SELECT * FROM services LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
        data: services,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
});

router.post('/', validateBody(serviceSchema), (req: any, res: any) => {
    const { name, description, duration, price, category, priceType, depositRequired, depositAmount, preBuffer, postBuffer, isOnlineBookable, isApprovalRequired, consentFormRequired, isActive } = req.body;
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO services (id, name, description, duration, price, category, priceType, depositRequired, depositAmount, preBuffer, postBuffer, isOnlineBookable, isApprovalRequired, consentFormRequired, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, name, description, duration, price, category, priceType || 'fixed', depositRequired ? 1 : 0, depositAmount || 0, preBuffer || 0, postBuffer || 0, isOnlineBookable !== false ? 1 : 0, isApprovalRequired ? 1 : 0, consentFormRequired ? 1 : 0, isActive !== false ? 1 : 0);
    logAudit(req.user?.id || null, 'create', 'service', id, null, req.body);
    res.json({ ...req.body, id });
});

router.put('/:id', validateBody(serviceSchema), (req: any, res: any) => {
    const { name, description, duration, price, category, priceType, depositRequired, depositAmount, preBuffer, postBuffer, isOnlineBookable, isApprovalRequired, consentFormRequired, isActive } = req.body;

    const old = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Service not found' });

    db.prepare('UPDATE services SET name=?, description=?, duration=?, price=?, category=?, priceType=?, depositRequired=?, depositAmount=?, preBuffer=?, postBuffer=?, isOnlineBookable=?, isApprovalRequired=?, consentFormRequired=?, isActive=? WHERE id=?')
        .run(name, description, duration, price, category, priceType || 'fixed', depositRequired ? 1 : 0, depositAmount || 0, preBuffer || 0, postBuffer || 0, isOnlineBookable !== false ? 1 : 0, isApprovalRequired ? 1 : 0, consentFormRequired ? 1 : 0, isActive !== false ? 1 : 0, req.params.id);
    logAudit(req.user?.id || null, 'update', 'service', req.params.id, old, req.body);
    res.json(req.body);
});

router.delete('/:id', requireAdmin, (req: any, res: any) => {
    const existing = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Service not found' });

    db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);
    logAudit(req.user.id, 'delete', 'service', req.params.id, null, null);
    res.json({ success: true });
});

// --- Service Add-on Links ---
router.get('/:id/add-ons', (req, res) => {
    const addOns = db.prepare(`
        SELECT a.* FROM add_ons a
        JOIN service_add_ons sa ON sa.addOnId = a.id
        WHERE sa.serviceId = ? AND a.isActive = 1
    `).all(req.params.id);
    res.json(addOns);
});

router.post('/:id/add-ons', validateBody(serviceAddOnLinkSchema), (req: any, res: any) => {
    const { addOnIds } = req.body;
    const del = db.prepare('DELETE FROM service_add_ons WHERE serviceId = ?');
    const ins = db.prepare('INSERT INTO service_add_ons (serviceId, addOnId) VALUES (?, ?)');
    db.transaction(() => {
        del.run(req.params.id);
        for (const addOnId of addOnIds) { ins.run(req.params.id, addOnId); }
    })();
    logAudit(req.user?.id || null, 'update', 'service_add_ons', req.params.id, null, { addOnIds });
    res.json({ success: true });
});

// --- Add-ons ---
export const addOnRouter = Router();

addOnRouter.get('/', (req, res) => {
    const addOns = db.prepare('SELECT * FROM add_ons WHERE isActive = 1').all();
    res.json(addOns);
});

addOnRouter.post('/', validateBody(addOnSchema), (req: any, res: any) => {
    const { name, description, price, duration, isOptional, isActive } = req.body;
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO add_ons (id, name, description, price, duration, isOptional, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, name, description || null, price || 0, duration || 0, isOptional !== false ? 1 : 0, isActive !== false ? 1 : 0);
    logAudit(req.user?.id || null, 'create', 'add_on', id, null, req.body);
    res.json({ ...req.body, id });
});

addOnRouter.put('/:id', validateBody(addOnSchema), (req: any, res: any) => {
    const { name, description, price, duration, isOptional, isActive } = req.body;
    const old = db.prepare('SELECT * FROM add_ons WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Add-on not found' });

    db.prepare(`UPDATE add_ons SET name=?, description=?, price=?, duration=?, isOptional=?, isActive=? WHERE id=?`)
        .run(name, description || null, price || 0, duration || 0, isOptional !== false ? 1 : 0, isActive !== false ? 1 : 0, req.params.id);
    logAudit(req.user?.id || null, 'update', 'add_on', req.params.id, old, req.body);
    res.json({ id: req.params.id, ...req.body });
});

addOnRouter.delete('/:id', (req: any, res: any) => {
    const old = db.prepare('SELECT * FROM add_ons WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Add-on not found' });

    db.prepare('UPDATE add_ons SET isActive = 0 WHERE id = ?').run(req.params.id);
    logAudit(req.user?.id || null, 'archive', 'add_on', req.params.id, old, null);
    res.json({ success: true });
});

export default router;
