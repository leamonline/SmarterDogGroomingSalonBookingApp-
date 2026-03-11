import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import app from "../server/index.js";
import db from "../server/db.js";
import { resolvePasswordResetBaseUrl } from "../server/helpers/passwordResetUrl.js";
import { JWT_SECRET } from "../server/middleware/auth.js";
import crypto from "crypto";

const ownerToken = jwt.sign({ id: "test-owner", email: "owner@example.com", role: "owner" }, JWT_SECRET);
const staffToken = jwt.sign({ id: "test-staff", email: "staff@example.com", role: "groomer" }, JWT_SECRET);
const customerToken = jwt.sign({ id: "test-customer", email: "customer@example.com", role: "customer" }, JWT_SECRET);
const receptionistToken = jwt.sign(
  { id: "test-receptionist", email: "receptionist@example.com", role: "receptionist" },
  JWT_SECRET,
);
// Alias for existing tests
const testToken = ownerToken;

// ─── helpers ──────────────────────────────────────────────
const auth = (token = ownerToken) => ({ Authorization: `Bearer ${token}` });

const makeAppt = (overrides: Record<string, any> = {}) => ({
  id: crypto.randomUUID(),
  petName: "Buddy",
  breed: "Poodle",
  ownerName: "Sam",
  service: "Bath",
  date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
  duration: 60,
  dogCount: 1,
  status: "scheduled",
  price: 50,
  avatar: "",
  ...overrides,
});

const nextDateForDay = (dayName: string, minDaysAhead = 28) => {
  const targetNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetIndex = targetNames.indexOf(dayName);
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + minDaysAhead);
  while (date.getDay() !== targetIndex) {
    date.setDate(date.getDate() + 1);
  }
  // Use local date components to avoid UTC offset shifting the date
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const slotIso = (dateStr: string, time: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
};

// ══════════════════════════════════════════════════════════
describe("Authentication", () => {
  it("returns 401 for protected route without token", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid login credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("allows login regardless of email casing", async () => {
    const userId = crypto.randomUUID();
    const storedEmail = `case_${Date.now()}@example.com`;
    const password = "StrongPass123";

    db.prepare("INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)").run(
      userId,
      storedEmail,
      bcrypt.hashSync(password, 10),
      "owner",
    );

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `  ${storedEmail.toUpperCase()}  `, password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(storedEmail);
  });

  it("normalizes mixed-case public registration and blocks case-variant duplicates", async () => {
    const mixedEmail = `MiXeD_${Date.now()}@Example.com`;
    const first = await request(app)
      .post("/api/public/register")
      .send({
        email: `  ${mixedEmail}  `,
        password: "StrongPass123",
        firstName: "Casey",
        lastName: "One",
      });

    expect(first.status).toBe(200);
    expect(first.body.user.email).toBe(mixedEmail.trim().toLowerCase());

    const duplicate = await request(app).post("/api/public/register").send({
      email: mixedEmail.toLowerCase(),
      password: "StrongPass123",
      firstName: "Casey",
      lastName: "Two",
    });

    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error).toBe("Email already exists");
  });

  it("normalizes mixed-case staff account creation email", async () => {
    const mixedEmail = `Staff_${Date.now()}@Example.com`;
    const res = await request(app)
      .post("/api/staff")
      .set(auth())
      .send({
        email: ` ${mixedEmail} `,
        password: "StrongPass123",
        role: "groomer",
      });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(mixedEmail.toLowerCase());

    const row = db.prepare("SELECT email FROM users WHERE id = ?").get(res.body.id) as { email: string };
    expect(row.email).toBe(mixedEmail.toLowerCase());
  });

  it("requests a password reset, confirms it, and allows login with the new password", async () => {
    const userId = crypto.randomUUID();
    const email = `reset_${Date.now()}@example.com`;
    const oldPassword = "OldPassword1";
    const newPassword = "BetterPassword2";

    db.prepare("INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)").run(
      userId,
      email,
      bcrypt.hashSync(oldPassword, 10),
      "owner",
    );

    const requestRes = await request(app).post("/api/auth/password-reset/request").send({ email });
    expect(requestRes.status).toBe(200);
    expect(requestRes.body.success).toBe(true);

    const tokenRow = db.prepare("SELECT token FROM password_reset_tokens WHERE userId = ?").get(userId) as
      | { token: string }
      | undefined;
    expect(tokenRow?.token).toBeDefined();

    const confirmRes = await request(app)
      .post("/api/auth/password-reset/confirm")
      .send({ token: tokenRow!.token, newPassword });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);

    const oldLoginRes = await request(app).post("/api/auth/login").send({ email, password: oldPassword });
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await request(app).post("/api/auth/login").send({ email, password: newPassword });
    expect(newLoginRes.status).toBe(200);

    const usedTokenRow = db.prepare("SELECT token FROM password_reset_tokens WHERE userId = ?").get(userId);
    expect(usedTokenRow).toBeUndefined();
  });

  it("uses only trusted configured origins when building password reset URLs", () => {
    expect(
      resolvePasswordResetBaseUrl({
        appUrl: "https://app.smarterdog.co.uk/",
        corsOrigin: "https://ignored.example",
        nodeEnv: "production",
      }),
    ).toBe("https://app.smarterdog.co.uk");

    expect(
      resolvePasswordResetBaseUrl({
        corsOrigin: "https://salon.example/",
        nodeEnv: "test",
      }),
    ).toBe("https://salon.example");

    expect(
      resolvePasswordResetBaseUrl({
        nodeEnv: "development",
      }),
    ).toBe("http://localhost:3000");

    expect(() =>
      resolvePasswordResetBaseUrl({
        appUrl: "",
        corsOrigin: "",
        nodeEnv: "production",
      }),
    ).toThrow("APP_URL or CORS_ORIGIN must be configured for password reset emails");
  });
});

