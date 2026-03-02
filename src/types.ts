// ────────────────────────────
// Enums / Constants
// ────────────────────────────

export const APPOINTMENT_STATUSES = [
  'pending-approval',
  'confirmed',
  'deposit-pending',
  'deposit-paid',
  'checked-in',
  'in-progress',
  'ready-for-collection',
  'completed',
  'cancelled-by-customer',
  'cancelled-by-salon',
  'no-show',
  'rescheduled',
  'incomplete',
  'incident-review',
  // Legacy statuses kept for backwards compat
  'scheduled',
] as const;

export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number];

export const USER_ROLES = ['customer', 'groomer', 'receptionist', 'owner'] as const;
export type UserRole = typeof USER_ROLES[number];

export const PAYMENT_METHODS = ['card', 'cash', 'bank-transfer'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const PAYMENT_TYPES = ['deposit', 'full', 'partial', 'refund', 'partial-refund'] as const;
export type PaymentType = typeof PAYMENT_TYPES[number];

export const PRICE_TYPES = ['fixed', 'variable', 'from'] as const;
export type PriceType = typeof PRICE_TYPES[number];

export const TOLERANCE_LEVELS = ['good', 'fair', 'poor', 'unknown'] as const;
export type ToleranceLevel = typeof TOLERANCE_LEVELS[number];

export const MESSAGE_CHANNELS = ['email', 'sms'] as const;
export type MessageChannel = typeof MESSAGE_CHANNELS[number];

// ────────────────────────────
// Vaccinations
// ────────────────────────────

export type Vaccination = {
  name: string;
  expiryDate: string;
  status: 'valid' | 'expired' | 'missing';
};

// ────────────────────────────
// Pet / Dog Profile
// ────────────────────────────

export type Pet = {
  id: string;
  name: string;
  breed: string;
  weight: number;
  dob: string;
  coatType: string;
  behavioralNotes: string[];
  vaccinations: Vaccination[];

  // Sprint 1: Expanded profile
  photo?: string;
  sex?: string;
  neuteredStatus?: string;
  coatLength?: string;
  colour?: string;
  vetName?: string;
  vetPhone?: string;
  sizeCategory?: string;
  estimatedGroomDuration?: number;

  // Tolerances
  dryingTolerance?: ToleranceLevel;
  clipperTolerance?: ToleranceLevel;
  scissorTolerance?: ToleranceLevel;
  nailTrimTolerance?: ToleranceLevel;
  mattingTendency?: string;

  // Health & safety
  medicalNotes?: string;
  allergies?: string;
  mobilityNotes?: string;
  seniorCareNotes?: string;
  biteRisk?: string;
  approvalRequired?: boolean;

  // Style & history
  stylePreferences?: string;
  isArchived?: boolean;

  // Tags
  tags?: string[];
};

// ────────────────────────────
// Documents
// ────────────────────────────

export type Document = {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  url: string;
};

// ────────────────────────────
// Customer Record
// ────────────────────────────

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: {
    name: string;
    phone: string;
  };
  notes: string;
  warnings: string[];
  pets: Pet[];
  lastVisit: string;
  totalSpent: number;
  documents?: Document[];

  // Sprint 1: Expanded profile
  preferredName?: string;
  postcode?: string;
  preferredContact?: 'email' | 'phone' | 'sms';
  marketingConsent?: boolean;
  tags?: string[];
};

// ────────────────────────────
// Add-on
// ────────────────────────────

export type AddOn = {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  isOptional: boolean;
  isActive: boolean;
};

// ────────────────────────────
// Service
// ────────────────────────────

export type Service = {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  category?: string;

  // Sprint 1 enhancements
  isOnlineBookable?: boolean;
  isApprovalRequired?: boolean;
  depositRequired?: boolean;
  depositAmount?: number;
  consentFormRequired?: boolean;
  preBuffer?: number;
  postBuffer?: number;
  priceType?: PriceType;
  isActive?: boolean;
  addOns?: AddOn[];
};

// ────────────────────────────
// Payment
// ────────────────────────────

export type Payment = {
  id: string;
  appointmentId: string;
  customerId?: string;
  amount: number;
  method: PaymentMethod;
  type: PaymentType;
  status: string;
  notes?: string;
  createdAt: string;
};

// ────────────────────────────
// Form & Consent
// ────────────────────────────

export type FormField = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox' | 'select' | 'date' | 'signature';
  required?: boolean;
  options?: string[];
  conditionalOn?: string;
};

export type Form = {
  id: string;
  name: string;
  description?: string;
  version: number;
  fields: FormField[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type FormSubmission = {
  id: string;
  formId: string;
  customerId?: string;
  dogId?: string;
  appointmentId?: string;
  data: Record<string, any>;
  signature?: string;
  submittedAt: string;
};

// ────────────────────────────
// Audit Log
// ────────────────────────────

export type AuditLogEntry = {
  id: number;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
};

// ────────────────────────────
// Message
// ────────────────────────────

export type Message = {
  id: string;
  customerId?: string;
  appointmentId?: string;
  channel: MessageChannel;
  templateName?: string;
  subject?: string;
  body: string;
  status: string;
  sentAt?: string;
  createdAt: string;
};
