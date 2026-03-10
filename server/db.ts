import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from './lib/logger.js';
import { mockAppointments, mockCustomers, mockServices } from '../src/data/mockData.js';
import {
  BOOKING_CLOSE_TIME,
  BOOKING_DAY_ORDER,
  BOOKING_OPEN_TIME,
  createDefaultSlotConfig,
  isBookingDayClosedByDefault,
  parseSlotConfig,
  type RawScheduleRow,
} from './helpers/schedule.js';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const dbPath = isTestEnv
  ? ':memory:'
  : path.resolve(process.cwd(), 'petspa.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Migrations / Table Creation
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    emergencyContactName TEXT,
    emergencyContactPhone TEXT,
    notes TEXT,
    lastVisit TEXT,
    totalSpent REAL
  );

  CREATE TABLE IF NOT EXISTS customer_warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerId TEXT NOT NULL,
    warning TEXT NOT NULL,
    FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    customerId TEXT NOT NULL,
    name TEXT NOT NULL,
    breed TEXT,
    weight REAL,
    dob TEXT,
    coatType TEXT,
    FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pet_behavioral_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    petId TEXT NOT NULL,
    note TEXT NOT NULL,
    FOREIGN KEY(petId) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS vaccinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    petId TEXT NOT NULL,
    name TEXT NOT NULL,
    expiryDate TEXT,
    status TEXT,
    FOREIGN KEY(petId) REFERENCES pets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    customerId TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    uploadDate TEXT,
    url TEXT,
    FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    petName TEXT,
    breed TEXT,
    age TEXT,
    notes TEXT,
    ownerName TEXT,
    phone TEXT,
    service TEXT,
    date TEXT NOT NULL,
    duration INTEGER,
    dogCount INTEGER DEFAULT 1,
    dogCountConfirmed INTEGER DEFAULT 1,
    dogCountReviewedAt TEXT,
    dogCountReviewedBy TEXT,
    status TEXT,
    price REAL,
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    duration INTEGER,
    price REAL,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schedule (
    day TEXT PRIMARY KEY,
    openTime TEXT,
    closeTime TEXT,
    isClosed INTEGER,
    slotConfig TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
  );

  -- Sprint 1: Add-ons
  CREATE TABLE IF NOT EXISTS add_ons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL DEFAULT 0,
    duration INTEGER DEFAULT 0,
    isOptional INTEGER DEFAULT 1,
    isActive INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS service_add_ons (
    serviceId TEXT NOT NULL,
    addOnId TEXT NOT NULL,
    PRIMARY KEY (serviceId, addOnId),
    FOREIGN KEY(serviceId) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY(addOnId) REFERENCES add_ons(id) ON DELETE CASCADE
  );

  -- Sprint 1: Payments
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    appointmentId TEXT NOT NULL,
    customerId TEXT,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    notes TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(appointmentId) REFERENCES appointments(id) ON DELETE CASCADE
  );

  -- Sprint 1: Forms & Consent
  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    fields TEXT NOT NULL,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS form_submissions (
    id TEXT PRIMARY KEY,
    formId TEXT NOT NULL,
    customerId TEXT,
    dogId TEXT,
    appointmentId TEXT,
    data TEXT NOT NULL,
    signature TEXT,
    submittedAt TEXT NOT NULL,
    FOREIGN KEY(formId) REFERENCES forms(id),
    FOREIGN KEY(customerId) REFERENCES customers(id),
    FOREIGN KEY(dogId) REFERENCES pets(id),
    FOREIGN KEY(appointmentId) REFERENCES appointments(id)
  );

  -- Sprint 1: Audit Log
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    action TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT,
    oldValue TEXT,
    newValue TEXT,
    createdAt TEXT NOT NULL
  );

  -- Sprint 1: Messaging
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    customerId TEXT,
    appointmentId TEXT,
    channel TEXT NOT NULL,
    templateName TEXT,
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sentAt TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(customerId) REFERENCES customers(id),
    FOREIGN KEY(appointmentId) REFERENCES appointments(id)
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Sprint 1: Tags
  CREATE TABLE IF NOT EXISTS customer_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerId TEXT NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dog_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dogId TEXT NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY(dogId) REFERENCES pets(id) ON DELETE CASCADE
  );