// ══════════════════════════════════════════════════════════
describe("Appointments", () => {
  it("returns next available slots for authenticated user", async () => {
    const res = await request(app).get("/api/appointments/next-available?duration=60").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("creates an appointment successfully", async () => {
    // Use next-available to guarantee an open slot
    const slotsRes = await request(app).get("/api/appointments/next-available?duration=60").set(auth());
    const openSlot = slotsRes.body.data[0];
    const appt = makeAppt({ date: openSlot });
    const res = await request(app).post("/api/appointments").set(auth()).send(appt);
    expect(res.status).toBe(200);
    expect(res.body.petName).toBe(appt.petName);
  });

  it("looks up existing pets and stores their customer and dog ids on new appointments", async () => {
    const lookupCustomer = {
      id: crypto.randomUUID(),
      name: `Lookup Owner ${Date.now()}`,
      email: "",
      phone: "07123 555999",
      address: "",
      emergencyContact: { name: "Backup", phone: "07123 000111" },
      notes: "Prefers morning drop-off",
      warnings: [],
      pets: [
        {
          id: crypto.randomUUID(),
          name: `Lookup Pup ${Date.now()}`,
          breed: "Cockapoo",
          weight: 12,
          dob: "2021-05-05",
          coatType: "Curly",
          behavioralNotes: ["Nervous with dryers"],
          vaccinations: [],
        },
      ],
      lastVisit: "Never",
      totalSpent: 0,
      documents: [],
    };

    const createCustomerRes = await request(app).post("/api/customers").set(auth()).send(lookupCustomer);
    expect(createCustomerRes.status).toBe(200);
    expect(createCustomerRes.body.pets[0]?.id).toBe(lookupCustomer.pets[0].id);

    const lookupRes = await request(app)
      .get(`/api/customers/appointment-lookup?petName=${encodeURIComponent(lookupCustomer.pets[0].name)}`)
      .set(auth());
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body[0]?.customerId).toBe(createCustomerRes.body.id);
    expect(lookupRes.body[0]?.petId).toBe(lookupCustomer.pets[0].id);

    const slotsRes = await request(app).get("/api/appointments/next-available?duration=60").set(auth());
    const openSlot = slotsRes.body.data[0];

    const res = await request(app)
      .post("/api/appointments")
      .set(auth())
      .send(
        makeAppt({
          date: openSlot,
          ownerName: lookupCustomer.name,
          petName: lookupCustomer.pets[0].name,
          breed: lookupCustomer.pets[0].breed,
          phone: lookupCustomer.phone,
          customerId: createCustomerRes.body.id,
          dogId: lookupCustomer.pets[0].id,
        }),
      );

    expect(res.status).toBe(200);

    const saved = db.prepare("SELECT customerId, dogId FROM appointments WHERE id = ?").get(res.body.id) as {
      customerId: string;
      dogId: string;
    };
    expect(saved.customerId).toBe(createCustomerRes.body.id);
    expect(saved.dogId).toBe(lookupCustomer.pets[0].id);
  });

  it("allows two dogs in the same slot and rejects the third", async () => {
    const slotsRes = await request(app)
      .get(
        `/api/appointments/next-available?duration=60&from=${encodeURIComponent(new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString())}`,
      )
      .set(auth());
    const date = slotsRes.body.data[0];

    const first = makeAppt({ date });
    await request(app).post("/api/appointments").set(auth()).send(first);

    const second = makeAppt({ date, id: crypto.randomUUID(), petName: "Milo" });
    const secondRes = await request(app).post("/api/appointments").set(auth()).send(second);
    expect(secondRes.status).toBe(200);

    const third = makeAppt({ date, id: crypto.randomUUID(), petName: "Poppy" });
    const res = await request(app).post("/api/appointments").set(auth()).send(third);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("This slot is already at capacity.");
    expect(Array.isArray(res.body.suggestions)).toBe(true);
  });

  it("reduces the next slot to one dog after two adjacent full slots", async () => {
    const dateStr = nextDateForDay("Tuesday", 35);
    const firstSlot = slotIso(dateStr, "09:00");
    const secondSlot = slotIso(dateStr, "09:30");
    const restrictedSlot = slotIso(dateStr, "10:00");

    const firstRes = await request(app)
      .post("/api/appointments")
      .set(auth())
      .send(makeAppt({ date: firstSlot, petName: "Alpha", dogCount: 2 }));
    expect(firstRes.status).toBe(200);

    const secondRes = await request(app)
      .post("/api/appointments")
      .set(auth())
      .send(makeAppt({ date: secondSlot, petName: "Bravo", dogCount: 2 }));
    expect(secondRes.status).toBe(200);

    const twoDogSlots = await request(app).get(`/api/public/available-slots?date=${dateStr}&dogCount=2`);
    expect(twoDogSlots.status).toBe(200);
    expect(twoDogSlots.body.slots).not.toContain(restrictedSlot);

    const oneDogSlots = await request(app).get(`/api/public/available-slots?date=${dateStr}&dogCount=1`);
    expect(oneDogSlots.status).toBe(200);
    expect(oneDogSlots.body.slots).toContain(restrictedSlot);
  });

  it("requires a valid consecutive slot pair for three-dog bookings", async () => {
    const dateStr = nextDateForDay("Wednesday", 42);
    const validPairStart = slotIso(dateStr, "12:30");
    const invalidPairStart = slotIso(dateStr, "13:00");

    const validRes = await request(app)
      .post("/api/appointments")
      .set(auth())
      .send(makeAppt({ date: validPairStart, petName: "Pack Booking", dogCount: 3 }));
    expect(validRes.status).toBe(200);

    const invalidRes = await request(app)
      .post("/api/appointments")
      .set(auth())
      .send(makeAppt({ date: invalidPairStart, petName: "Late Pack Booking", dogCount: 3 }));
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error).toBe(
      "I do not have a suitable consecutive drop-off window for that number of dogs on this day.",
    );
  });

  it("blocks bookings that would take the day above the 15-dog limit", async () => {
    const dateStr = nextDateForDay("Monday", 49);
    const slotPlan: Array<[string, number]> = [
      ["08:30", 2],
      ["09:00", 2],
      ["09:30", 1],
      ["10:00", 2],
      ["10:30", 2],
      ["11:00", 1],
      ["11:30", 2],
      ["12:00", 2],
      ["12:30", 1],
    ];

    for (const [time, dogCount] of slotPlan) {
      const res = await request(app)
        .post("/api/appointments")
        .set(auth())
        .send(makeAppt({ date: slotIso(dateStr, time), petName: `Dog ${time}`, dogCount }));
      expect(res.status).toBe(200);
    }

    const overflowRes = await request(app)
      .post("/api/appointments")
      .set(auth())
      .send(makeAppt({ date: slotIso(dateStr, "13:00"), petName: "Overflow Dog", dogCount: 1 }));
    expect(overflowRes.status).toBe(400);
    expect(overflowRes.body.error).toBe("This day has already reached its 15-dog booking limit.");
  });

  it("escalates closed days that already contain bookings instead of auto-booking more", async () => {
    const dateStr = nextDateForDay("Thursday", 56);
    const existingSlot = slotIso(dateStr, "09:00");
    const requestSlot = slotIso(dateStr, "09:30");

    db.prepare(
      `
            INSERT INTO appointments (id, petName, breed, ownerName, service, date, duration, dogCount, status, price, avatar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
    ).run(
      crypto.randomUUID(),
      "Closed Day Dog",
      "Spaniel",
      "Manual Review Owner",
      "Bath",
      existingSlot,
      60,
      1,
      "scheduled",
      45,
      "",
    );

    const createRes = await request(app)
      .post("/api/appointments")
      .set(auth())
      .send(makeAppt({ date: requestSlot, petName: "Needs Review", dogCount: 1 }));
    expect(createRes.status).toBe(400);
    expect(createRes.body.error).toBe(
      "This day needs a quick manual review before we can add another booking. Please contact the salon.",
    );

    const publicSlotsRes = await request(app).get(`/api/public/available-slots?date=${dateStr}&dogCount=1`);
    expect(publicSlotsRes.status).toBe(200);
    expect(publicSlotsRes.body.slots).toEqual([]);
  });

  it("requires legacy future bookings to be reviewed before the day is offered online again", async () => {
    const dateStr = nextDateForDay("Tuesday", 63);
    const existingId = crypto.randomUUID();
    const existingSlot = slotIso(dateStr, "09:00");

    db.prepare(
      `
            INSERT INTO appointments (id, petName, breed, ownerName, service, date, duration, dogCount, dogCountConfirmed, status, price, avatar)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
    ).run(existingId, "Legacy Pair", "Cockapoo", "Legacy Owner", "Bath", existingSlot, 60, 1, 0, "scheduled", 45, "");

    const beforeReview = await request(app).get(`/api/public/available-slots?date=${dateStr}&dogCount=1`);
    expect(beforeReview.status).toBe(200);
    expect(beforeReview.body.slots).toEqual([]);

    const confirmRes = await request(app)
      .put(`/api/appointments/${existingId}`)
      .set(auth())
      .send(
        makeAppt({
          id: existingId,
          petName: "Legacy Pair",
          breed: "Cockapoo",
          ownerName: "Legacy Owner",
          service: "Bath",
          date: existingSlot,
          dogCount: 2,
          price: 45,
        }),
      );
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.dogCountConfirmed).toBe(true);
    expect(confirmRes.body.dogCountReviewedAt).toBeTruthy();
    expect(confirmRes.body.dogCountReviewedBy).toBe("owner@example.com");

    const reviewedRow = db
      .prepare(
        "SELECT dogCount, dogCountConfirmed, dogCountReviewedAt, dogCountReviewedBy FROM appointments WHERE id = ?",
      )
      .get(existingId) as {
      dogCount: number;
      dogCountConfirmed: number;
      dogCountReviewedAt: string | null;
      dogCountReviewedBy: string | null;
    };
    expect(reviewedRow.dogCount).toBe(2);
    expect(reviewedRow.dogCountConfirmed).toBe(1);
    expect(reviewedRow.dogCountReviewedAt).toBeTruthy();
    expect(reviewedRow.dogCountReviewedBy).toBe("owner@example.com");

    const afterReview = await request(app).get(`/api/public/available-slots?date=${dateStr}&dogCount=1`);
    expect(afterReview.status).toBe(200);
    expect(afterReview.body.slots.length).toBeGreaterThan(0);
  });

  it("updates appointment status via PUT", async () => {
    // Use next-available to guarantee an open slot
    const slotsRes = await request(app).get("/api/appointments/next-available?duration=60").set(auth());
    const openSlot = slotsRes.body.data[0];
    const appt = makeAppt({ date: openSlot });
    const createRes = await request(app).post("/api/appointments").set(auth()).send(appt);
    expect(createRes.status).toBe(200);
    const serverId = createRes.body.id; // server generates its own UUID

    const updated = { ...appt, id: serverId, status: "checked-in" };
    const res = await request(app).put(`/api/appointments/${serverId}`).set(auth()).send(updated);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("checked-in");
  });

  it("returns paginated appointment list", async () => {
    const res = await request(app).get("/api/appointments?page=1&limit=10").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.total).toBe("number");
  });
});

