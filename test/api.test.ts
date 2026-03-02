import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server/index.js';

const testToken = jwt.sign({ id: 'test-user', email: 'test@example.com' }, 'test-jwt-secret');

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
        const date = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const first = {
            id: crypto.randomUUID(),
            petName: 'Buddy',
            breed: 'Poodle',
            ownerName: 'Sam',
            service: 'Bath',
            date,
            duration: 60,
            status: 'scheduled',
            price: 50,
            avatar: ''
        };

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
});