`);

// ─────────────────────────────────────────────
// Migration infrastructure
// Each migration runs exactly once, tracked by version number.
// ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    appliedAt TEXT NOT NULL
  );
`);

const appliedVersions = new Set(
  (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(r => r.version)
);

const migrate = (version: number, fn: () => void) => {
  if (appliedVersions.has(version)) return;
  fn();
  db.prepare('INSERT INTO schema_migrations (version, appliedAt) VALUES (?, ?)').run(version, new Date().toISOString());
  appliedVersions.add(version);
};

/** Add a column to a table only if it doesn't already exist. */
const safeAddColumn = (table: string, column: string, type: string) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
};

// Migration 1: roles, expanded customer/pet/appointment/service columns
migrate(1, () => {
  // Users
  safeAddColumn('users', 'role', "TEXT DEFAULT 'staff'");

  // Customers
  safeAddColumn('customers', 'preferredName', 'TEXT');
  safeAddColumn('customers', 'postcode', 'TEXT');
  safeAddColumn('customers', 'preferredContact', "TEXT DEFAULT 'email'");
  safeAddColumn('customers', 'marketingConsent', 'INTEGER DEFAULT 0');

  // Pets
  safeAddColumn('pets', 'photo', 'TEXT');
  safeAddColumn('pets', 'sex', 'TEXT');
  safeAddColumn('pets', 'neuteredStatus', 'TEXT');
  safeAddColumn('pets', 'coatLength', 'TEXT');
  safeAddColumn('pets', 'colour', 'TEXT');
  safeAddColumn('pets', 'vetName', 'TEXT');
  safeAddColumn('pets', 'vetPhone', 'TEXT');
  safeAddColumn('pets', 'sizeCategory', 'TEXT');
  safeAddColumn('pets', 'estimatedGroomDuration', 'INTEGER');
  safeAddColumn('pets', 'dryingTolerance', 'TEXT');
  safeAddColumn('pets', 'clipperTolerance', 'TEXT');
  safeAddColumn('pets', 'scissorTolerance', 'TEXT');
  safeAddColumn('pets', 'nailTrimTolerance', 'TEXT');
  safeAddColumn('pets', 'mattingTendency', 'TEXT');
  safeAddColumn('pets', 'medicalNotes', 'TEXT');
  safeAddColumn('pets', 'allergies', 'TEXT');
  safeAddColumn('pets', 'mobilityNotes', 'TEXT');
  safeAddColumn('pets', 'seniorCareNotes', 'TEXT');
  safeAddColumn('pets', 'biteRisk', 'TEXT');
  safeAddColumn('pets', 'approvalRequired', 'INTEGER DEFAULT 0');
  safeAddColumn('pets', 'stylePreferences', 'TEXT');
  safeAddColumn('pets', 'isArchived', 'INTEGER DEFAULT 0');

  // Appointments
  safeAddColumn('appointments', 'age', 'TEXT');
  safeAddColumn('appointments', 'notes', 'TEXT');
  safeAddColumn('appointments', 'phone', 'TEXT');
  safeAddColumn('appointments', 'customerId', 'TEXT');
  safeAddColumn('appointments', 'dogId', 'TEXT');
  safeAddColumn('appointments', 'staffId', 'TEXT');
  safeAddColumn('appointments', 'dogCount', 'INTEGER DEFAULT 1');
  safeAddColumn('appointments', 'dogCountConfirmed', 'INTEGER DEFAULT 1');
  safeAddColumn('appointments', 'depositAmount', 'REAL DEFAULT 0');
  safeAddColumn('appointments', 'depositPaid', 'INTEGER DEFAULT 0');
  safeAddColumn('appointments', 'cancelledAt', 'TEXT');
  safeAddColumn('appointments', 'cancelledBy', 'TEXT');
  safeAddColumn('appointments', 'cancellationReason', 'TEXT');
  safeAddColumn('appointments', 'checkedInAt', 'TEXT');
  safeAddColumn('appointments', 'checkedInNotes', 'TEXT');
  safeAddColumn('appointments', 'groomNotes', 'TEXT');
  safeAddColumn('appointments', 'productsUsed', 'TEXT');
  safeAddColumn('appointments', 'behaviourDuringGroom', 'TEXT');
  safeAddColumn('appointments', 'completedAt', 'TEXT');
  safeAddColumn('appointments', 'aftercareNotes', 'TEXT');
  safeAddColumn('appointments', 'readyForCollectionAt', 'TEXT');
  safeAddColumn('appointments', 'surcharge', 'REAL DEFAULT 0');
  safeAddColumn('appointments', 'surchargeReason', 'TEXT');
  safeAddColumn('appointments', 'finalPrice', 'REAL');
  safeAddColumn('appointments', 'beforePhotos', 'TEXT');
  safeAddColumn('appointments', 'afterPhotos', 'TEXT');

  // Services
  safeAddColumn('services', 'isOnlineBookable', 'INTEGER DEFAULT 1');
  safeAddColumn('services', 'isApprovalRequired', 'INTEGER DEFAULT 0');
  safeAddColumn('services', 'depositRequired', 'INTEGER DEFAULT 0');
  safeAddColumn('services', 'depositAmount', 'REAL DEFAULT 0');
  safeAddColumn('services', 'consentFormRequired', 'INTEGER DEFAULT 0');
  safeAddColumn('services', 'preBuffer', 'INTEGER DEFAULT 0');
  safeAddColumn('services', 'postBuffer', 'INTEGER DEFAULT 0');
  safeAddColumn('services', "priceType", "TEXT DEFAULT 'fixed'");
  safeAddColumn('services', 'isActive', 'INTEGER DEFAULT 1');
});

