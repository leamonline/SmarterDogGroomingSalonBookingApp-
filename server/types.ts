/**
 * Server-side types for database row results.
 * These represent the raw shape of rows returned by better-sqlite3 queries.
 */

// ── Users ──────────────────────────────────────────
export interface UserRow {
  id: string;
  email: string;
  password: string;
  role: string;
  passwordChangedAt: string | null;
  createdAt: string;
}

// ── Customers ──────────────────────────────────────
export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string;
  lastVisit: string;
  totalSpent: number;
  preferredName: string | null;
  postcode: string | null;
  preferredContact: string | null;
  marketingConsent: number | null;
}

// ── Pets ───────────────────────────────────────────
export interface PetRow {
  id: string;
  customerId: string;
  name: string;
  breed: string;
  weight: number;
  dob: string;
  coatType: string;
  photo: string | null;
  sex: string | null;
  neuteredStatus: string | null;
  coatLength: string | null;
  colour: string | null;
  vetName: string | null;
  vetPhone: string | null;
  sizeCategory: string | null;
  estimatedGroomDuration: number | null;
  dryingTolerance: string | null;
  clipperTolerance: string | null;
  scissorTolerance: string | null;
  nailTrimTolerance: string | null;
  mattingTendency: string | null;
  medicalNotes: string | null;
  allergies: string | null;
  mobilityNotes: string | null;
  seniorCareNotes: string | null;
  biteRisk: string | null;
  approvalRequired: number | null;
  stylePreferences: string | null;
  isArchived: number | null;
}

// ── Vaccinations ───────────────────────────────────
export interface VaccinationRow {
  petId: string;
  name: string;
  expiryDate: string;
  status: string;
}

// ── Documents ──────────────────────────────────────
export interface DocumentRow {
  id: string;
  customerId: string;
  name: string;
  type: string;
  uploadDate: string;
  url: string;
}

// ── Customer warnings ──────────────────────────────
export interface WarningRow {
  customerId: string;
  warning: string;
}

// ── Pet tags / customer tags ───────────────────────
export interface TagRow {
  entityId: string;
  tag: string;
}

export interface BehavioralNoteRow {
  petId: string;
  note: string;
}

// ── Services ───────────────────────────────────────
export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  category: string | null;
  isOnlineBookable: number | null;
  isApprovalRequired: number | null;
  depositRequired: number | null;
  depositAmount: number | null;
  consentFormRequired: number | null;
  preBuffer: number | null;
  postBuffer: number | null;
  priceType: string | null;
  isActive: number | null;
}

// ── Add-ons ────────────────────────────────────────
export interface AddOnRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  isOptional: number;
  isActive: number;
}

// ── Appointments ───────────────────────────────────
export interface AppointmentRow {
  id: string;
  customerId: string;
  dogId: string | null;
  petId: string;
  serviceId: string;
  groomerId: string | null;
  date: string;
  time: string;
  duration: number;
  dogCount: number | null;
  dogCountConfirmed: number | null;
  dogCountReviewedAt: string | null;
  dogCountReviewedBy: string | null;
  price: number;
  status: string;
  notes: string | null;
  depositAmount: number | null;
  cancelReason: string | null;
  customerName: string | null;
  petName: string | null;
  serviceName: string | null;
  groomerName: string | null;
  createdAt: string;
}

// ── Payments ───────────────────────────────────────
export interface PaymentRow {
  id: string;
  appointmentId: string;
  customerId: string | null;
  amount: number;
  method: string;
  type: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

// ── Schedule ───────────────────────────────────────
export interface ScheduleRow {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: number;
}

// ── Messages ───────────────────────────────────────
export interface MessageRow {
  id: string;
  customerId: string | null;
  appointmentId: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  channel: string;
  templateName: string | null;
  subject: string | null;
  body: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

// ── Forms ──────────────────────────────────────────
export interface FormRow {
  id: string;
  name: string;
  description: string | null;
  version: number;
  fields: string; // JSON string
  isActive: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface FormSubmissionRow {
  id: string;
  formId: string;
  customerId: string | null;
  dogId: string | null;
  appointmentId: string | null;
  data: string; // JSON string
  signature: string | null;
  submittedAt: string;
}

// ── Generic count result ───────────────────────────
export interface CountRow {
  count: number;
}

// ── Availability check result ──────────────────────
export interface AvailabilityResult {
  notFound: boolean;
  conflict: boolean;
  suggestions?: string[];
  reason?: string;
  old: AppointmentRow | null;
}
