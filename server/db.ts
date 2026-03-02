import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { mockAppointments, mockCustomers, mockServices } from '../src/data/mockData.js';

const dbPath = path.resolve(process.cwd(), 'petspa.db');
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
    ownerName TEXT,
    service TEXT,
    date TEXT NOT NULL,
    duration INTEGER,
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
    isClosed INTEGER
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
  );
`);

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
  console.log('Seeding database with mock data...');

  // Removed default user seeding to prevent hardcoded credentials in production

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
    mockCustomers.forEach((c: any) => {
      insertCustomer.run(
        c.id, c.name, c.email || null, c.phone || null, c.address || null,
        c.emergencyContact?.name || null, c.emergencyContact?.phone || null,
        c.notes || null, c.lastVisit || null, c.totalSpent || 0
      );

      (c.warnings || []).forEach((w: string) => {
        insertWarning.run(c.id, w);
      });

      (c.pets || []).forEach((p: any) => {
        insertPet.run(p.id, c.id, p.name, p.breed || null, p.weight || null, p.dob || null, p.coatType || null);

        (p.behavioralNotes || []).forEach((bn: string) => {
          insertBehavior.run(p.id, bn);
        });

        (p.vaccinations || []).forEach((v: any) => {
          insertVax.run(p.id, v.name, v.expiryDate, v.status);
        });
      });

      (c.documents || []).forEach((d: any) => {
        insertDoc.run(d.id, c.id, d.name, d.type, d.uploadDate, d.url);
      });
    });
  })();

  const insertAppointment = db.prepare(`
    INSERT INTO appointments (id, petName, breed, ownerName, service, date, duration, status, price, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    mockAppointments.forEach((a: any) => {
      // JSON cannot store Date objects directly, we stringify to ISO format
      insertAppointment.run(
        a.id, a.petName, a.breed, a.ownerName, a.service, a.date.toISOString(),
        a.duration, a.status, a.price, a.avatar || null
      );
    });
  })();

  const insertService = db.prepare('INSERT INTO services (id, name, description, duration, price, category) VALUES (?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    mockServices.forEach((s: any) => {
      insertService.run(s.id, s.name, s.description || null, s.duration || 0, s.price || 0, s.category || null);
    });
  })();

  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('shopName', 'Savvy Pet Spa');
  insertSetting.run('shopPhone', '(555) 123-4567');
  insertSetting.run('shopAddress', '123 Grooming Lane, Pet City, PC 12345');

  const insertSchedule = db.prepare('INSERT INTO schedule (day, openTime, closeTime, isClosed) VALUES (?, ?, ?, ?)');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  days.forEach((day) => {
    insertSchedule.run(day, '08:00', '17:00', day === 'Sunday' ? 1 : 0);
  });

  const insertNotification = db.prepare('INSERT INTO notifications (id, message, isRead, createdAt) VALUES (?, ?, ?, ?)');
  insertNotification.run('1', 'System initialized successfully', 0, new Date().toISOString());

  console.log('Seeding complete.');
}

export default db;