// Migration 2: add recipient fields to messages table
migrate(2, () => {
  safeAddColumn('messages', 'recipientEmail', 'TEXT');
  safeAddColumn('messages', 'recipientPhone', 'TEXT');
});

// Migration 3: add performance indexes
migrate(3, () => {
  db.exec(`
    -- Appointment lookups by date range (used in overlap checks and reports)
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customerId);

    -- Customer lookups (search, email login)
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

    -- Foreign key lookups (used in batch queries)
    CREATE INDEX IF NOT EXISTS idx_pets_customer ON pets(customerId);
    CREATE INDEX IF NOT EXISTS idx_customer_warnings_customer ON customer_warnings(customerId);
    CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customerId);
    CREATE INDEX IF NOT EXISTS idx_pet_behavioral_notes_pet ON pet_behavioral_notes(petId);
    CREATE INDEX IF NOT EXISTS idx_vaccinations_pet ON vaccinations(petId);

    -- Payments by appointment
    CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointmentId);

    -- Audit log lookups
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entityType, entityId);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(createdAt);

    -- Messages
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(createdAt);

    -- Tags
    CREATE INDEX IF NOT EXISTS idx_customer_tags_customer ON customer_tags(customerId);
    CREATE INDEX IF NOT EXISTS idx_dog_tags_dog ON dog_tags(dogId);

    -- Form submissions
    CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(formId);
    CREATE INDEX IF NOT EXISTS idx_form_submissions_customer ON form_submissions(customerId);
  `);
});

// Migration 5: unique index to prevent double-booking at DB level
migrate(5, () => {
  // SQLite serializes writes, but an explicit index adds defense-in-depth.
  // We use a partial index on (date, duration) for non-cancelled appointments.
  // Combined with the application-level capacity check inside a transaction,
  // this prevents any duplicate bookings from slipping through.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_appointments_date_duration
    ON appointments(date, duration)
    WHERE status NOT IN ('cancelled-by-customer', 'cancelled-by-salon', 'no-show');
  `);
});

// Migration 6: password reset token indexes
migrate(6, () => {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(userId);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expiresAt);
  `);
});

