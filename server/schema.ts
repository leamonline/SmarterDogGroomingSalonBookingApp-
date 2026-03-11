import { z } from "zod";
import { Request, Response, NextFunction } from "express";

// ── Global constants ──

/** Maximum items any paginated endpoint can return in one request. */
export const MAX_PAGE_LIMIT = 100;

/** Maximum length for free-text fields (notes, descriptions, etc.) */
const MAX_TEXT = 5000;

/** Maximum length for short fields (names, emails, etc.) */
const MAX_SHORT = 500;

// ── Helpers ──

/** Clamp `limit` query param to [1, MAX_PAGE_LIMIT]. */
export const clampLimit = (raw: string | undefined, fallback = 50) =>
  Math.min(Math.max(parseInt(raw as string) || fallback, 1), MAX_PAGE_LIMIT);

// Validation middleware
export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.issues });
      }
      return res.status(400).json({ error: "Invalid input" });
    }
  };
};

// ── Shared enums ──

const toleranceLevel = z.enum(["good", "fair", "poor", "unknown"]).optional().nullable();

const appointmentStatus = z
  .enum([
    "pending-approval",
    "confirmed",
    "deposit-pending",
    "deposit-paid",
    "checked-in",
    "in-progress",
    "ready-for-collection",
    "completed",
    "cancelled-by-customer",
    "cancelled-by-salon",
    "no-show",
    "rescheduled",
    "incomplete",
    "incident-review",
    "scheduled",
  ])
  .optional()
  .nullable();

const paymentMethod = z.enum(["card", "cash", "bank-transfer"]);
const paymentType = z.enum(["deposit", "full", "partial", "refund", "partial-refund"]);
const priceType = z.enum(["fixed", "variable", "from"]).optional().nullable();

// ── Pet Schema ──

const petSchema = z
  .object({
    id: z.string().max(MAX_SHORT).optional(),
    name: z.string().max(MAX_SHORT).optional().nullable(),
    breed: z.string().max(MAX_SHORT).optional().nullable(),
    weight: z.number().optional().nullable(),
    dob: z.string().max(MAX_SHORT).optional().nullable(),
    coatType: z.string().max(MAX_SHORT).optional().nullable(),
    behavioralNotes: z.array(z.string().max(MAX_TEXT)).max(50).optional(),
    vaccinations: z.array(z.any()).max(50).optional(),
    photo: z.string().max(MAX_TEXT).optional().nullable(),
    sex: z.string().max(MAX_SHORT).optional().nullable(),
    neuteredStatus: z.string().max(MAX_SHORT).optional().nullable(),
    coatLength: z.string().max(MAX_SHORT).optional().nullable(),
    colour: z.string().max(MAX_SHORT).optional().nullable(),
    vetName: z.string().max(MAX_SHORT).optional().nullable(),
    vetPhone: z.string().max(MAX_SHORT).optional().nullable(),
    sizeCategory: z.string().max(MAX_SHORT).optional().nullable(),
    estimatedGroomDuration: z.number().optional().nullable(),
    dryingTolerance: toleranceLevel,
    clipperTolerance: toleranceLevel,
    scissorTolerance: toleranceLevel,
    nailTrimTolerance: toleranceLevel,
    mattingTendency: z.string().max(MAX_SHORT).optional().nullable(),
    medicalNotes: z.string().max(MAX_TEXT).optional().nullable(),
    allergies: z.string().max(MAX_TEXT).optional().nullable(),
    mobilityNotes: z.string().max(MAX_TEXT).optional().nullable(),
    seniorCareNotes: z.string().max(MAX_TEXT).optional().nullable(),
    biteRisk: z.string().max(MAX_SHORT).optional().nullable(),
    approvalRequired: z.boolean().optional().nullable(),
    stylePreferences: z.string().max(MAX_TEXT).optional().nullable(),
    isArchived: z.boolean().optional().nullable(),
    tags: z.array(z.string().max(MAX_SHORT)).max(50).optional(),
  })
  .strip();

// ── Customer Schema ──

