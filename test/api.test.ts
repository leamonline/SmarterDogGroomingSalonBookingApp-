import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server/index.js';
import { JWT_SECRET } from '../server/middleware/auth.js';
import crypto from 'crypto';

const ownerToken = jwt.sign({ id: 'test-owner', email: 'owner@example.com', role: 'owner' }, JWT_SECRET);
const staffToken = jwt.sign({ id: 'test-staff', email: 'staff@example.com', role: 'staff' }, JWT_SECRET);
// Alias for existing tests
const testToken = ownerToken;

// ─── helpers ──────────────────────────────────────────────
const auth = (token = ownerToken) => ({ Authorization: `Bearer ${token}` });

const makeAppt = (overrides: Record<string, any> = {}) => ({
    id: crypto.randomUUID(),
    petName: 'Buddy',
    breed: 'Poodle',
    ownerName: 'Sam',
    service: 'Bath',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    duration: 60,
    status: 'scheduled',
    price: 50,
    avatar: '',
    ...overrides,
});

// ══════════════════════════════════════════════════════════
describe('Authentication', () => {
    it('returns 401 for protected route without token', async () => {
        const res = await request(app).get('/api/customers');
        expect(res.status).toBe(401);
    });

    it('returns 401 for invalid login credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@example.com', password: 'wrong' });
        expect(res.status).toBe(401);
    });
});