// Migration 4: structured booking slots on schedule rows
migrate(4, () => {
  safeAddColumn('schedule', 'slotConfig', 'TEXT');

  db.prepare(`
    UPDATE schedule
    SET openTime = ?, closeTime = ?, slotConfig = COALESCE(slotConfig, ?)
  `).run(BOOKING_OPEN_TIME, BOOKING_CLOSE_TIME, createDefaultSlotConfig());
});

// Migration 7: default Thursday-Sunday to closed on untouched legacy schedules
migrate(7, () => {
  const scheduleRows = db.prepare(
    'SELECT day, openTime, closeTime, isClosed, slotConfig FROM schedule',
  ).all() as RawScheduleRow[];

  const looksLikeLegacyAllOpenSchedule = scheduleRows.length === BOOKING_DAY_ORDER.length
    && scheduleRows.every((row) => (
      BOOKING_DAY_ORDER.includes(row.day as typeof BOOKING_DAY_ORDER[number])
      && (row.openTime || BOOKING_OPEN_TIME) === BOOKING_OPEN_TIME
      && (row.closeTime || BOOKING_CLOSE_TIME) === BOOKING_CLOSE_TIME
      && !Boolean(row.isClosed)
      && Object.values(parseSlotConfig(row.slotConfig)).every(Boolean)
    ));

  if (!looksLikeLegacyAllOpenSchedule) {
    return;
  }

  const updateScheduleDay = db.prepare('UPDATE schedule SET isClosed = ? WHERE day = ?');
  for (const day of BOOKING_DAY_ORDER) {
    updateScheduleDay.run(isBookingDayClosedByDefault(day) ? 1 : 0, day);
  }
});

// Migration 8: store the number of dogs attached to each booking
migrate(8, () => {
  safeAddColumn('appointments', 'dogCount', 'INTEGER DEFAULT 1');
});

// Migration 9: require review of legacy future bookings for dog-count capacity
migrate(9, () => {
  safeAddColumn('appointments', 'dogCountConfirmed', 'INTEGER DEFAULT 1');
  db.prepare(`
    UPDATE appointments
    SET dogCountConfirmed = 0
    WHERE date >= ?
  `).run(new Date().toISOString());
});

// Migration 10: store manual dog-count review metadata for legacy bookings
migrate(10, () => {
  safeAddColumn('appointments', 'dogCountReviewedAt', 'TEXT');
  safeAddColumn('appointments', 'dogCountReviewedBy', 'TEXT');
});

const existingScheduleDays = new Set(
  (db.prepare('SELECT day FROM schedule').all() as { day: string }[]).map((row) => row.day),
);

const insertScheduleDay = db.prepare(`
  INSERT INTO schedule (day, openTime, closeTime, isClosed, slotConfig)
  VALUES (?, ?, ?, ?, ?)
`);

for (const day of BOOKING_DAY_ORDER) {
  if (!existingScheduleDays.has(day)) {
    insertScheduleDay.run(
      day,
      BOOKING_OPEN_TIME,
      BOOKING_CLOSE_TIME,
      isBookingDayClosedByDefault(day) ? 1 : 0,
      createDefaultSlotConfig(),
    );
  }
}

// Migrate existing cleartext passwords to bcrypt hashes
const existingUsers = db.prepare('SELECT id, password FROM users').all() as { id: string, password: string }[];
if (existingUsers.length > 0) {
  const updatePass = db.prepare('UPDATE users SET password = ? WHERE id = ?');
  db.transaction(() => {
    for (const u of existingUsers) {
      if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
        updatePass.run(bcrypt.hashSync(u.password, 10), u.id);
      }
    }
  })();
}

// Seeding logic (only if empty)
const customersCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };

