import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { requireAdmin, getUser } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validateBody, customerSchema, tagsSchema, clampLimit } from '../schema.js';
import type { CustomerRow, PetRow, VaccinationRow, DocumentRow, WarningRow, BehavioralNoteRow, CountRow } from '../types.js';

interface PetInput { id?: string; name?: string; breed?: string; weight?: number; dob?: string; coatType?: string; behavioralNotes?: string[]; vaccinations?: VaxInput[]; }
interface VaxInput { name?: string; expiryDate?: string; status?: string; }
interface DocInput { id?: string; name?: string; type?: string; uploadDate?: string; url?: string; }

const escapeLike = (value: string) => value.replace(/[%_\\]/g, '\\$&');

/** Convert undefined to null (SQLite doesn't understand undefined). */
const noUndef = (val: unknown) => val === undefined ? null : val;

/** Group an array of items by a key function into a Record. */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of items) {
        const key = keyFn(item);
        (result[key] ??= []).push(item);
    }
    return result;
}

function hydrateCustomers(
    customerRows: CustomerRow[],
) {
    if (customerRows.length === 0) {
        return [];
    }

    const customerIds = customerRows.map((customer) => customer.id);
    const placeholders = customerIds.map(() => '?').join(',');

    const warnings = db.prepare(`SELECT customerId, warning FROM customer_warnings WHERE customerId IN (${placeholders})`).all(...customerIds) as WarningRow[];
    const pets = db.prepare(`SELECT * FROM pets WHERE customerId IN (${placeholders})`).all(...customerIds) as (PetRow & { behavioralNotes?: string[]; vaccinations?: VaccinationRow[] })[];
    const documents = db.prepare(`SELECT * FROM documents WHERE customerId IN (${placeholders})`).all(...customerIds) as DocumentRow[];

    const petIds = pets.map((pet) => pet.id);
    const petPlaceholders = petIds.map(() => '?').join(',');

    const behavioralNotes = petIds.length > 0
        ? db.prepare(`SELECT petId, note FROM pet_behavioral_notes WHERE petId IN (${petPlaceholders})`).all(...petIds) as BehavioralNoteRow[]
        : [];
    const vaccinations = petIds.length > 0
        ? db.prepare(`SELECT * FROM vaccinations WHERE petId IN (${petPlaceholders})`).all(...petIds) as VaccinationRow[]
        : [];

    const warningsByCustomer = groupBy(warnings, (warning) => warning.customerId);
    const notesByPet = groupBy(behavioralNotes, (note) => note.petId);
    const vaccinationsByPet = groupBy(vaccinations, (vaccination) => vaccination.petId);
    const documentsByCustomer = groupBy(documents, (document) => document.customerId);

    for (const pet of pets) {
        pet.behavioralNotes = (notesByPet[pet.id] || []).map((note) => note.note);
        pet.vaccinations = (vaccinationsByPet[pet.id] || []) as VaccinationRow[];
    }
    const petsByCustomer = groupBy(pets, (pet) => pet.customerId);

    return customerRows.map((customer) => ({
        ...customer,
        warnings: (warningsByCustomer[customer.id] || []).map((warning) => warning.warning),
        pets: petsByCustomer[customer.id] || [],
        documents: documentsByCustomer[customer.id] || [],
        emergencyContact: {
            name: customer.emergencyContactName,
            phone: customer.emergencyContactPhone,
        },
    }));
}

const router = Router();

router.get('/appointment-lookup', (req, res) => {
    const ownerName = String(req.query.ownerName || '').trim();
    const phone = String(req.query.phone || '').trim();
    const petName = String(req.query.petName || '').trim();
    const breed = String(req.query.breed || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 8, 1), 20);

    const filters = [
        ownerName.length >= 2 ? { clause: "c.name LIKE ? ESCAPE '\\'", value: `%${escapeLike(ownerName)}%` } : null,
        phone.length >= 2 ? { clause: "c.phone LIKE ? ESCAPE '\\'", value: `%${escapeLike(phone)}%` } : null,
        petName.length >= 2 ? { clause: "p.name LIKE ? ESCAPE '\\'", value: `%${escapeLike(petName)}%` } : null,
        breed.length >= 2 ? { clause: "p.breed LIKE ? ESCAPE '\\'", value: `%${escapeLike(breed)}%` } : null,
    ].filter(Boolean) as { clause: string; value: string }[];

    if (filters.length === 0) {
        return res.json([]);
    }

    const rows = db.prepare(`
        SELECT
            c.id as customerId,
            c.name as customerName,
            c.phone as customerPhone,
            c.email as customerEmail,
            c.address as customerAddress,
            c.notes as customerNotes,
            c.emergencyContactName,
            c.emergencyContactPhone,
            p.id as petId,
            p.name as petName,
            p.breed as petBreed,
            p.dob as petDob,
            p.coatType as petCoatType,
            p.photo as petPhoto
        FROM pets p
        INNER JOIN customers c ON c.id = p.customerId
        WHERE ${filters.map((filter) => filter.clause).join(' OR ')}
        ORDER BY c.name COLLATE NOCASE ASC, p.name COLLATE NOCASE ASC
        LIMIT ?
    `).all(...filters.map((filter) => filter.value), limit) as Array<{
        customerId: string;
        customerName: string;
        customerPhone: string | null;
        customerEmail: string | null;
        customerAddress: string | null;
        customerNotes: string | null;
        emergencyContactName: string | null;
        emergencyContactPhone: string | null;
        petId: string;
        petName: string;
        petBreed: string | null;
        petDob: string | null;
        petCoatType: string | null;
        petPhoto: string | null;
    }>;

    const petIds = rows.map((row) => row.petId);
    const noteRows = petIds.length > 0
        ? db.prepare(`SELECT petId, note FROM pet_behavioral_notes WHERE petId IN (${petIds.map(() => '?').join(',')})`).all(...petIds) as BehavioralNoteRow[]
        : [];
    const notesByPet = groupBy(noteRows, (note) => note.petId);

    res.json(rows.map((row) => ({
        ...row,
        petBehavioralNotes: (notesByPet[row.petId] || []).map((note) => note.note),
    })));
});

