import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import db from "../db.js";
import { JWT_SECRET, authenticateToken, getUser } from "../middleware/auth.js";
import { logAudit } from "../helpers/audit.js";
import { validatePasswordStrength } from "../helpers/password.js";
import { autoNotify } from "../helpers/messaging.js";
import type { UserRow, ServiceRow } from "../types.js";
import type { RawScheduleRow } from "../helpers/schedule.js";
import {
  getAppointmentAvailability,
  getAvailabilityErrorMessage,
  getAvailabilityReason,
  getAvailableSlotsForDate,
  getNextAvailableSlots,
} from "../helpers/appointments.js";
import { normalizeScheduleRows } from "../helpers/schedule.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public: list bookable services
router.get("/services", (req, res) => {
  const services = db
    .prepare(
      "SELECT id, name, description, duration, price, category, priceType, depositRequired, depositAmount FROM services WHERE isOnlineBookable = 1 AND isActive = 1",
    )
    .all();
  res.json(services);
});

// Public: shop schedule
router.get("/schedule", (req, res) => {
  const rows = db.prepare("SELECT * FROM schedule").all() as RawScheduleRow[];
  res.json(normalizeScheduleRows(rows));
});

// Public: get available slots for a date
router.get("/available-slots", (req, res) => {
  const { date, duration, dogCount } = req.query;
  if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const dateStr = date as string;
  const dur = parseInt(duration as string) || 60;
  const parsedDogCount = dogCount == null ? 1 : parseInt(dogCount as string);

  if (!Number.isInteger(parsedDogCount) || parsedDogCount < 1 || parsedDogCount > 4) {
    return res.status(400).json({ error: "dogCount must be between 1 and 4" });
  }

  const slots = getAvailableSlotsForDate(dateStr, parsedDogCount);
  return res.json({ slots, date: dateStr, duration: dur, dogCount: parsedDogCount });
});

// Public: customer registration
router.post("/register", (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail || !password || !firstName) {
    return res.status(400).json({ error: "Email, password, and first name are required" });
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const userId = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, 10);

    db.transaction(() => {
      db.prepare("INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)").run(
        userId,
        normalizedEmail,
        hash,
        "customer",
      );
      db.prepare("INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)").run(
        customerId,
        `${firstName} ${lastName || ""}`.trim(),
        normalizedEmail,
        phone || "",
      );
    })();

    const token = jwt.sign({ id: userId, email: normalizedEmail, role: "customer" }, JWT_SECRET!, { expiresIn: "24h" });

    res.cookie("petspa_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({ user: { id: userId, email: normalizedEmail, role: "customer", customerId } });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Email already exists" });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
});

// Public: customer login
router.post("/login", loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(normalizedEmail) as
    | UserRow
    | undefined;

  if (user && bcrypt.compareSync(password, user.password)) {
    const role = user.role || "customer";
    const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET!, { expiresIn: "24h" });

    res.cookie("petspa_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    const customer = db.prepare("SELECT id FROM customers WHERE email = ? COLLATE NOCASE").get(normalizedEmail) as
      | { id: string }
      | undefined;
    res.json({
      user: { id: user.id, email: user.email, role, customerId: customer?.id || null },
    });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Public: submit a booking (requires customer auth token)
router.post("/bookings", authenticateToken, (req: Request, res: Response) => {
  const user = getUser(req);
  const { serviceId, date, petName, breed, notes, dogCount } = req.body;

  // Resolve customerId from the authenticated user's linked customer record — ignore any client-supplied value
  const customerRow = db.prepare("SELECT id FROM customers WHERE email = ? COLLATE NOCASE").get(user.email) as
    | { id: string }
    | undefined;
  const customerId = customerRow?.id || null;

  if (!serviceId || !date || !petName) {
    return res.status(400).json({ error: "serviceId, date, and petName are required" });
  }

  const normalizedDogCount = dogCount == null ? 1 : Number(dogCount);
  if (!Number.isInteger(normalizedDogCount) || normalizedDogCount < 1 || normalizedDogCount > 4) {
    return res.status(400).json({ error: "Online booking currently supports between 1 and 4 dogs per request." });
  }

  const service = db.prepare("SELECT * FROM services WHERE id = ?").get(serviceId) as ServiceRow | undefined;
  if (!service) return res.status(404).json({ error: "Service not found" });

  const status = service.isApprovalRequired ? "pending-approval" : "confirmed";
  const apptId = crypto.randomUUID();

  // Wrap availability check + INSERT in a transaction to prevent race conditions
  const txResult = db.transaction(() => {
    const availability = getAppointmentAvailability(date, normalizedDogCount);
    const conflictReason = getAvailabilityReason(availability);
    if (conflictReason) {
      return { conflict: true as const, reason: conflictReason };
    }

    db.prepare(
      `
          INSERT INTO appointments (id, petName, breed, ownerName, service, date, duration, dogCount, dogCountConfirmed, status, price, avatar, customerId, notes, depositAmount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      apptId,
      petName,
      breed || "",
      "",
      service.name,
      date,
      service.duration,
      normalizedDogCount,
      1,
      status,
      service.price,
      "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&h=150&fit=crop&q=80",
      customerId || null,
      notes || "",
      service.depositAmount || 0,
    );

    return { conflict: false as const };
  })();

  if (txResult.conflict) {
    return res.status(400).json({
      error: getAvailabilityErrorMessage(txResult.reason),
      suggestions: getNextAvailableSlots(date, normalizedDogCount, 3),
    });
  }

  logAudit(user.id, "book", "appointment", apptId, null, { serviceId, petName, dogCount: normalizedDogCount, status });

  const triggerKey = status === "pending-approval" ? "booking_pending" : "booking_confirmed";
  autoNotify(triggerKey, {
    id: apptId,
    ownerName: petName,
    petName,
    service: service.name,
    date,
    price: service.price,
    customerId,
  });

  return res.json({
    id: apptId,
    status,
    message:
      status === "pending-approval"
        ? "Your booking request has been submitted and is awaiting approval."
        : "Your booking has been confirmed!",
    depositRequired: service.depositRequired ? service.depositAmount : 0,
  });
});

export default router;