// ══════════════════════════════════════════════════════════
describe("Customers", () => {
  it("creates and fully deletes a customer (cascade test)", async () => {
    const customer = {
      id: crypto.randomUUID(),
      name: "Test Deletion User",
      email: `delete_${Date.now()}@example.com`,
      phone: "555-0000",
      pets: [{ id: crypto.randomUUID(), name: "TestPet", breed: "Mutt" }],
    };

    const createRes = await request(app).post("/api/customers").set(auth()).send(customer);
    expect(createRes.status).toBe(200);
    const serverId = createRes.body.id; // server generates its own UUID

    const deleteRes = await request(app).delete(`/api/customers/${serverId}`).set(auth());
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app).get("/api/customers").set(auth());
    const ids = (listRes.body.data as any[]).map((c) => c.id);
    expect(ids).not.toContain(serverId);
  });

  it("returns paginated customer list with metadata", async () => {
    const res = await request(app).get("/api/customers?page=1&limit=5").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(5);
  });

  it("preserves pet ID when updating a customer (upsert safety)", async () => {
    const petId = crypto.randomUUID();
    const customer = {
      id: crypto.randomUUID(),
      name: "Pet ID Test",
      email: `petid_${Date.now()}@example.com`,
      phone: "555-1234",
      pets: [{ id: petId, name: "Fluffy", breed: "Shih Tzu" }],
    };

    const createRes = await request(app).post("/api/customers").set(auth()).send(customer);
    const serverId = createRes.body.id; // server generates its own UUID

    // Update with server-assigned ID
    const updated = { ...customer, id: serverId, name: "Pet ID Test Updated" };
    const putRes = await request(app).put(`/api/customers/${serverId}`).set(auth()).send(updated);
    expect(putRes.status).toBe(200);
  });

  it("returns a hydrated client profile by id", async () => {
    const customer = {
      id: crypto.randomUUID(),
      name: `Hydrated Client ${Date.now()}`,
      email: `hydrated_${Date.now()}@example.com`,
      phone: "07111 222333",
      emergencyContact: { name: "Backup Person", phone: "07000 111222" },
      warnings: ["Needs quiet handoff"],
      pets: [
        { id: crypto.randomUUID(), name: "Pebble", breed: "Spaniel", behavioralNotes: ["Nervous on first visit"] },
      ],
    };

    const createRes = await request(app).post("/api/customers").set(auth()).send(customer);
    expect(createRes.status).toBe(200);

    const getRes = await request(app).get(`/api/customers/${createRes.body.id}`).set(auth());
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);
    expect(getRes.body.emergencyContact?.name).toBe("Backup Person");
    expect(getRes.body.pets[0]?.name).toBe("Pebble");
    expect(getRes.body.warnings).toContain("Needs quiet handoff");
  });
});

