import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validateBody, customerSchema, tagsSchema, clampLimit } from '../schema.js';
import type { CustomerRow, PetRow, VaccinationRow, DocumentRow, WarningRow, BehavioralNoteRow, CountRow } from '../types.js';

interface PetInput { id?: string; name?: string; breed?: string; weight?: number; dob?: string; coatType?: string; behavioralNotes?: string[]; vaccinations?: VaxInput[]; }
interface VaxInput { name?: string; expiryDate?: string; status?: string; }
interface DocInput { id?: string; name?: string; type?: string; uploadDate?: string; url?: string; }

const router = Router();

router.get('/', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = clampLimit(req.query.limit as string);
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as CountRow).count;
    const customers = db.prepare('SELECT * FROM customers LIMIT ? OFFSET ?').all(limit, offset) as (CustomerRow & { warnings?: string[]; pets?: (PetRow & { behavioralNotes?: string[]; vaccinations?: VaccinationRow[] })[]; documents?: DocumentRow[]; emergencyContact?: { name: string | null; phone: string | null } })[];
    if (customers.length === 0) {
        return res.json({
            data: customers,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    }

    const customerIds = customers.map(c => c.id);
    const placeholders = customerIds.map(() => '?').join(',');

    const warnings = db.prepare(`SELECT customerId, warning FROM customer_warnings WHERE customerId IN (${placeholders})`).all(...customerIds) as WarningRow[];
    const pets = db.prepare(`SELECT * FROM pets WHERE customerId IN (${placeholders})`).all(...customerIds) as (PetRow & { behavioralNotes?: string[]; vaccinations?: VaccinationRow[] })[];
    const documents = db.prepare(`SELECT * FROM documents WHERE customerId IN (${placeholders})`).all(...customerIds) as DocumentRow[];

    const petIds = pets.map(p => p.id);
    const petPlaceholders = petIds.map(() => '?').join(',');

    const behavioralNotes = petIds.length > 0
        ? db.prepare(`SELECT petId, note FROM pet_behavioral_notes WHERE petId IN (${petPlaceholders})`).all(...petIds) as BehavioralNoteRow[]
        : [];
    const vaccinations = petIds.length > 0
        ? db.prepare(`SELECT * FROM vaccinations WHERE petId IN (${petPlaceholders})`).all(...petIds) as VaccinationRow[]
        : [];

    const warningsByCustomer: Record<string, string[]> = {};
    for (const w of warnings) { warningsByCustomer[w.customerId] = warningsByCustomer[w.customerId] || []; warningsByCustomer[w.customerId].push(w.warning); }

    const notesByPet: Record<string, string[]> = {};
    for (const n of behavioralNotes) { notesByPet[n.petId] = notesByPet[n.petId] || []; notesByPet[n.petId].push(n.note); }

    const vaxByPet: Record<string, VaccinationRow[]> = {};
    for (const v of vaccinations) { vaxByPet[v.petId] = vaxByPet[v.petId] || []; vaxByPet[v.petId].push(v); }

    const petsByCustomer: Record<string, (PetRow & { behavioralNotes?: string[]; vaccinations?: VaccinationRow[] })[]> = {};
    for (const p of pets) {
        p.behavioralNotes = notesByPet[p.id] || [];
        p.vaccinations = vaxByPet[p.id] || [];
        petsByCustomer[p.customerId] = petsByCustomer[p.customerId] || [];
        petsByCustomer[p.customerId].push(p);
    }

    const docsByCustomer: Record<string, DocumentRow[]> = {};
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

router.post('/', validateBody(customerSchema), (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { name, email, phone, address, emergencyContact, notes, lastVisit, totalSpent, warnings, pets, documents } = req.body;
    const id = crypto.randomUUID();
    const noUndef = (val: unknown) => val === undefined ? null : val;

    db.transaction(() => {
        db.prepare(`INSERT INTO customers (id, name, email, phone, address, emergencyContactName, emergencyContactPhone, notes, lastVisit, totalSpent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, noUndef(name), noUndef(email), noUndef(phone), noUndef(address), noUndef(emergencyContact?.name), noUndef(emergencyContact?.phone), noUndef(notes), noUndef(lastVisit), noUndef(totalSpent));

        const insertWarning = db.prepare('INSERT INTO customer_warnings (customerId, warning) VALUES (?, ?)');
        (warnings || []).forEach((w: string) => insertWarning.run(id, noUndef(w)));

        const insertPet = db.prepare('INSERT INTO pets (id, customerId, name, breed, weight, dob, coatType) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertBehavior = db.prepare('INSERT INTO pet_behavioral_notes (petId, note) VALUES (?, ?)');
        const insertVax = db.prepare('INSERT INTO vaccinations (petId, name, expiryDate, status) VALUES (?, ?, ?, ?)');

        (pets || []).forEach((p: PetInput) => {
            const petId = crypto.randomUUID();
            insertPet.run(petId, id, noUndef(p.name), noUndef(p.breed), noUndef(p.weight), noUndef(p.dob), noUndef(p.coatType));
            (p.behavioralNotes || []).forEach((bn: string) => insertBehavior.run(petId, noUndef(bn)));
            (p.vaccinations || []).forEach((v: VaxInput) => insertVax.run(petId, noUndef(v.name), noUndef(v.expiryDate), noUndef(v.status)));
        });

        const insertDoc = db.prepare('INSERT INTO documents (id, customerId, name, type, uploadDate, url) VALUES (?, ?, ?, ?, ?, ?)');
        (documents || []).forEach((d: DocInput) => insertDoc.run(crypto.randomUUID(), id, noUndef(d.name), noUndef(d.type), noUndef(d.uploadDate), noUndef(d.url)));
    })();

    logAudit(authReq.user?.id || null, 'create', 'customer', id, null, req.body);
    res.json({ ...req.body, id });
});

router.put('/:id', validateBody(customerSchema), (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const customerId = req.params.id;
    const { name, email, phone, address, emergencyContact, notes, lastVisit, totalSpent, warnings, pets, documents } = req.body;
    const noUndef = (val: unknown) => val === undefined ? null : val;

    const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as CustomerRow | undefined;
    if (!old) return res.status(404).json({ error: 'Customer not found' });

    db.transaction(() => {
        db.prepare(`UPDATE customers SET name=?, email=?, phone=?, address=?, emergencyContactName=?, emergencyContactPhone=?, notes=?, lastVisit=?, totalSpent=? WHERE id=?`)
            .run(noUndef(name), noUndef(email), noUndef(phone), noUndef(address), noUndef(emergencyContact?.name), noUndef(emergencyContact?.phone), noUndef(notes), noUndef(lastVisit), noUndef(totalSpent), noUndef(customerId));

        db.prepare('DELETE FROM customer_warnings WHERE customerId = ?').run(customerId);
        const insertWarning = db.prepare('INSERT INTO customer_warnings (customerId, warning) VALUES (?, ?)');
        (warnings || []).forEach((w: string) => insertWarning.run(customerId, noUndef(w)));

        const incomingPetIds = (pets || []).map((p: PetInput) => p.id).filter(Boolean);
        if (incomingPetIds.length > 0) {
            const placeholders = incomingPetIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM pets WHERE customerId = ? AND id NOT IN (${placeholders})`).run(customerId, ...incomingPetIds);
        } else {
            db.prepare('DELETE FROM pets WHERE customerId = ?').run(customerId);
        }

        const upsertPet = db.prepare(`INSERT INTO pets (id, customerId, name, breed, weight, dob, coatType) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, breed=excluded.breed, weight=excluded.weight, dob=excluded.dob, coatType=excluded.coatType`);
        const deleteBehavior = db.prepare('DELETE FROM pet_behavioral_notes WHERE petId = ?');
        const insertBehavior = db.prepare('INSERT INTO pet_behavioral_notes (petId, note) VALUES (?, ?)');
        const deleteVax = db.prepare('DELETE FROM vaccinations WHERE petId = ?');
        const insertVax = db.prepare('INSERT INTO vaccinations (petId, name, expiryDate, status) VALUES (?, ?, ?, ?)');

        (pets || []).forEach((p: PetInput) => {
            upsertPet.run(noUndef(p.id), noUndef(customerId), noUndef(p.name), noUndef(p.breed), noUndef(p.weight), noUndef(p.dob), noUndef(p.coatType));
            deleteBehavior.run(noUndef(p.id));
            (p.behavioralNotes || []).forEach((bn: string) => insertBehavior.run(noUndef(p.id), noUndef(bn)));
            deleteVax.run(noUndef(p.id));
            (p.vaccinations || []).forEach((v: VaxInput) => insertVax.run(noUndef(p.id), noUndef(v.name), noUndef(v.expiryDate), noUndef(v.status)));
        });

        db.prepare('DELETE FROM documents WHERE customerId = ?').run(customerId);
        const insertDoc = db.prepare('INSERT INTO documents (id, customerId, name, type, uploadDate, url) VALUES (?, ?, ?, ?, ?, ?)');
        (documents || []).forEach((d: DocInput) => insertDoc.run(noUndef(d.id), noUndef(customerId), noUndef(d.name), noUndef(d.type), noUndef(d.uploadDate), noUndef(d.url)));
    })();

    logAudit(authReq.user?.id || null, 'update', 'customer', customerId, old, req.body);
    res.json(req.body);
});

router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id) as Pick<CustomerRow, 'id'> | undefined;
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
    logAudit(authReq.user.id, 'delete', 'customer', req.params.id, null, null);
    res.json({ success: true });
});

// --- Customer Tags ---
router.get('/:id/tags', (req, res) => {
    const tags = db.prepare('SELECT tag FROM customer_tags WHERE customerId = ?').all(req.params.id) as { tag: string }[];
    res.json(tags.map(t => t.tag));
});

router.post('/:id/tags', validateBody(tagsSchema), (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { tags } = req.body;
    const del = db.prepare('DELETE FROM customer_tags WHERE customerId = ?');
    const ins = db.prepare('INSERT INTO customer_tags (customerId, tag) VALUES (?, ?)');
    db.transaction(() => {
        del.run(req.params.id);
        for (const tag of tags) { ins.run(req.params.id, tag); }
    })();
    logAudit(authReq.user?.id || null, 'update', 'customer_tags', req.params.id, null, { tags });
    res.json({ success: true });
});

export default router;
