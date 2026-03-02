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

// ── Shared enums ──

const toleranceLevel = z.enum(['good', 'fair', 'poor', 'unknown']).optional().nullable();

const appointmentStatus = z.enum([
    'pending-approval', 'confirmed', 'deposit-pending', 'deposit-paid',
    'checked-in', 'in-progress', 'ready-for-collection', 'completed',
    'cancelled-by-customer', 'cancelled-by-salon', 'no-show', 'rescheduled',
    'incomplete', 'incident-review', 'scheduled'
]).optional().nullable();

const paymentMethod = z.enum(['card', 'cash', 'bank-transfer']);
const paymentType = z.enum(['deposit', 'full', 'partial', 'refund', 'partial-refund']);
const priceType = z.enum(['fixed', 'variable', 'from']).optional().nullable();

// ── Pet Schema ──

const petSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional().nullable(),
    breed: z.string().optional().nullable(),
    weight: z.number().optional().nullable(),
    dob: z.string().optional().nullable(),
    coatType: z.string().optional().nullable(),
    behavioralNotes: z.array(z.string()).optional(),
    vaccinations: z.array(z.any()).optional(),
    // Sprint 1 expanded fields
    photo: z.string().optional().nullable(),
    sex: z.string().optional().nullable(),
    neuteredStatus: z.string().optional().nullable(),
    coatLength: z.string().optional().nullable(),
    colour: z.string().optional().nullable(),
    vetName: z.string().optional().nullable(),
    vetPhone: z.string().optional().nullable(),
    sizeCategory: z.string().optional().nullable(),
    estimatedGroomDuration: z.number().optional().nullable(),
    dryingTolerance: toleranceLevel,
    clipperTolerance: toleranceLevel,
    scissorTolerance: toleranceLevel,
    nailTrimTolerance: toleranceLevel,
    mattingTendency: z.string().optional().nullable(),
    medicalNotes: z.string().optional().nullable(),
    allergies: z.string().optional().nullable(),
    mobilityNotes: z.string().optional().nullable(),
    seniorCareNotes: z.string().optional().nullable(),
    biteRisk: z.string().optional().nullable(),
    approvalRequired: z.boolean().optional().nullable(),
    stylePreferences: z.string().optional().nullable(),
    isArchived: z.boolean().optional().nullable(),
    tags: z.array(z.string()).optional(),
}).passthrough();

// ── Customer Schema ──

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
    // Sprint 1 expanded fields
    preferredName: z.string().optional().nullable(),
    postcode: z.string().optional().nullable(),
    preferredContact: z.enum(['email', 'phone', 'sms']).optional().nullable(),
    marketingConsent: z.boolean().optional().nullable(),
    tags: z.array(z.string()).optional(),
}).passthrough();

// ── Appointment Schema ──

export const appointmentSchema = z.object({
    id: z.string().optional(),
    petName: z.string().optional().nullable(),
    breed: z.string().optional().nullable(),
    ownerName: z.string().optional().nullable(),
    service: z.string().optional().nullable(),
    date: z.string().min(1, "Date is required"),
    duration: z.number().min(1, "Duration is required"),
    status: appointmentStatus,
    price: z.number().optional().nullable(),
    avatar: z.string().optional().nullable(),
    // Sprint 1 expanded fields
    customerId: z.string().optional().nullable(),
    dogId: z.string().optional().nullable(),
    staffId: z.string().optional().nullable(),
    depositAmount: z.number().optional().nullable(),
    depositPaid: z.boolean().optional().nullable(),
    cancelledAt: z.string().optional().nullable(),
    cancelledBy: z.string().optional().nullable(),
    cancellationReason: z.string().optional().nullable(),
    checkedInAt: z.string().optional().nullable(),
    checkedInNotes: z.string().optional().nullable(),
    groomNotes: z.string().optional().nullable(),
    productsUsed: z.string().optional().nullable(),
    behaviourDuringGroom: z.string().optional().nullable(),
    completedAt: z.string().optional().nullable(),
    aftercareNotes: z.string().optional().nullable(),
    readyForCollectionAt: z.string().optional().nullable(),
    surcharge: z.number().optional().nullable(),
    surchargeReason: z.string().optional().nullable(),
    finalPrice: z.number().optional().nullable(),
    beforePhotos: z.string().optional().nullable(),
    afterPhotos: z.string().optional().nullable(),
}).passthrough();

// ── Service Schema ──

export const serviceSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    duration: z.number().optional().nullable(),
    price: z.number().optional().nullable(),
    category: z.string().optional().nullable(),
    // Sprint 1 expanded fields
    isOnlineBookable: z.boolean().optional().nullable(),
    isApprovalRequired: z.boolean().optional().nullable(),
    depositRequired: z.boolean().optional().nullable(),
    depositAmount: z.number().optional().nullable(),
    consentFormRequired: z.boolean().optional().nullable(),
    preBuffer: z.number().optional().nullable(),
    postBuffer: z.number().optional().nullable(),
    priceType: priceType,
    isActive: z.boolean().optional().nullable(),
}).passthrough();

// ── Add-on Schema ──

export const addOnSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    price: z.number().optional().nullable(),
    duration: z.number().optional().nullable(),
    isOptional: z.boolean().optional().nullable(),
    isActive: z.boolean().optional().nullable(),
}).passthrough();

// ── Payment Schema ──

export const paymentSchema = z.object({
    id: z.string().optional(),
    appointmentId: z.string().min(1, "Appointment is required"),
    customerId: z.string().optional().nullable(),
    amount: z.number().min(0, "Amount must be positive"),
    method: paymentMethod,
    type: paymentType,
    status: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
}).passthrough();

// ── Form Schema ──

export const formSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    version: z.number().optional().nullable(),
    fields: z.string().min(1, "Fields JSON is required"),
    isActive: z.boolean().optional().nullable(),
}).passthrough();

// ── Form Submission Schema ──

export const formSubmissionSchema = z.object({
    id: z.string().optional(),
    formId: z.string().min(1, "Form ID is required"),
    customerId: z.string().optional().nullable(),
    dogId: z.string().optional().nullable(),
    appointmentId: z.string().optional().nullable(),
    data: z.string().min(1, "Data JSON is required"),
    signature: z.string().optional().nullable(),
}).passthrough();

// ── Settings Schema ──

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
