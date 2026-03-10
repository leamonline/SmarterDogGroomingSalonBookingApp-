import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { getUser } from '../middleware/auth.js';
import { logAudit } from '../helpers/audit.js';
import { validateBody, tagsSchema, clampLimit } from '../schema.js';
import type {
    BehavioralNoteRow,
    CountRow,
    CustomerRow,
    PetRow,
    VaccinationRow,
    WarningRow,
} from '../types.js';

type DogListRow = PetRow & {
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    customerNotes: string | null;
    customerLastVisit: string | null;
    customerTotalSpent: number | null;
    appointmentCount: number;
    lastAppointmentDate: string | null;
};

type TagRow = {
    dogId: string;
    tag: string;
};

const escapeLike = (value: string) => value.replace(/[%_\\]/g, '\\$&');

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of items) {
        const key = keyFn(item);
        (result[key] ??= []).push(item);
    }
    return result;
}

function hydrateDogs(dogs: DogListRow[]) {
    if (dogs.length === 0) {
        return [];
    }

    const dogIds = dogs.map((dog) => dog.id);
    const placeholders = dogIds.map(() => '?').join(',');

    const behavioralNotes = db.prepare(`SELECT petId, note FROM pet_behavioral_notes WHERE petId IN (${placeholders})`).all(...dogIds) as BehavioralNoteRow[];
    const vaccinations = db.prepare(`SELECT * FROM vaccinations WHERE petId IN (${placeholders})`).all(...dogIds) as VaccinationRow[];
    const tags = db.prepare(`SELECT dogId, tag FROM dog_tags WHERE dogId IN (${placeholders})`).all(...dogIds) as TagRow[];

    const notesByDog = groupBy(behavioralNotes, (note) => note.petId);
    const vaccinationsByDog = groupBy(vaccinations, (vaccination) => vaccination.petId);
    const tagsByDog = groupBy(tags, (tag) => tag.dogId);

    return dogs.map((dog) => ({
        ...dog,
        behavioralNotes: (notesByDog[dog.id] || []).map((note) => note.note),
        vaccinations: vaccinationsByDog[dog.id] || [],
        tags: (tagsByDog[dog.id] || []).map((tag) => tag.tag),
    }));
}

const router = Router();

router.get('/', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = clampLimit(req.query.limit as string);
    const offset = (page - 1) * limit;
    const query = String(req.query.q || '').trim();

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (query) {
        const likeQuery = `%${escapeLike(query)}%`;
        conditions.push(`(
            p.name LIKE ? ESCAPE '\\'
            OR p.breed LIKE ? ESCAPE '\\'
            OR c.name LIKE ? ESCAPE '\\'
            OR c.phone LIKE ? ESCAPE '\\'
        )`);
        params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (db.prepare(`
        SELECT COUNT(DISTINCT p.id) as count
        FROM pets p
        INNER JOIN customers c ON c.id = p.customerId
        ${whereClause}
    `).get(...params) as CountRow).count;

    const rows = db.prepare(`
        SELECT
            p.*,
            c.name as customerName,
            c.email as customerEmail,
            c.phone as customerPhone,
            c.address as customerAddress,
            c.emergencyContactName,
            c.emergencyContactPhone,
            c.notes as customerNotes,
            c.lastVisit as customerLastVisit,
            c.totalSpent as customerTotalSpent,
            COUNT(a.id) as appointmentCount,
            MAX(a.date) as lastAppointmentDate
        FROM pets p
        INNER JOIN customers c ON c.id = p.customerId
        LEFT JOIN appointments a
            ON a.dogId = p.id
            OR (a.dogId IS NULL AND a.customerId = p.customerId AND a.petName = p.name)
        ${whereClause}
        GROUP BY p.id
        ORDER BY MAX(a.date) DESC, p.name COLLATE NOCASE ASC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as DogListRow[];

    res.json({
        data: hydrateDogs(rows),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
});

router.get('/:id', (req, res) => {
    const dogRow = db.prepare(`
        SELECT
            p.*,
            c.name as customerName,
            c.email as customerEmail,
            c.phone as customerPhone,
            c.address as customerAddress,
            c.emergencyContactName,
            c.emergencyContactPhone,
            c.notes as customerNotes,
            c.lastVisit as customerLastVisit,
            c.totalSpent as customerTotalSpent,
            COUNT(a.id) as appointmentCount,
            MAX(a.date) as lastAppointmentDate
        FROM pets p
        INNER JOIN customers c ON c.id = p.customerId
        LEFT JOIN appointments a
            ON a.dogId = p.id
            OR (a.dogId IS NULL AND a.customerId = p.customerId AND a.petName = p.name)
        WHERE p.id = ?
        GROUP BY p.id
    `).get(req.params.id) as DogListRow | undefined;

    if (!dogRow) {
        return res.status(404).json({ error: 'Dog not found' });
    }

    const dog = hydrateDogs([dogRow])[0];
    const customerWarnings = db.prepare('SELECT customerId, warning FROM customer_warnings WHERE customerId = ?').all(dog.customerId) as WarningRow[];
    const customerRow = db.prepare('SELECT * FROM customers WHERE id = ?').get(dog.customerId) as CustomerRow | undefined;
    const recentAppointments = db.prepare(`
        SELECT *
        FROM appointments
        WHERE dogId = ?
            OR (dogId IS NULL AND customerId = ? AND petName = ?)
        ORDER BY date DESC
        LIMIT 10
    `).all(dog.id, dog.customerId, dog.name);

    res.json({
        ...dog,
        customer: customerRow ? {
            ...customerRow,
            warnings: customerWarnings.map((warning) => warning.warning),
            emergencyContact: {
                name: customerRow.emergencyContactName,
                phone: customerRow.emergencyContactPhone,
            },
        } : null,
        recentAppointments,
    });
});

router.get('/:id/tags', (req, res) => {
    const tags = db.prepare('SELECT tag FROM dog_tags WHERE dogId = ?').all(req.params.id) as { tag: string }[];
    res.json(tags.map((tag) => tag.tag));
});

router.post('/:id/tags', validateBody(tagsSchema), (req: Request, res: Response) => {
    const user = getUser(req);
    const { tags } = req.body;
    const del = db.prepare('DELETE FROM dog_tags WHERE dogId = ?');
    const ins = db.prepare('INSERT INTO dog_tags (dogId, tag) VALUES (?, ?)');
    db.transaction(() => {
        del.run(req.params.id);
        for (const tag of tags) {
            ins.run(req.params.id, tag);
        }
    })();
    logAudit(user.id, 'update', 'dog_tags', req.params.id, null, { tags });
    res.json({ success: true });
});

export default router;