export const customerSchema = z
  .object({
    id: z.string().max(MAX_SHORT).optional(),
    name: z.string().min(1, "Name is required").max(MAX_SHORT),
    email: z.string().max(MAX_SHORT).optional().nullable(),
    phone: z.string().max(MAX_SHORT).optional().nullable(),
    address: z.string().max(MAX_TEXT).optional().nullable(),
    emergencyContact: z
      .object({
        name: z.string().max(MAX_SHORT).optional().nullable(),
        phone: z.string().max(MAX_SHORT).optional().nullable(),
      })
      .optional()
      .nullable(),
    notes: z.string().max(MAX_TEXT).optional().nullable(),
    lastVisit: z.string().max(MAX_SHORT).optional().nullable(),
    totalSpent: z.number().optional().nullable(),
    warnings: z.array(z.string().max(MAX_TEXT)).max(50).optional(),
    pets: z.array(petSchema).max(50).optional(),
    documents: z.array(z.any()).max(100).optional(),
    preferredName: z.string().max(MAX_SHORT).optional().nullable(),
    postcode: z.string().max(MAX_SHORT).optional().nullable(),
    preferredContact: z.enum(["email", "phone", "sms"]).optional().nullable(),
    marketingConsent: z.boolean().optional().nullable(),
    tags: z.array(z.string().max(MAX_SHORT)).max(50).optional(),
  })
  .strip();

// ── Appointment Schema ──

export const appointmentSchema = z
  .object({
    id: z.string().max(MAX_SHORT).optional(),
    petName: z.string().min(1, "Pet name is required").max(MAX_SHORT),
    breed: z.string().max(MAX_SHORT).optional().nullable(),
    ownerName: z.string().min(1, "Owner name is required").max(MAX_SHORT),
    service: z.string().min(1, "Service is required").max(MAX_SHORT),
    date: z
      .string()
      .min(1, "Date is required")
      .max(MAX_SHORT)
      .refine((val) => !Number.isNaN(Date.parse(val)), { message: "Date must be a valid ISO date string" }),
    duration: z.number().min(1, "Duration is required"),
    dogCount: z
      .number()
      .int()
      .min(1, "At least 1 dog is required")
      .max(4, "Online booking supports up to 4 dogs")
      .optional()
      .nullable(),
    status: appointmentStatus,
    price: z.number().optional().nullable(),
    avatar: z.string().max(MAX_TEXT).optional().nullable(),
    customerId: z.string().max(MAX_SHORT).optional().nullable(),
    dogId: z.string().max(MAX_SHORT).optional().nullable(),
    staffId: z.string().max(MAX_SHORT).optional().nullable(),
    depositAmount: z.number().optional().nullable(),
    depositPaid: z.boolean().optional().nullable(),
    cancelledAt: z.string().max(MAX_SHORT).optional().nullable(),
    cancelledBy: z.string().max(MAX_SHORT).optional().nullable(),
    cancellationReason: z.string().max(MAX_TEXT).optional().nullable(),
    checkedInAt: z.string().max(MAX_SHORT).optional().nullable(),
    checkedInNotes: z.string().max(MAX_TEXT).optional().nullable(),
    groomNotes: z.string().max(MAX_TEXT).optional().nullable(),
    productsUsed: z.string().max(MAX_TEXT).optional().nullable(),
    behaviourDuringGroom: z.string().max(MAX_TEXT).optional().nullable(),
    completedAt: z.string().max(MAX_SHORT).optional().nullable(),
    aftercareNotes: z.string().max(MAX_TEXT).optional().nullable(),
    readyForCollectionAt: z.string().max(MAX_SHORT).optional().nullable(),
    surcharge: z.number().optional().nullable(),
    surchargeReason: z.string().max(MAX_TEXT).optional().nullable(),
    finalPrice: z.number().optional().nullable(),
    beforePhotos: z.string().max(MAX_TEXT).optional().nullable(),
    afterPhotos: z.string().max(MAX_TEXT).optional().nullable(),
  })
  .strip();

// ── Service Schema ──

export const serviceSchema = z
  .object({
    id: z.string().max(MAX_SHORT).optional(),
    name: z.string().min(1, "Name is required").max(MAX_SHORT),
    description: z.string().max(MAX_TEXT).optional().nullable(),
    duration: z.number().optional().nullable(),
    price: z.number().optional().nullable(),
    category: z.string().max(MAX_SHORT).optional().nullable(),
    isOnlineBookable: z.boolean().optional().nullable(),
    isApprovalRequired: z.boolean().optional().nullable(),
    depositRequired: z.boolean().optional().nullable(),
    depositAmount: z.number().optional().nullable(),
    consentFormRequired: z.boolean().optional().nullable(),
    preBuffer: z.number().optional().nullable(),
    postBuffer: z.number().optional().nullable(),
    priceType: priceType,
    isActive: z.boolean().optional().nullable(),
  })
  .strip();