router.get('/', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = clampLimit(req.query.limit as string);
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as CountRow).count;
    const customerRows = db.prepare('SELECT * FROM customers LIMIT ? OFFSET ?').all(limit, offset) as CustomerRow[];
    if (customerRows.length === 0) {
        return res.json({
            data: customerRows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    }
    const customers = hydrateCustomers(customerRows);

    res.json({
        data: customers,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
});

router.get('/:id', (req, res) => {
    const customerRow = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id) as CustomerRow | undefined;
    if (!customerRow) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = hydrateCustomers([customerRow])[0];
    res.json(customer);
});

router.post('/', validateBody(customerSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const { name, email, phone, address, emergencyContact, notes, lastVisit, totalSpent, warnings, pets, documents } = req.body;
    const id = crypto.randomUUID();
    const savedPets = (pets || []).map((pet: PetInput) => ({
        ...pet,
        id: pet.id || crypto.randomUUID(),
    }));

    db.transaction(() => {
        db.prepare(`INSERT INTO customers (id, name, email, phone, address, emergencyContactName, emergencyContactPhone, notes, lastVisit, totalSpent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, noUndef(name), noUndef(email), noUndef(phone), noUndef(address), noUndef(emergencyContact?.name), noUndef(emergencyContact?.phone), noUndef(notes), noUndef(lastVisit), noUndef(totalSpent));

        const insertWarning = db.prepare('INSERT INTO customer_warnings (customerId, warning) VALUES (?, ?)');
        (warnings || []).forEach((w: string) => insertWarning.run(id, noUndef(w)));

        const insertPet = db.prepare('INSERT INTO pets (id, customerId, name, breed, weight, dob, coatType) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertBehavior = db.prepare('INSERT INTO pet_behavioral_notes (petId, note) VALUES (?, ?)');
        const insertVax = db.prepare('INSERT INTO vaccinations (petId, name, expiryDate, status) VALUES (?, ?, ?, ?)');

        savedPets.forEach((p: PetInput) => {
            const petId = p.id || crypto.randomUUID();
            insertPet.run(petId, id, noUndef(p.name), noUndef(p.breed), noUndef(p.weight), noUndef(p.dob), noUndef(p.coatType));
            (p.behavioralNotes || []).forEach((bn: string) => insertBehavior.run(petId, noUndef(bn)));
            (p.vaccinations || []).forEach((v: VaxInput) => insertVax.run(petId, noUndef(v.name), noUndef(v.expiryDate), noUndef(v.status)));
        });

        const insertDoc = db.prepare('INSERT INTO documents (id, customerId, name, type, uploadDate, url) VALUES (?, ?, ?, ?, ?, ?)');
        (documents || []).forEach((d: DocInput) => insertDoc.run(crypto.randomUUID(), id, noUndef(d.name), noUndef(d.type), noUndef(d.uploadDate), noUndef(d.url)));
    })();

    logAudit(user.id, 'create', 'customer', id, null, req.body);
    res.json({ ...req.body, id, pets: savedPets });
});

router.put('/:id', validateBody(customerSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const customerId = req.params.id;
    const { name, email, phone, address, emergencyContact, notes, lastVisit, totalSpent, warnings, pets, documents } = req.body;

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

    logAudit(user.id, 'update', 'customer', customerId, old, req.body);
    res.json(req.body);
});

router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
    const user = getUser(req);
    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id) as Pick<CustomerRow, 'id'> | undefined;
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
    logAudit(user.id, 'delete', 'customer', req.params.id, null, null);
    res.json({ success: true });
});

// --- Customer Tags ---
router.get('/:id/tags', (req, res) => {
    const tags = db.prepare('SELECT tag FROM customer_tags WHERE customerId = ?').all(req.params.id) as { tag: string }[];
    res.json(tags.map(t => t.tag));
});

router.post('/:id/tags', validateBody(tagsSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const { tags } = req.body;
    const del = db.prepare('DELETE FROM customer_tags WHERE customerId = ?');
    const ins = db.prepare('INSERT INTO customer_tags (customerId, tag) VALUES (?, ?)');
    db.transaction(() => {
        del.run(req.params.id);
        for (const tag of tags) { ins.run(req.params.id, tag); }
    })();
    logAudit(user.id, 'update', 'customer_tags', req.params.id, null, { tags });
    res.json({ success: true });
});

export default router;
