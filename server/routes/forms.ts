import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUser } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validateBody, formSchema, formSubmissionSchema } from '../schema.js';

const router = Router();

// --- Forms ---
router.get('/', (req, res) => {
    const forms = db.prepare('SELECT * FROM forms WHERE isActive = 1 ORDER BY createdAt DESC').all();
    res.json(forms);
});

router.post('/', validateBody(formSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const { name, description, version, fields, isActive } = req.body;
    const id = crypto.randomUUID(); // Always generate server-side
    const createdAt = new Date().toISOString();
    db.prepare(`INSERT INTO forms (id, name, description, version, fields, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, name, description || null, version || 1, fields, isActive !== false ? 1 : 0, createdAt);
    logAudit(user.id, 'create', 'form', id, null, req.body);
    res.json({ ...req.body, id, createdAt });
});

router.put('/:id', validateBody(formSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const { name, description, version, fields, isActive } = req.body;
    const old = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    db.prepare(`UPDATE forms SET name=?, description=?, version=?, fields=?, isActive=?, updatedAt=? WHERE id=?`)
        .run(name, description || null, version || 1, fields, isActive !== false ? 1 : 0, new Date().toISOString(), req.params.id);
    logAudit(user.id, 'update', 'form', req.params.id, old, req.body);
    res.json({ id: req.params.id, ...req.body });
});

// --- Form Submissions (separate router for backward-compatible /api/form-submissions path) ---
export const formSubmissionsRouter = Router();

formSubmissionsRouter.get('/', (req, res) => {
    const { formId, customerId, dogId, appointmentId } = req.query;
    let query = 'SELECT * FROM form_submissions';
    const params: string[] = [];
    const conditions: string[] = [];
    if (formId) { conditions.push('formId = ?'); params.push(formId as string); }
    if (customerId) { conditions.push('customerId = ?'); params.push(customerId as string); }
    if (dogId) { conditions.push('dogId = ?'); params.push(dogId as string); }
    if (appointmentId) { conditions.push('appointmentId = ?'); params.push(appointmentId as string); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY submittedAt DESC';
    const submissions = db.prepare(query).all(...params);
    res.json(submissions);
});

formSubmissionsRouter.post('/', validateBody(formSubmissionSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const { formId, customerId, dogId, appointmentId, data, signature } = req.body;
    const id = crypto.randomUUID(); // Always generate server-side
    const submittedAt = new Date().toISOString();
    db.prepare(`INSERT INTO form_submissions (id, formId, customerId, dogId, appointmentId, data, signature, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, formId, customerId || null, dogId || null, appointmentId || null, data, signature || null, submittedAt);
    logAudit(user.id, 'create', 'form_submission', id, null, req.body);
    res.json({ ...req.body, id, submittedAt });
});

export default router;
