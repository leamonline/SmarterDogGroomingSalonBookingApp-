import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Validation middleware
export const validateBody = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Validation failed', details: error.issues });
            }
            return res.status(400).json({ error: 'Invalid input' });
        }
    };
};

// Customer Schema
const petSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional().nullable(),
    breed: z.string().optional().nullable(),
    weight: z.number().optional().nullable(),
    dob: z.string().optional().nullable(),
    coatType: z.string().optional().nullable(),
    behavioralNotes: z.array(z.string()).optional(),
    vaccinations: z.array(z.any()).optional(),
}).passthrough();

export const customerSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    emergencyContact: z.object({
        name: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
    }).optional().nullable(),
    notes: z.string().optional().nullable(),
    lastVisit: z.string().optional().nullable(),
    totalSpent: z.number().optional().nullable(),
    warnings: z.array(z.string()).optional(),
    pets: z.array(petSchema).optional(),
    documents: z.array(z.any()).optional(),
}).passthrough();

// Appointment Schema
export const appointmentSchema = z.object({
    id: z.string().optional(),
    petName: z.string().optional().nullable(),
    breed: z.string().optional().nullable(),
    ownerName: z.string().optional().nullable(),
    service: z.string().optional().nullable(),
    date: z.string().min(1, "Date is required"),
    duration: z.number().min(1, "Duration is required"),
    status: z.string().optional().nullable(),
    price: z.number().optional().nullable(),
    avatar: z.string().optional().nullable(),
}).passthrough();

// Service Schema
export const serviceSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    duration: z.number().optional().nullable(),
    price: z.number().optional().nullable(),
    category: z.string().optional().nullable(),
}).passthrough();

// Settings Schema
export const settingsSchema = z.object({
    shopName: z.string().optional().nullable(),
    shopPhone: z.string().optional().nullable(),
    shopAddress: z.string().optional().nullable(),
    schedule: z.array(
        z.object({
            day: z.string(),
            openTime: z.string().optional().nullable(),
            closeTime: z.string().optional().nullable(),
            isClosed: z.boolean().optional().nullable(),
        })
    ).optional(),
}).passthrough();
