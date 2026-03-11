import { Router, type Request, type Response } from "express";
import db from "../db.js";
import { requireAdmin, requireStaff, getUser } from "../middleware/auth.js";
import { logAudit } from "../helpers/audit.js";
import { autoNotify } from "../helpers/messaging.js";
import {
  getAppointmentAvailability,
  getAvailabilityErrorMessage,
  getAvailabilityReason,
  getNextAvailableSlots,
} from "../helpers/appointments.js";
import { validateBody, appointmentSchema, clampLimit } from "../schema.js";
import type { AppointmentRow, CountRow } from "../types.js";
import type { AvailabilityReason } from "../helpers/appointments.js";
import { isValidTransition } from "../helpers/statusMachine.js";

interface TxCreateResult {
  conflict: boolean;
  suggestions?: string[];
  reason?: AvailabilityReason;
}
interface TxUpdateResult {
  notFound: boolean;
  conflict: boolean;
  invalidTransition?: boolean;
  transitionError?: string;
  suggestions?: string[];
  reason?: AvailabilityReason;
  old: AppointmentRow | null;
  reviewFields?: {
    dogCountReviewedAt: string | null;
    dogCountReviewedBy: string | null;
  };
}

function getDogCountReviewFields(old: AppointmentRow | null, normalizedDogCount: number, reviewerEmail: string) {
  const currentDogCount = old?.dogCount ?? 1;
  const wasUnconfirmed = old?.dogCountConfirmed !== 1;
  const dogCountChanged = old != null && currentDogCount !== normalizedDogCount;

  if (old && (wasUnconfirmed || dogCountChanged)) {
    return {
      dogCountReviewedAt: new Date().toISOString(),
      dogCountReviewedBy: reviewerEmail,
    };
  }

  return {
    dogCountReviewedAt: old?.dogCountReviewedAt ?? null,
    dogCountReviewedBy: old?.dogCountReviewedBy ?? null,
  };
}

const router = Router();