// ── Add-on Schema ──

export const addOnSchema = z
  .object({
    id: z.string().max(MAX_SHORT).optional(),
    name: z.string().min(1, "Name is required").max(MAX_SHORT),
    description: z.string().max(MAX_TEXT).optional().nullable(),
    price: z.number().optional().nullable(),
    duration: z.number().optional().nullable(),
    isOptional: z.boolean().optional().nullable(),
    isActive: z.boolean().optional().nullable(),
  })
  .strip();

// ── Payment Schema ──

export const paymentSchema = z
  .object({
    id: z.string().max(MAX_SHORT).optional(),
    appointmentId: z.string().min(1, "Appointment is required").max(MAX_SHORT),
    customerId: z.string().max(MAX_SHORT).optional().nullable(),
    amount: z.number().min(0, "Amount must be positive"),
    method: paymentMethod,
    type: paymentType,
    status: z.string().max(MAX_SHORT).optional().nullable(),
    notes: z.string().max(MAX_TEXT).optional().nullable(),
  })
  .strip();

// ── Form Schema ──

export const formSchema = z
  .object({
    id: z.string().max(MAX_SHORT).optional(),
    name: z.string().min(1, "Name is required").max(MAX_SHORT),
    description: z.string().max(MAX_TEXT).optional().nullable(),
    version: z.number().optional().nullable(),
    fields: z.string().min(1, "Fields JSON is required").max(50000),
    isActive: z.boolean().optional().nullable(),
  })
  .strip();

// ── Form Submission Schema ──

export const formSubmissionSchema = z
  .object({
    id: z.string().max(MAX_SHORT).optional(),
    formId: z.string().min(1, "Form ID is required").max(MAX_SHORT),
    customerId: z.string().max(MAX_SHORT).optional().nullable(),
    dogId: z.string().max(MAX_SHORT).optional().nullable(),
    appointmentId: z.string().max(MAX_SHORT).optional().nullable(),
    data: z.string().min(1, "Data JSON is required").max(50000),
    signature: z.string().max(MAX_TEXT).optional().nullable(),
  })
  .strip();

// ── Settings Schema ──

export const settingsSchema = z
  .object({
    shopName: z.string().max(MAX_SHORT).optional().nullable(),
    shopPhone: z.string().max(MAX_SHORT).optional().nullable(),
    shopAddress: z.string().max(MAX_TEXT).optional().nullable(),
    schedule: z
      .array(
        z.object({
          day: z.string().max(MAX_SHORT),
          openTime: z.string().max(MAX_SHORT).optional().nullable(),
          closeTime: z.string().max(MAX_SHORT).optional().nullable(),
          isClosed: z.boolean().optional().nullable(),
          slots: z
            .array(
              z.object({
                time: z.string().max(MAX_SHORT),
                isAvailable: z.boolean().optional().nullable(),
              }),
            )
            .max(24)
            .optional(),
        }),
      )
      .max(7)
      .optional(),
  })
  .strip();

// ── Tags Schema (shared for customer + dog tags) ──

export const tagsSchema = z
  .object({
    tags: z.array(z.string().max(MAX_SHORT)).max(100),
  })
  .strip();

// ── Service Add-on Link Schema ──

export const serviceAddOnLinkSchema = z
  .object({
    addOnIds: z.array(z.string().max(MAX_SHORT)).max(100),
  })
  .strip();

// ── Manual Message Schema ──

export const manualMessageSchema = z
  .object({
    recipientEmail: z.string().max(MAX_SHORT).optional().nullable(),
    recipientPhone: z.string().max(MAX_SHORT).optional().nullable(),
    channel: z.enum(["email", "sms"]).default("email"),
    subject: z.string().max(MAX_SHORT).optional().nullable(),
    body: z.string().min(1, "body is required").max(MAX_TEXT),
    customerId: z.string().max(MAX_SHORT).optional().nullable(),
    appointmentId: z.string().max(MAX_SHORT).optional().nullable(),
  })
  .strip();