// ══════════════════════════════════════════════════════════
describe("Role Guards", () => {
  it("blocks staff from deleting a customer (403)", async () => {
    const customer = {
      id: crypto.randomUUID(),
      name: "Role Guard Test",
      email: `rg_${Date.now()}@example.com`,
      phone: "555-9999",
      pets: [],
    };
    const createRes = await request(app).post("/api/customers").set(auth()).send(customer);
    const serverId = createRes.body.id;

    const res = await request(app).delete(`/api/customers/${serverId}`).set(auth(staffToken));
    expect(res.status).toBe(403);

    // Cleanup
    await request(app).delete(`/api/customers/${serverId}`).set(auth(ownerToken));
  });

  it("blocks staff from deleting an appointment (403)", async () => {
    const appt = makeAppt({ date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() });
    const createRes = await request(app).post("/api/appointments").set(auth()).send(appt);
    const serverId = createRes.body.id;

    const res = await request(app).delete(`/api/appointments/${serverId}`).set(auth(staffToken));
    expect(res.status).toBe(403);

    // Cleanup
    await request(app).delete(`/api/appointments/${serverId}`).set(auth(ownerToken));
  });
});

// ══════════════════════════════════════════════════════════
describe("Messaging", () => {
  it("dispatches a manual message and logs it to the DB", async () => {
    const res = await request(app).post("/api/messages/send").set(auth()).send({
      channel: "email",
      recipientEmail: "test@example.com",
      subject: "Test notification",
      body: "Hello from the test suite.",
    });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(["sent", "simulated"]).toContain(res.body.status);
  });

  it("returns message history for owner", async () => {
    const res = await request(app).get("/api/messages").set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("allows staff to view message history", async () => {
    const res = await request(app).get("/api/messages").set(auth(staffToken));
    expect(res.status).toBe(200);
  });

  it("filters message history by customer id", async () => {
    const customer = {
      id: crypto.randomUUID(),
      name: `Message Client ${Date.now()}`,
      email: `message_${Date.now()}@example.com`,
      phone: "07000 444555",
      pets: [{ id: crypto.randomUUID(), name: "Rolo", breed: "Cockapoo" }],
    };
    const createRes = await request(app).post("/api/customers").set(auth()).send(customer);
    expect(createRes.status).toBe(200);

    const sendRes = await request(app).post("/api/messages/send").set(auth()).send({
      channel: "email",
      recipientEmail: customer.email,
      subject: "Booking update",
      body: "Linked client message",
      customerId: createRes.body.id,
    });
    expect(sendRes.status).toBe(200);

    const filteredRes = await request(app).get(`/api/messages?customerId=${createRes.body.id}`).set(auth(staffToken));
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.some((message: any) => message.customerId === createRes.body.id)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe("Dogs", () => {
  it("returns first-class dog list and detail data", async () => {
    const customer = {
      id: crypto.randomUUID(),
      name: `Dog Owner ${Date.now()}`,
      email: `dog_owner_${Date.now()}@example.com`,
      phone: "07000 123456",
      pets: [
        {
          id: crypto.randomUUID(),
          name: `Waffle ${Date.now()}`,
          breed: "Cockapoo",
          behavioralNotes: ["Needs a gentle introduction"],
          vaccinations: [{ name: "Rabies", expiryDate: "2030-01-01", status: "valid" }],
        },
      ],
    };

    const createRes = await request(app).post("/api/customers").set(auth()).send(customer);
    expect(createRes.status).toBe(200);

    const listRes = await request(app).get("/api/dogs").set(auth());
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    const createdDog = listRes.body.data.find((dog: any) => dog.id === customer.pets[0].id);
    expect(createdDog?.customerName).toBe(customer.name);
    expect(createdDog?.behavioralNotes).toContain("Needs a gentle introduction");

    const detailRes = await request(app).get(`/api/dogs/${customer.pets[0].id}`).set(auth());
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.customer?.id).toBe(createRes.body.id);
    expect(Array.isArray(detailRes.body.recentAppointments)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe("Reports", () => {
  it("returns report data for a date range", async () => {
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const end = new Date().toISOString().split("T")[0];
    const res = await request(app).get(`/api/reports?start=${start}&end=${end}`).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.appointments)).toBe(true);
    expect(Array.isArray(res.body.revenueByDay)).toBe(true);
    expect(Array.isArray(res.body.serviceBreakdown)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe("Public Booking Flow", () => {
  it("returns the shop schedule publicly", async () => {
    const res = await request(app).get("/api/public/schedule");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(Array.isArray(res.body[0]?.slots)).toBe(true);
    expect(res.body.find((day: any) => day.day === "Monday")?.isClosed).toBe(false);
    expect(res.body.find((day: any) => day.day === "Thursday")?.isClosed).toBe(true);
  });

  it("returns available slots for a given date", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // Find a default open day (Monday to Wednesday)
    while (![1, 2, 3].includes(tomorrow.getDay())) tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const servicesRes = await request(app).get("/api/public/services");
    expect(servicesRes.status).toBe(200);
    const services = servicesRes.body;
    if (services.length === 0) return; // skip if no services seeded

    const serviceId = services[0].id;
    const res = await request(app).get(
      `/api/public/available-slots?serviceId=${serviceId}&date=${dateStr}&duration=60`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe("Services", () => {
  it("creates a new service", async () => {
    const service = {
      id: crypto.randomUUID(),
      name: `Test Service ${Date.now()}`,
      description: "A test grooming service",
      duration: 45,
      price: 35,
      category: "Grooming",
    };
    const res = await request(app).post("/api/services").set(auth()).send(service);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(service.name);
  });

  it("returns paginated service list", async () => {
    const res = await request(app).get("/api/services?page=1&limit=5").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it("updates an existing service", async () => {
    const service = {
      id: crypto.randomUUID(),
      name: `Update Test ${Date.now()}`,
      description: "Before update",
      duration: 30,
      price: 20,
      category: "Spa",
    };
    const createRes = await request(app).post("/api/services").set(auth()).send(service);
    const serverId = createRes.body.id;

    const updated = { ...service, id: serverId, name: "Updated Service Name", price: 25 };
    const putRes = await request(app).put(`/api/services/${serverId}`).set(auth()).send(updated);
    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe("Updated Service Name");
    expect(putRes.body.price).toBe(25);
  });

  it("deletes a service (admin only)", async () => {
    const service = {
      id: crypto.randomUUID(),
      name: `Delete Test ${Date.now()}`,
      description: "",
      duration: 15,
      price: 10,
      category: "Add-ons",
    };
    const createRes = await request(app).post("/api/services").set(auth()).send(service);
    const serverId = createRes.body.id;

    const deleteRes = await request(app).delete(`/api/services/${serverId}`).set(auth());
    expect(deleteRes.status).toBe(200);
  });

  it("blocks staff from deleting a service (403)", async () => {
    const service = {
      id: crypto.randomUUID(),
      name: `Staff Delete ${Date.now()}`,
      description: "",
      duration: 15,
      price: 10,
      category: "Grooming",
    };
    const createRes = await request(app).post("/api/services").set(auth()).send(service);
    const serverId = createRes.body.id;

    const res = await request(app).delete(`/api/services/${serverId}`).set(auth(staffToken));
    expect(res.status).toBe(403);

    // Cleanup
    await request(app).delete(`/api/services/${serverId}`).set(auth(ownerToken));
  });
});

// ══════════════════════════════════════════════════════════
describe("Settings", () => {
  it("returns settings and schedule for authenticated user", async () => {
    const res = await request(app).get("/api/settings").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.shopName).toBeDefined();
    expect(Array.isArray(res.body.schedule)).toBe(true);
    expect(Array.isArray(res.body.schedule[0]?.slots)).toBe(true);
    expect(res.body.schedule.find((day: any) => day.day === "Wednesday")?.isClosed).toBe(false);
    expect(res.body.schedule.find((day: any) => day.day === "Sunday")?.isClosed).toBe(true);
  });

  it("lets staff close a day and disable individual booking starts", async () => {
    const current = await request(app).get("/api/settings").set(auth());
    expect(current.status).toBe(200);

    const originalSchedule = current.body.schedule;
    const monday = originalSchedule.find((day: any) => day.day === "Monday");
    const tuesday = originalSchedule.find((day: any) => day.day === "Tuesday");

    try {
      const updatedSchedule = originalSchedule.map((day: any) => {
        if (day.day === "Monday") {
          return { ...day, isClosed: true };
        }
        if (day.day === "Tuesday") {
          return {
            ...day,
            isClosed: false,
            slots: day.slots.map((slot: any) => (slot.time === "08:30" ? { ...slot, isAvailable: false } : slot)),
          };
        }
        return day;
      });

      const saveRes = await request(app).post("/api/settings").set(auth()).send({ schedule: updatedSchedule });
      expect(saveRes.status).toBe(200);

      const publicSchedule = await request(app).get("/api/public/schedule");
      expect(publicSchedule.status).toBe(200);
      expect(publicSchedule.body.find((day: any) => day.day === "Monday")?.isClosed).toBe(true);
      expect(
        publicSchedule.body.find((day: any) => day.day === "Tuesday")?.slots.find((slot: any) => slot.time === "08:30")
          ?.isAvailable,
      ).toBe(false);

      const closedDate = nextDateForDay("Monday");
      const closedSlots = await request(app).get(`/api/public/available-slots?date=${closedDate}&duration=60`);
      expect(closedSlots.status).toBe(200);
      expect(closedSlots.body.slots).toEqual([]);

      const tuesdayDate = nextDateForDay("Tuesday");
      const tuesdaySlots = await request(app).get(`/api/public/available-slots?date=${tuesdayDate}&duration=60`);
      expect(tuesdaySlots.status).toBe(200);
      expect(
        tuesdaySlots.body.slots.some((slot: string) => {
          const date = new Date(slot);
          return date.getHours() === 8 && date.getMinutes() === 30;
        }),
      ).toBe(false);
    } finally {
      const restoreRes = await request(app)
        .post("/api/settings")
        .set(auth())
        .send({
          schedule: originalSchedule.map((day: any) => {
            if (day.day === "Monday") return monday;
            if (day.day === "Tuesday") return tuesday;
            return day;
          }),
        });
      expect(restoreRes.status).toBe(200);
    }
  });

  it("returns notifications", async () => {
    const res = await request(app).get("/api/settings/notifications").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe("Payments", () => {
  it("creates a payment for an appointment", async () => {
    // Create an appointment first
    const slotsRes = await request(app).get("/api/appointments/next-available?duration=60").set(auth());
    const openSlot = slotsRes.body.data[0];
    const appt = makeAppt({ date: openSlot });
    const apptRes = await request(app).post("/api/appointments").set(auth()).send(appt);
    const apptId = apptRes.body.id;

    const payment = {
      appointmentId: apptId,
      amount: 50,
      method: "card",
      type: "full",
      notes: "Test payment",
    };
    const res = await request(app).post("/api/payments").set(auth()).send(payment);
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.amount).toBe(50);
  });

  it("lists payments with pagination", async () => {
    const res = await request(app).get("/api/payments?page=1&limit=5").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe("Forms", () => {
  it("creates a consent form", async () => {
    const form = {
      name: `Consent Form ${Date.now()}`,
      description: "Test consent form",
      fields: JSON.stringify([{ name: "agreement", type: "checkbox", label: "I agree to terms" }]),
    };
    const res = await request(app).post("/api/forms").set(auth()).send(form);
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });

  it("lists active forms", async () => {
    const res = await request(app).get("/api/forms").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe("Search", () => {
  it("searches customers by name", async () => {
    const res = await request(app).get("/api/search?q=test").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.customers).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════
describe("Customer Tags", () => {
  it("sets and retrieves customer tags", async () => {
    // Create a customer
    const customer = {
      id: crypto.randomUUID(),
      name: "Tag Test User",
      email: `tag_${Date.now()}@example.com`,
      phone: "555-8888",
      pets: [],
    };
    const createRes = await request(app).post("/api/customers").set(auth()).send(customer);
    const customerId = createRes.body.id;

    // Set tags
    const tagRes = await request(app)
      .post(`/api/customers/${customerId}/tags`)
      .set(auth())
      .send({ tags: ["VIP", "Regular"] });
    expect(tagRes.status).toBe(200);

    // Get tags
    const getRes = await request(app).get(`/api/customers/${customerId}/tags`).set(auth());
    expect(getRes.status).toBe(200);
    expect(getRes.body).toContain("VIP");
    expect(getRes.body).toContain("Regular");

    // Cleanup
    await request(app).delete(`/api/customers/${customerId}`).set(auth());
  });
});

// ══════════════════════════════════════════════════════════
// Legacy flat describe (kept so existing CI passes)
describe("API Endpoints Integration Tests", () => {
  it("should return error 401 for protected route without auth", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.status).toBe(401);
  });

  it("should login with invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nonexistent@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("should return next available appointment slots for authenticated requests", async () => {
    const res = await request(app)
      .get("/api/appointments/next-available?duration=60")
      .set("Authorization", `Bearer ${testToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should suggest alternate slots when creating an overlapping appointment", async () => {
    const from = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    const availableRes = await request(app)
      .get(`/api/appointments/next-available?duration=60&from=${encodeURIComponent(from)}`)
      .set("Authorization", `Bearer ${testToken}`);
    const date = availableRes.body.data[0];

    const first = makeAppt({ date });
    const createRes = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${testToken}`)
      .send(first);
    expect(createRes.status).toBe(200);

    const secondRes = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ ...first, id: crypto.randomUUID(), petName: "Second Slot Dog" });
    expect(secondRes.status).toBe(200);

    const overlapRes = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ ...first, id: crypto.randomUUID(), petName: "Third Slot Dog" });
    expect(overlapRes.status).toBe(400);
    expect(Array.isArray(overlapRes.body.suggestions)).toBe(true);
  });

  it("should create and fully delete a customer", async () => {
    const customer = {
      id: crypto.randomUUID(),
      name: "Test Deletion User",
      email: `del2_${Date.now()}@example.com`,
      phone: "555-0000",
      pets: [{ id: crypto.randomUUID(), name: "TestPet", breed: "Mutt" }],
    };

    const createRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${testToken}`)
      .send(customer);
    expect(createRes.status).toBe(200);
    const serverId = createRes.body.id; // server generates its own UUID

    const deleteRes = await request(app)
      .delete(`/api/customers/${serverId}`)
      .set("Authorization", `Bearer ${testToken}`);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app).get("/api/customers").set("Authorization", `Bearer ${testToken}`);
    expect(getRes.status).toBe(200);
    const exists = (getRes.body.data as any[]).some((c) => c.id === serverId);
    expect(exists).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
describe("Authorization", () => {
  it("denies customer-role access to GET /api/customers", async () => {
    const res = await request(app).get("/api/customers").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("denies customer-role access to GET /api/appointments", async () => {
    const res = await request(app).get("/api/appointments").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("denies customer-role access to GET /api/analytics", async () => {
    const res = await request(app).get("/api/analytics").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("denies customer-role access to POST /api/payments", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ appointmentId: "x", amount: 10, method: "cash", type: "full" });
    expect(res.status).toBe(403);
  });

  it("allows groomer-role access to GET /api/appointments", async () => {
    const res = await request(app).get("/api/appointments").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
  });

  it("allows groomer-role access to GET /api/customers", async () => {
    const res = await request(app).get("/api/customers").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
  });

  it("denies groomer-role access to DELETE /api/appointments/:id", async () => {
    const res = await request(app).delete("/api/appointments/nonexistent").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it("denies groomer-role access to POST /api/services (admin-only)", async () => {
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ name: "Test Service" });
    expect(res.status).toBe(403);
  });

  it("allows receptionist-role access to POST /api/services", async () => {
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${receptionistToken}`)
      .send({ name: "Test Service" });
    expect(res.status).toBe(200);
  });

  it("denies customer-role access to GET /api/reports", async () => {
    const res = await request(app).get("/api/reports").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════
describe("Status transitions", () => {
  // Helper: create an appointment via the API to ensure it passes availability checks
  const createViaApi = async (statusOverride?: string) => {
    const slotsRes = await request(app).get("/api/appointments/next-available?duration=60").set(auth());
    const openSlot = slotsRes.body.data[0];
    const appt = makeAppt({ date: openSlot, status: statusOverride || "confirmed" });
    const createRes = await request(app).post("/api/appointments").set(auth()).send(appt);
    expect(createRes.status).toBe(200);
    const id = createRes.body.id;
    // If we need a different initial status, update directly in DB
    if (statusOverride && statusOverride !== "confirmed" && statusOverride !== "scheduled") {
      db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(statusOverride, id);
    }
    return { id, date: openSlot, appt: { ...appt, id } };
  };

  it("allows valid transition (confirmed → checked-in)", async () => {
    const { id, appt } = await createViaApi("confirmed");
    const res = await request(app)
      .put(`/api/appointments/${id}`)
      .set(auth())
      .send({ ...appt, id, status: "checked-in" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("checked-in");
  });

  it("rejects invalid transition (completed → in-progress)", async () => {
    const { id, appt } = await createViaApi("completed");
    const res = await request(app)
      .put(`/api/appointments/${id}`)
      .set(auth())
      .send({ ...appt, id, status: "in-progress" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Cannot transition");
  });

  it("rejects transition from terminal status (cancelled-by-salon → confirmed)", async () => {
    const { id, appt } = await createViaApi("cancelled-by-salon");
    const res = await request(app)
      .put(`/api/appointments/${id}`)
      .set(auth())
      .send({ ...appt, id, status: "confirmed" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Cannot transition");
  });

  it("sets server-side checkedInAt timestamp on check-in", async () => {
    const { id, appt } = await createViaApi("confirmed");
    const res = await request(app)
      .put(`/api/appointments/${id}`)
      .set(auth())
      .send({ ...appt, id, status: "checked-in" });
    expect(res.status).toBe(200);

    const row = db.prepare("SELECT checkedInAt FROM appointments WHERE id = ?").get(id) as any;
    expect(row.checkedInAt).toBeTruthy();
  });
});