router.get("/", requireStaff, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = clampLimit(req.query.limit as string);
  const offset = (page - 1) * limit;

  const total = (db.prepare("SELECT COUNT(*) as count FROM appointments").get() as CountRow).count;
  const appointments = db.prepare("SELECT * FROM appointments ORDER BY date ASC LIMIT ? OFFSET ?").all(limit, offset);

  res.json({
    data: appointments,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

router.get("/next-available", requireStaff, (req, res) => {
  const dogCount = req.query.dogCount == null ? 1 : parseInt(req.query.dogCount as string);
  if (!Number.isInteger(dogCount) || dogCount < 1 || dogCount > 4) {
    return res.status(400).json({ error: "dogCount must be between 1 and 4" });
  }
  const from = (req.query.from as string) || new Date().toISOString();
  const slots = getNextAvailableSlots(from, dogCount, 5);
  return res.json({ data: slots, dogCount });
});

router.post("/", requireStaff, validateBody(appointmentSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const {
    petName,
    breed,
    age,
    notes,
    ownerName,
    phone,
    service,
    date,
    duration,
    dogCount,
    status,
    price,
    avatar,
    customerId,
    dogId,
  } = req.body;
  const id = crypto.randomUUID();
  const normalizedDogCount = dogCount ?? 1;
  const dogCountReviewedAt = null;
  const dogCountReviewedBy = null;

  const result: TxCreateResult = db.transaction(() => {
    const availability = getAppointmentAvailability(date, normalizedDogCount);
    const conflictReason = getAvailabilityReason(availability);
    if (conflictReason) {
      const suggestions = getNextAvailableSlots(date, normalizedDogCount, 3);
      return { conflict: true, suggestions, reason: conflictReason };
    }
    db.prepare(
      `
            INSERT INTO appointments (
                id, petName, breed, age, notes, ownerName, phone, service, date, duration, dogCount, dogCountConfirmed, dogCountReviewedAt, dogCountReviewedBy, status, price, avatar, customerId, dogId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
    ).run(
      id,
      petName,
      breed,
      age || null,
      notes || null,
      ownerName,
      phone || null,
      service,
      date,
      duration,
      normalizedDogCount,
      1,
      dogCountReviewedAt,
      dogCountReviewedBy,
      status,
      price,
      avatar,
      customerId || null,
      dogId || null,
    );
    return { conflict: false };
  })();

  if (result.conflict) {
    return res.status(400).json({
      error: getAvailabilityErrorMessage(result.reason!),
      suggestions: result.suggestions,
    });
  }

  logAudit(user.id, "create", "appointment", id, null, {
    ...req.body,
    dogCount: normalizedDogCount,
    dogCountConfirmed: true,
  });
  return res.json({
    ...req.body,
    id,
    dogCount: normalizedDogCount,
    dogCountConfirmed: true,
    dogCountReviewedAt,
    dogCountReviewedBy,
  });
});

router.put("/:id", requireStaff, validateBody(appointmentSchema), (req: Request, res: Response) => {
  const user = getUser(req);
  const {
    petName,
    breed,
    age,
    notes,
    ownerName,
    phone,
    service,
    date,
    duration,
    dogCount,
    status,
    price,
    avatar,
    checkedInAt,
    checkedInNotes,
    groomNotes,
    productsUsed,
    behaviourDuringGroom,
    completedAt,
    aftercareNotes,
    readyForCollectionAt,
    surcharge,
    surchargeReason,
    finalPrice,
    cancelledAt,
    cancellationReason,
    customerId,
    dogId,
  } = req.body;
  const normalizedDogCount = dogCount ?? 1;

  const txResult: TxUpdateResult = db.transaction(() => {
    const old = db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id!) as AppointmentRow | undefined;
    if (!old) return { notFound: true, conflict: false, old: null };

    // Validate status transition
    if (status && old.status !== status && !isValidTransition(old.status, status)) {
      return {
        notFound: false,
        conflict: false,
        invalidTransition: true,
        transitionError: `Cannot transition from "${old.status}" to "${status}"`,
        old: null,
      };
    }

    // Set server-side timestamps based on status transitions
    const now = new Date().toISOString();
    const serverTimestamps: Record<string, string | null> = {};
    if (status && old.status !== status) {
      if (status === "checked-in") serverTimestamps.checkedInAt = now;
      if (status === "completed") serverTimestamps.completedAt = now;
      if (status === "ready-for-collection") serverTimestamps.readyForCollectionAt = now;
      if (status === "cancelled-by-customer" || status === "cancelled-by-salon") serverTimestamps.cancelledAt = now;
    }

    const reviewFields = getDogCountReviewFields(old, normalizedDogCount, user.email);

    const availability = getAppointmentAvailability(date, normalizedDogCount, req.params.id!);
    const conflictReason = getAvailabilityReason(availability);
    if (conflictReason) {
      const suggestions = getNextAvailableSlots(date, normalizedDogCount, 3, { excludeId: req.params.id! });
      return { notFound: false, conflict: true, suggestions, reason: conflictReason, old: null };
    }

    db.prepare(
      `
            UPDATE appointments SET
                petName=?, breed=?, age=?, notes=?, ownerName=?, phone=?, service=?, date=?, duration=?, dogCount=?, dogCountConfirmed=?, dogCountReviewedAt=?, dogCountReviewedBy=?, status=?, price=?, avatar=?,
                checkedInAt=?, checkedInNotes=?, groomNotes=?, productsUsed=?, behaviourDuringGroom=?,
                completedAt=?, aftercareNotes=?, readyForCollectionAt=?, surcharge=?, surchargeReason=?, finalPrice=?,
                cancelledAt=?, cancellationReason=?, customerId=?, dogId=?
            WHERE id=?
        `,
    ).run(
      petName,
      breed,
      age ?? null,
      notes ?? null,
      ownerName,
      phone ?? null,
      service,
      date,
      duration,
      normalizedDogCount,
      1,
      reviewFields.dogCountReviewedAt,
      reviewFields.dogCountReviewedBy,
      status,
      price,
      avatar,
      serverTimestamps.checkedInAt ?? checkedInAt ?? null,
      checkedInNotes ?? null,
      groomNotes ?? null,
      productsUsed ?? null,
      behaviourDuringGroom ?? null,
      serverTimestamps.completedAt ?? completedAt ?? null,
      aftercareNotes ?? null,
      serverTimestamps.readyForCollectionAt ?? readyForCollectionAt ?? null,
      surcharge ?? null,
      surchargeReason ?? null,
      finalPrice ?? null,
      serverTimestamps.cancelledAt ?? cancelledAt ?? null,
      cancellationReason ?? null,
      customerId ?? null,
      dogId ?? null,
      req.params.id!,
    );

    return { notFound: false, conflict: false, old, reviewFields };
  })();

  if (txResult.notFound) {
    return res.status(404).json({ error: "Appointment not found" });
  }
  if (txResult.invalidTransition) {
    return res.status(400).json({ error: txResult.transitionError });
  }
  if (txResult.conflict) {
    return res.status(400).json({
      error: getAvailabilityErrorMessage(txResult.reason!),
      suggestions: txResult.suggestions,
    });
  }

  const old = txResult.old;
  const reviewFields = txResult.reviewFields ?? {
    dogCountReviewedAt: old?.dogCountReviewedAt ?? null,
    dogCountReviewedBy: old?.dogCountReviewedBy ?? null,
  };
  logAudit(user.id, "update", "appointment", req.params.id!, old ?? null, {
    ...req.body,
    dogCount: normalizedDogCount,
    dogCountConfirmed: true,
    dogCountReviewedAt: reviewFields.dogCountReviewedAt,
    dogCountReviewedBy: reviewFields.dogCountReviewedBy,
  });

  // Auto-notify on key status transitions
  if (old && old.status !== status) {
    if (status === "ready-for-collection") {
      autoNotify("ready_for_collection", { ...req.body, id: req.params.id! });
    }
    if (status === "cancelled-by-salon" || status === "cancelled-by-customer") {
      autoNotify("booking_cancelled", { ...req.body, id: req.params.id! });
    }
  }

  return res.json({
    ...req.body,
    dogCount: normalizedDogCount,
    dogCountConfirmed: true,
    dogCountReviewedAt: reviewFields.dogCountReviewedAt,
    dogCountReviewedBy: reviewFields.dogCountReviewedBy,
  });
});

router.delete("/:id", requireAdmin, (req: Request, res: Response) => {
  const user = getUser(req);
  const existing = db.prepare("SELECT id FROM appointments WHERE id = ?").get(req.params.id!) as
    | Pick<AppointmentRow, "id">
    | undefined;
  if (!existing) return res.status(404).json({ error: "Appointment not found" });

  db.prepare("DELETE FROM appointments WHERE id=?").run(req.params.id!);
  logAudit(user.id, "delete", "appointment", req.params.id!, null, null);
  return res.json({ success: true });
});

export default router;