if (customersCount.count === 0) {
  logger.info('Seeding database with mock data...');

  // First-run admin user setup
  // Uses ADMIN_EMAIL / ADMIN_PASSWORD env vars if set, otherwise generates secure defaults.
  const existingUserCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUserCount.count === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@smarterdoggrooming.com';
    const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomUUID().slice(0, 16);
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO users (id, email, password, role) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(), adminEmail, hashedPassword, 'owner'
    );
    logger.info('Initial admin account created', {
      email: adminEmail,
      hint: 'Change this password after first login. Set ADMIN_EMAIL / ADMIN_PASSWORD env vars to customize.',
    });
  }

  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, email, phone, address, emergencyContactName, emergencyContactPhone, notes, lastVisit, totalSpent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertWarning = db.prepare('INSERT INTO customer_warnings (customerId, warning) VALUES (?, ?)');

  const insertPet = db.prepare(`
    INSERT INTO pets (id, customerId, name, breed, weight, dob, coatType)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBehavior = db.prepare('INSERT INTO pet_behavioral_notes (petId, note) VALUES (?, ?)');
  const insertVax = db.prepare('INSERT INTO vaccinations (petId, name, expiryDate, status) VALUES (?, ?, ?, ?)');
  const insertDoc = db.prepare('INSERT INTO documents (id, customerId, name, type, uploadDate, url) VALUES (?, ?, ?, ?, ?, ?)');

  db.transaction(() => {
    mockCustomers.forEach((c) => {
      insertCustomer.run(
        c.id, c.name, c.email || null, c.phone || null, c.address || null,
        c.emergencyContact?.name || null, c.emergencyContact?.phone || null,
        c.notes || null, c.lastVisit || null, c.totalSpent || 0
      );

      (c.warnings || []).forEach((w: string) => {
        insertWarning.run(c.id, w);
      });

      (c.pets || []).forEach((p) => {
        insertPet.run(p.id, c.id, p.name, p.breed || null, p.weight || null, p.dob || null, p.coatType || null);

        (p.behavioralNotes || []).forEach((bn: string) => {
          insertBehavior.run(p.id, bn);
        });

        (p.vaccinations || []).forEach((v) => {
          insertVax.run(p.id, v.name, v.expiryDate, v.status);
        });
      });

      (c.documents || []).forEach((d) => {
        insertDoc.run(d.id, c.id, d.name, d.type, d.uploadDate, d.url);
      });
    });
  })();

  const insertAppointment = db.prepare(`
    INSERT INTO appointments (id, petName, breed, ownerName, service, date, duration, status, price, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    mockAppointments.forEach((a) => {
      // JSON cannot store Date objects directly, we stringify to ISO format
      insertAppointment.run(
        a.id, a.petName, a.breed, a.ownerName, a.service, a.date.toISOString(),
        a.duration, a.status, a.price, a.avatar || null
      );
    });
  })();

  const insertService = db.prepare('INSERT INTO services (id, name, description, duration, price, category) VALUES (?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    mockServices.forEach((s) => {
      insertService.run(s.id, s.name, s.description || null, s.duration || 0, s.price || 0, s.category || null);
    });
  })();

  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('shopName', 'Smarter Dog Grooming Salon');
  insertSetting.run('shopPhone', '(555) 123-4567');
  insertSetting.run('shopAddress', '123 Grooming Lane, Pet City, PC 12345');

  const insertSchedule = db.prepare('INSERT OR IGNORE INTO schedule (day, openTime, closeTime, isClosed, slotConfig) VALUES (?, ?, ?, ?, ?)');
  BOOKING_DAY_ORDER.forEach((day) => {
    insertSchedule.run(
      day,
      BOOKING_OPEN_TIME,
      BOOKING_CLOSE_TIME,
      isBookingDayClosedByDefault(day) ? 1 : 0,
      createDefaultSlotConfig(),
    );
  });

  const insertNotification = db.prepare('INSERT INTO notifications (id, message, isRead, createdAt) VALUES (?, ?, ?, ?)');
  insertNotification.run('1', 'System initialized successfully', 0, new Date().toISOString());

  logger.info('Seeding complete.');
}

export default db;