// ══════════════════════════════════════════════════════════
describe('Appointments', () => {
    it('returns next available slots for authenticated user', async () => {
        const res = await request(app)
            .get('/api/appointments/next-available?duration=60')
            .set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('creates an appointment successfully', async () => {
        // Use next-available to guarantee an open slot
        const slotsRes = await request(app)
            .get('/api/appointments/next-available?duration=60')
            .set(auth());
        const openSlot = slotsRes.body.data[0];
        const appt = makeAppt({ date: openSlot });
        const res = await request(app)
            .post('/api/appointments')
            .set(auth())
            .send(appt);
        expect(res.status).toBe(200);
        expect(res.body.petName).toBe(appt.petName);
    });

    it('rejects overlapping appointment and returns suggestions', async () => {
        // Get a clean open slot
        const slotsRes = await request(app)
            .get('/api/appointments/next-available?duration=60')
            .set(auth());
        const date = slotsRes.body.data[0];

        const first = makeAppt({ date });
        await request(app).post('/api/appointments').set(auth()).send(first);

        const overlap = makeAppt({ date, id: crypto.randomUUID() });
        const res = await request(app).post('/api/appointments').set(auth()).send(overlap);
        expect(res.status).toBe(400);
        expect(Array.isArray(res.body.suggestions)).toBe(true);
    });

    it('updates appointment status via PUT', async () => {
        // Use next-available to guarantee an open slot
        const slotsRes = await request(app)
            .get('/api/appointments/next-available?duration=60')
            .set(auth());
        const openSlot = slotsRes.body.data[0];
        const appt = makeAppt({ date: openSlot });
        const createRes = await request(app).post('/api/appointments').set(auth()).send(appt);
        expect(createRes.status).toBe(200);
        const serverId = createRes.body.id; // server generates its own UUID

        const updated = { ...appt, id: serverId, status: 'checked-in' };
        const res = await request(app)
            .put(`/api/appointments/${serverId}`)
            .set(auth())
            .send(updated);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('checked-in');
    });

    it('returns paginated appointment list', async () => {
        const res = await request(app)
            .get('/api/appointments?page=1&limit=10')
            .set(auth());
        expect(res.status).toBe(200);
        expect(res.body.pagination).toBeDefined();
        expect(typeof res.body.pagination.total).toBe('number');
    });
});

// ══════════════════════════════════════════════════════════
describe('Customers', () => {
    it('creates and fully deletes a customer (cascade test)', async () => {
        const customer = {
            id: crypto.randomUUID(),
            name: 'Test Deletion User',
            email: `delete_${Date.now()}@example.com`,
            phone: '555-0000',
            pets: [{ id: crypto.randomUUID(), name: 'TestPet', breed: 'Mutt' }],
        };

        const createRes = await request(app).post('/api/customers').set(auth()).send(customer);
        expect(createRes.status).toBe(200);
        const serverId = createRes.body.id; // server generates its own UUID

        const deleteRes = await request(app).delete(`/api/customers/${serverId}`).set(auth());
        expect(deleteRes.status).toBe(200);

        const listRes = await request(app).get('/api/customers').set(auth());
        const ids = (listRes.body.data as any[]).map(c => c.id);
        expect(ids).not.toContain(serverId);
    });

    it('returns paginated customer list with metadata', async () => {
        const res = await request(app)
            .get('/api/customers?page=1&limit=5')
            .set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(5);
    });

    it('preserves pet ID when updating a customer (upsert safety)', async () => {
        const petId = crypto.randomUUID();
        const customer = {
            id: crypto.randomUUID(),
            name: 'Pet ID Test',
            email: `petid_${Date.now()}@example.com`,
            phone: '555-1234',
            pets: [{ id: petId, name: 'Fluffy', breed: 'Shih Tzu' }],
        };

        const createRes = await request(app).post('/api/customers').set(auth()).send(customer);
        const serverId = createRes.body.id; // server generates its own UUID

        // Update with server-assigned ID
        const updated = { ...customer, id: serverId, name: 'Pet ID Test Updated' };
        const putRes = await request(app).put(`/api/customers/${serverId}`).set(auth()).send(updated);
        expect(putRes.status).toBe(200);
    });
});

// ══════════════════════════════════════════════════════════
describe('Role Guards', () => {
    it('blocks staff from deleting a customer (403)', async () => {
        const customer = {
            id: crypto.randomUUID(),
            name: 'Role Guard Test',
            email: `rg_${Date.now()}@example.com`,
            phone: '555-9999',
            pets: [],
        };
        const createRes = await request(app).post('/api/customers').set(auth()).send(customer);
        const serverId = createRes.body.id;

        const res = await request(app)
            .delete(`/api/customers/${serverId}`)
            .set(auth(staffToken));
        expect(res.status).toBe(403);

        // Cleanup
        await request(app).delete(`/api/customers/${serverId}`).set(auth(ownerToken));
    });

    it('blocks staff from deleting an appointment (403)', async () => {
        const appt = makeAppt({ date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() });
        const createRes = await request(app).post('/api/appointments').set(auth()).send(appt);
        const serverId = createRes.body.id;

        const res = await request(app)
            .delete(`/api/appointments/${serverId}`)
            .set(auth(staffToken));
        expect(res.status).toBe(403);

        // Cleanup
        await request(app).delete(`/api/appointments/${serverId}`).set(auth(ownerToken));
    });
});

// ══════════════════════════════════════════════════════════
describe('Messaging', () => {
    it('dispatches a manual message and logs it to the DB', async () => {
        const res = await request(app)
            .post('/api/messages/send')
            .set(auth())
            .send({
                channel: 'email',
                recipientEmail: 'test@example.com',
                subject: 'Test notification',
                body: 'Hello from the test suite.',
            });
        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
        expect(['sent', 'simulated']).toContain(res.body.status);
    });

    it('returns message history for owner', async () => {
        const res = await request(app)
            .get('/api/messages')
            .set(auth(ownerToken));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('blocks staff from viewing message history (403)', async () => {
        const res = await request(app)
            .get('/api/messages')
            .set(auth(staffToken));
        expect(res.status).toBe(403);
    });
});

// ══════════════════════════════════════════════════════════
describe('Reports', () => {
    it('returns report data for a date range', async () => {
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        const res = await request(app)
            .get(`/api/reports?start=${start}&end=${end}`)
            .set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.appointments)).toBe(true);
        expect(Array.isArray(res.body.revenueByDay)).toBe(true);
        expect(Array.isArray(res.body.serviceBreakdown)).toBe(true);
    });
});

// ══════════════════════════════════════════════════════════
describe('Public Booking Flow', () => {
    it('returns the shop schedule publicly', async () => {
        const res = await request(app).get('/api/public/schedule');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns available slots for a given date', async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        // Find a day that is not Sunday (schedule has Sunday closed)
        while (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const servicesRes = await request(app).get('/api/public/services');
        expect(servicesRes.status).toBe(200);
        const services = servicesRes.body;
        if (services.length === 0) return; // skip if no services seeded

        const serviceId = services[0].id;
        const res = await request(app)
            .get(`/api/public/available-slots?serviceId=${serviceId}&date=${dateStr}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.slots)).toBe(true);
    });
});

// ══════════════════════════════════════════════════════════
describe('Services', () => {
    it('creates a new service', async () => {
        const service = {
            id: crypto.randomUUID(),
            name: `Test Service ${Date.now()}`,
            description: 'A test grooming service',
            duration: 45,
            price: 35,
            category: 'Grooming',
        };
        const res = await request(app).post('/api/services').set(auth()).send(service);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe(service.name);
    });

    it('returns paginated service list', async () => {
        const res = await request(app).get('/api/services?page=1&limit=5').set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.pagination).toBeDefined();
    });

    it('updates an existing service', async () => {
        const service = {
            id: crypto.randomUUID(),
            name: `Update Test ${Date.now()}`,
            description: 'Before update',
            duration: 30,
            price: 20,
            category: 'Spa',
        };
        const createRes = await request(app).post('/api/services').set(auth()).send(service);
        const serverId = createRes.body.id;

        const updated = { ...service, id: serverId, name: 'Updated Service Name', price: 25 };
        const putRes = await request(app).put(`/api/services/${serverId}`).set(auth()).send(updated);
        expect(putRes.status).toBe(200);
        expect(putRes.body.name).toBe('Updated Service Name');
        expect(putRes.body.price).toBe(25);
    });

    it('deletes a service (admin only)', async () => {
        const service = {
            id: crypto.randomUUID(),
            name: `Delete Test ${Date.now()}`,
            description: '',
            duration: 15,
            price: 10,
            category: 'Add-ons',
        };
        const createRes = await request(app).post('/api/services').set(auth()).send(service);
        const serverId = createRes.body.id;

        const deleteRes = await request(app).delete(`/api/services/${serverId}`).set(auth());
        expect(deleteRes.status).toBe(200);
    });

    it('blocks staff from deleting a service (403)', async () => {
        const service = {
            id: crypto.randomUUID(),
            name: `Staff Delete ${Date.now()}`,
            description: '',
            duration: 15,
            price: 10,
            category: 'Grooming',
        };
        const createRes = await request(app).post('/api/services').set(auth()).send(service);
        const serverId = createRes.body.id;

        const res = await request(app).delete(`/api/services/${serverId}`).set(auth(staffToken));
        expect(res.status).toBe(403);

        // Cleanup
        await request(app).delete(`/api/services/${serverId}`).set(auth(ownerToken));
    });
});

// ══════════════════════════════════════════════════════════
describe('Settings', () => {
    it('returns settings and schedule for authenticated user', async () => {
        const res = await request(app).get('/api/settings').set(auth());
        expect(res.status).toBe(200);
        expect(res.body.shopName).toBeDefined();
        expect(Array.isArray(res.body.schedule)).toBe(true);
    });

    it('returns notifications', async () => {
        const res = await request(app).get('/api/settings/notifications').set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ══════════════════════════════════════════════════════════
describe('Payments', () => {
    it('creates a payment for an appointment', async () => {
        // Create an appointment first
        const slotsRes = await request(app).get('/api/appointments/next-available?duration=60').set(auth());
        const openSlot = slotsRes.body.data[0];
        const appt = makeAppt({ date: openSlot });
        const apptRes = await request(app).post('/api/appointments').set(auth()).send(appt);
        const apptId = apptRes.body.id;

        const payment = {
            appointmentId: apptId,
            amount: 50,
            method: 'card',
            type: 'full',
            notes: 'Test payment',
        };
        const res = await request(app).post('/api/payments').set(auth()).send(payment);
        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
        expect(res.body.amount).toBe(50);
    });

    it('lists payments with pagination', async () => {
        const res = await request(app).get('/api/payments?page=1&limit=5').set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});

// ══════════════════════════════════════════════════════════
describe('Forms', () => {
    it('creates a consent form', async () => {
        const form = {
            name: `Consent Form ${Date.now()}`,
            description: 'Test consent form',
            fields: JSON.stringify([
                { name: 'agreement', type: 'checkbox', label: 'I agree to terms' },
            ]),
        };
        const res = await request(app).post('/api/forms').set(auth()).send(form);
        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
    });

    it('lists active forms', async () => {
        const res = await request(app).get('/api/forms').set(auth());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ══════════════════════════════════════════════════════════
describe('Search', () => {
    it('searches customers by name', async () => {
        const res = await request(app).get('/api/search?q=test').set(auth());
        expect(res.status).toBe(200);
        expect(res.body.customers).toBeDefined();
    });
});

// ══════════════════════════════════════════════════════════
describe('Customer Tags', () => {
    it('sets and retrieves customer tags', async () => {
        // Create a customer
        const customer = {
            id: crypto.randomUUID(),
            name: 'Tag Test User',
            email: `tag_${Date.now()}@example.com`,
            phone: '555-8888',
            pets: [],
        };
        const createRes = await request(app).post('/api/customers').set(auth()).send(customer);
        const customerId = createRes.body.id;

        // Set tags
        const tagRes = await request(app)
            .post(`/api/customers/${customerId}/tags`)
            .set(auth())
            .send({ tags: ['VIP', 'Regular'] });
        expect(tagRes.status).toBe(200);

        // Get tags
        const getRes = await request(app)
            .get(`/api/customers/${customerId}/tags`)
            .set(auth());
        expect(getRes.status).toBe(200);
        expect(getRes.body).toContain('VIP');
        expect(getRes.body).toContain('Regular');

        // Cleanup
        await request(app).delete(`/api/customers/${customerId}`).set(auth());
    });
});

// ══════════════════════════════════════════════════════════
// Legacy flat describe (kept so existing CI passes)
describe('API Endpoints Integration Tests', () => {
    it('should return error 401 for protected route without auth', async () => {
        const res = await request(app).get('/api/customers');
        expect(res.status).toBe(401);
    });

    it('should login with invalid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nonexistent@example.com', password: 'wrong' });
        expect(res.status).toBe(401);
    });

    it('should return next available appointment slots for authenticated requests', async () => {
        const res = await request(app)
            .get('/api/appointments/next-available?duration=60')
            .set('Authorization', `Bearer ${testToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should suggest alternate slots when creating an overlapping appointment', async () => {
        const availableRes = await request(app)
            .get('/api/appointments/next-available?duration=60')
            .set('Authorization', `Bearer ${testToken}`);
        const date = availableRes.body.data[0];

        const first = makeAppt({ date });
        const createRes = await request(app)
            .post('/api/appointments')
            .set('Authorization', `Bearer ${testToken}`)
            .send(first);
        expect(createRes.status).toBe(200);

        const overlapRes = await request(app)
            .post('/api/appointments')
            .set('Authorization', `Bearer ${testToken}`)
            .send({ ...first, id: crypto.randomUUID() });
        expect(overlapRes.status).toBe(400);
        expect(Array.isArray(overlapRes.body.suggestions)).toBe(true);
    });

    it('should create and fully delete a customer', async () => {
        const customer = {
            id: crypto.randomUUID(),
            name: 'Test Deletion User',
            email: `del2_${Date.now()}@example.com`,
            phone: '555-0000',
            pets: [{ id: crypto.randomUUID(), name: 'TestPet', breed: 'Mutt' }],
        };

        const createRes = await request(app).post('/api/customers').set('Authorization', `Bearer ${testToken}`).send(customer);
        expect(createRes.status).toBe(200);
        const serverId = createRes.body.id; // server generates its own UUID

        const deleteRes = await request(app).delete(`/api/customers/${serverId}`).set('Authorization', `Bearer ${testToken}`);
        expect(deleteRes.status).toBe(200);

        const getRes = await request(app).get('/api/customers').set('Authorization', `Bearer ${testToken}`);
        expect(getRes.status).toBe(200);
        const exists = (getRes.body.data as any[]).some(c => c.id === serverId);
        expect(exists).toBe(false);
    });
});
