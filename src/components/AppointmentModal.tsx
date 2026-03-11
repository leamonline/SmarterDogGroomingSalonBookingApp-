import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { FieldError } from "@/src/components/ui/field-error";
import { useFormValidation, required, positiveNumber } from "@/src/lib/useFormValidation";
import { format } from "date-fns";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Truck,
  Play,
  Pause,
  Search,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { APPOINTMENT_STATUSES } from "@/src/types";
import { CustomerModal } from "@/src/components/CustomerModal";
import { api } from "@/src/lib/api";
import { handleError } from "@/src/lib/handleError";

import { BOOKING_CLOSE_TIME, BOOKING_OPEN_TIME, formatScheduleTime } from "@/src/lib/bookingSchedule";
import type { AppointmentClientLookupResult, Customer } from "@/src/types";

export type Appointment = {
  id: string;
  petName: string;
  breed: string;
  age?: string;
  notes?: string;
  ownerName: string;
  phone?: string;
  service: string;
  date: Date;
  duration: number;
  dogCount?: number;
  dogCountConfirmed?: boolean;
  dogCountReviewedAt?: string;
  dogCountReviewedBy?: string;
  status: string;
  price: number;
  avatar: string;
  // Lifecycle fields
  checkedInAt?: string;
  checkedInNotes?: string;
  groomNotes?: string;
  productsUsed?: string;
  behaviourDuringGroom?: string;
  completedAt?: string;
  aftercareNotes?: string;
  readyForCollectionAt?: string;
  surcharge?: number;
  surchargeReason?: string;
  finalPrice?: number;
  cancelledAt?: string;
  cancellationReason?: string;
  depositAmount?: number;
  customerId?: string;
  dogId?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
};

const STATUS_CONFIG: Record<string, { label: string; colour: string; icon: any }> = {
  "pending-approval": { label: "Pending Approval", colour: "bg-gold-light text-purple", icon: Clock },
  confirmed: { label: "Confirmed", colour: "bg-sky-light text-brand-700", icon: CheckCircle },
  scheduled: { label: "Scheduled", colour: "bg-sky-light text-brand-700", icon: Clock },
  "deposit-pending": { label: "Deposit Pending", colour: "bg-gold-light text-purple", icon: Clock },
  "deposit-paid": { label: "Deposit Paid", colour: "bg-brand-50 text-brand-800", icon: CheckCircle },
  "checked-in": { label: "Checked In", colour: "bg-brand-50 text-brand-800", icon: UserCheck },
  "in-progress": { label: "In Progress", colour: "bg-purple-light/20 text-purple", icon: Play },
  "ready-for-collection": { label: "Ready for Collection", colour: "bg-sage-light text-brand-700", icon: Truck },
  completed: { label: "Completed", colour: "bg-sage-light text-brand-700", icon: CheckCircle },
  "cancelled-by-customer": { label: "Cancelled (Customer)", colour: "bg-coral-light text-coral", icon: XCircle },
  "cancelled-by-salon": { label: "Cancelled (Salon)", colour: "bg-coral-light text-coral", icon: XCircle },
  "no-show": { label: "No Show", colour: "bg-coral-light text-coral", icon: AlertTriangle },
  rescheduled: { label: "Rescheduled", colour: "bg-brand-50 text-brand-800", icon: Clock },
  incomplete: { label: "Incomplete", colour: "bg-gold-light text-purple", icon: Pause },
  "incident-review": { label: "Incident Review", colour: "bg-coral-light text-coral", icon: AlertTriangle },
};

import { STATUS_TRANSITIONS } from "@/src/lib/statusTransitions";
import { formatDogCountReviewNote } from "@/src/lib/appointmentUtils";
import { AppointmentDetailsTab } from "@/src/components/appointment/AppointmentDetailsTab";
import { AppointmentCheckinTab } from "@/src/components/appointment/AppointmentCheckinTab";
import { AppointmentGroomTab } from "@/src/components/appointment/AppointmentGroomTab";
import { AppointmentCheckoutTab } from "@/src/components/appointment/AppointmentCheckoutTab";

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  initialData?: Partial<Appointment>;
  onSave: (updatedAppointment: Appointment) => void | Promise<boolean | void>;
}

const LINKED_LOOKUP_FIELDS = new Set(["petName", "breed", "ownerName", "phone"]);

function formatAgeFromDob(dob?: string | null) {
  if (!dob) return "";
  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) return "";

  const now = new Date();
  let years = now.getFullYear() - dobDate.getFullYear();
  const monthDelta = now.getMonth() - dobDate.getMonth();
  const beforeBirthday = monthDelta < 0 || (monthDelta === 0 && now.getDate() < dobDate.getDate());
  if (beforeBirthday) years -= 1;

  return years <= 0 ? "Under 1 year" : years === 1 ? "1 year" : `${years} years`;
}

function buildAppointmentNotes(match: AppointmentClientLookupResult) {
  return [...(match.petBehavioralNotes || []), match.customerNotes || ""].filter(Boolean).join(" • ");
}

function snapToHalfHour(date: Date) {
  const snapped = new Date(date);
  snapped.setSeconds(0, 0);
  const minutes = snapped.getMinutes();
  const remainder = minutes % 30;

  if (remainder !== 0) {
    snapped.setMinutes(minutes + (30 - remainder));
  }

  return snapped;
}

export function AppointmentModal({ isOpen, onClose, appointment, initialData, onSave }: AppointmentModalProps) {
  const [formData, setFormData] = useState<Partial<Appointment>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "checkin" | "groom" | "checkout">("details");
  const [lookupResults, setLookupResults] = useState<AppointmentClientLookupResult[]>([]);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [selectedLookupResult, setSelectedLookupResult] = useState<AppointmentClientLookupResult | null>(null);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const dogCountReviewNote = useMemo(
    () => formatDogCountReviewNote(formData.dogCountReviewedAt, formData.dogCountReviewedBy),
    [formData.dogCountReviewedAt, formData.dogCountReviewedBy],
  );

  const { errors, validate, clearError, clearAll } = useFormValidation<Appointment>({
    petName: required("Pet name"),
    ownerName: required("Owner name"),
    service: required("Service"),
    date: (v: any) => (!v ? "Date & time is required" : null),
    duration: (v: any) => (!v || Number(v) <= 0 ? "Duration must be greater than 0" : null),
    dogCount: (v: any) => {
      const count = Number(v);
      if (!Number.isInteger(count) || count < 1 || count > 4) {
        return "Dog count must be between 1 and 4";
      }
      return null;
    },
    price: positiveNumber("Price"),
  });
  // Track the last appointment id we initialised for, so we only reset
  // when a *different* appointment is opened (not when the modal re-opens
  // for the same one, which would lose in-progress edits).
  const lastAppointmentIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return; // don't reset while closed

    const incomingId = appointment?.id ?? null;
    if (incomingId === lastAppointmentIdRef.current && isOpen) return; // same appointment re-opened — keep state

    // New context: reset everything
    lastAppointmentIdRef.current = incomingId;
    setIsEditing(!appointment);
    setActiveTab("details");
    setLookupResults([]);
    setSelectedLookupResult(null);
    setIsNewClientModalOpen(false);
    clearAll();
    if (appointment) {
      setFormData(appointment);
    } else {
      setFormData({
        id: crypto.randomUUID(),
        petName: "",
        breed: "",
        age: "",
        notes: "",
        ownerName: "",
        phone: "",
        service: "",
        date: snapToHalfHour(new Date()),
        duration: 60,
        dogCount: 1,
        status: "confirmed",
        price: 0,
        avatar: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&h=150&fit=crop&q=80",
        ...initialData,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment, initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    clearError(name as keyof Appointment);
    setFormData((prev) => ({
      ...prev,
      ...(LINKED_LOOKUP_FIELDS.has(name) ? { customerId: undefined, dogId: undefined } : {}),
      [name]:
        name === "price" || name === "duration" || name === "dogCount" || name === "surcharge" || name === "finalPrice"
          ? Number(value)
          : value,
    }));
    if (LINKED_LOOKUP_FIELDS.has(name)) {
      setSelectedLookupResult(null);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError("date");
    const newDate = snapToHalfHour(new Date(e.target.value));
    setFormData((prev) => ({ ...prev, date: newDate }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(formData)) return;
    const result = await onSave(formData as Appointment);
    if (result !== false) {
      onClose();
    }
  };

  const lookupFilters = useMemo(
    () => ({
      ownerName: String(formData.ownerName || "").trim(),
      phone: String(formData.phone || "").trim(),
      petName: String(formData.petName || "").trim(),
      breed: String(formData.breed || "").trim(),
    }),
    [formData.ownerName, formData.phone, formData.petName, formData.breed],
  );

  useEffect(() => {
    if (!isOpen || appointment) return;

    const hasEnoughInput = Object.values(lookupFilters).some((value) => value.length >= 2);
    if (!hasEnoughInput || selectedLookupResult) {
      setLookupResults([]);
      setIsLookupLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLookupLoading(true);

    const timeout = window.setTimeout(async () => {
      try {
        const results = (await api.lookupAppointmentClients(lookupFilters)) as AppointmentClientLookupResult[];
        if (!isCancelled) {
          setLookupResults(results);
        }
      } catch {
        if (!isCancelled) {
          setLookupResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLookupLoading(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [appointment, isOpen, lookupFilters, selectedLookupResult]);

  const applyLookupResult = (match: AppointmentClientLookupResult) => {
    setSelectedLookupResult(match);
    setLookupResults([]);
    setFormData((prev) => ({
      ...prev,
      ownerName: match.customerName,
      phone: match.customerPhone || "",
      petName: match.petName,
      breed: match.petBreed || "",
      age: formatAgeFromDob(match.petDob),
      notes: buildAppointmentNotes(match),
      customerId: match.customerId,
      dogId: match.petId,
      emergencyContact: match.emergencyContactName || "",
      emergencyPhone: match.emergencyContactPhone || "",
      avatar:
        match.petPhoto ||
        prev.avatar ||
        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&h=150&fit=crop&q=80",
    }));
  };

  const clearSelectedLookup = () => {
    setSelectedLookupResult(null);
    setFormData((prev) => ({
      ...prev,
      customerId: undefined,
      dogId: undefined,
    }));
  };

  const handleSaveNewClient = async (customer: Customer) => {
    if (!customer.pets?.length) {
      handleError(new Error("Add at least one pet before creating a new client"), "Failed to create client");
      return false;
    }

    try {
      const createdCustomer = (await api.createCustomer(customer)) as Customer;
      const primaryPet = createdCustomer.pets?.[0];

      if (!primaryPet) {
        return false;
      }

      applyLookupResult({
        customerId: createdCustomer.id,
        customerName: createdCustomer.name,
        customerPhone: createdCustomer.phone || "",
        customerEmail: createdCustomer.email || "",
        customerAddress: createdCustomer.address || "",
        customerNotes: createdCustomer.notes || "",
        emergencyContactName: createdCustomer.emergencyContact?.name || "",
        emergencyContactPhone: createdCustomer.emergencyContact?.phone || "",
        petId: primaryPet.id,
        petName: primaryPet.name,
        petBreed: primaryPet.breed || "",
        petDob: primaryPet.dob || "",
        petCoatType: primaryPet.coatType || "",
        petPhoto: primaryPet.photo || "",
        petBehavioralNotes: primaryPet.behavioralNotes || [],
      });
      setFormData((prev) => ({
        ...prev,
        ownerName: createdCustomer.name,
        phone: createdCustomer.phone || "",
      }));
      toast.success(`${primaryPet.name} is ready to book`);
      setIsNewClientModalOpen(false);
      return true;
    } catch (err) {
      handleError(err, "Failed to create client");
      return false;
    }
  };

  const handleStatusChange = (newStatus: string) => {
    const now = new Date().toISOString();
    const updates: Partial<Appointment> = { status: newStatus };

    if (newStatus === "checked-in") updates.checkedInAt = now;
    if (newStatus === "completed") {
      updates.completedAt = now;
      updates.finalPrice = (formData.price || 0) + (formData.surcharge || 0);
    }
    if (newStatus === "ready-for-collection") updates.readyForCollectionAt = now;
    if (newStatus === "cancelled-by-customer" || newStatus === "cancelled-by-salon") updates.cancelledAt = now;

    const updated = { ...formData, ...updates } as Appointment;
    setFormData(updated);
    onSave(updated);
  };

  const currentStatus = formData.status || "scheduled";
  const statusInfo = (STATUS_CONFIG[currentStatus] || STATUS_CONFIG["scheduled"])!;
  const StatusIcon = statusInfo.icon;
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {appointment ? (isEditing ? "Edit Appointment" : "Appointment") : "New Appointment"}
            </DialogTitle>
            {appointment && !isEditing && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.colour}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {statusInfo.label}
              </span>
            )}
          </div>
        </DialogHeader>

        {!isEditing && appointment ? (
          <div className="space-y-4">
            {/* Workflow Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {(["details", "checkin", "groom", "checkout"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                    activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab === "details"
                    ? "Details"
                    : tab === "checkin"
                      ? "Check-in"
                      : tab === "groom"
                        ? "Groom"
                        : "Check-out"}
                </button>
              ))}
            </div>

            {activeTab === "details" && (
              <AppointmentDetailsTab formData={formData} dogCountReviewNote={dogCountReviewNote} />
            )}
            {activeTab === "checkin" && (
              <AppointmentCheckinTab formData={formData} onChange={handleChange} onSave={onSave} />
            )}
            {activeTab === "groom" && (
              <AppointmentGroomTab formData={formData} onChange={handleChange} onSave={onSave} />
            )}
            {activeTab === "checkout" && (
              <AppointmentCheckoutTab formData={formData} onChange={handleChange} onSave={onSave} />
            )}

            {/* Status Transition Buttons */}
            {nextStatuses.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((ns) => {
                    const cfg = STATUS_CONFIG[ns];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    return (
                      <Button
                        key={ns}
                        size="sm"
                        variant={ns.startsWith("cancel") || ns === "no-show" ? "destructive" : "outline"}
                        onClick={() => handleStatusChange(ns)}
                        className="text-xs"
                      >
                        <Icon className="h-3.5 w-3.5 mr-1" />
                        {cfg.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cancellation reason input */}
            {(currentStatus === "cancelled-by-customer" || currentStatus === "cancelled-by-salon") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Cancellation Reason</label>
                <Input
                  name="cancellationReason"
                  value={formData.cancellationReason || ""}
                  onChange={handleChange}
                  placeholder="Reason..."
                />
                <Button size="sm" onClick={() => onSave(formData as Appointment)}>
                  Save Reason
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="button" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {!appointment && (
              <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Previous pet lookup</h4>
                    <p className="text-sm text-slate-500">
                      Start typing a pet name, owner, phone number, or breed below to reuse an existing client.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setIsNewClientModalOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    New Client
                  </Button>
                </div>

                {selectedLookupResult && (
                  <div className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedLookupResult.petName} • {selectedLookupResult.customerName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedLookupResult.petBreed || "Breed not set"}{" "}
                        {selectedLookupResult.customerPhone ? `• ${selectedLookupResult.customerPhone}` : ""}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSelectedLookup}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Clear
                    </Button>
                  </div>
                )}

                {!selectedLookupResult && (isLookupLoading || lookupResults.length > 0) && (
                  <div className="rounded-xl border border-slate-200 bg-white">
                    {isLookupLoading && (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
                        <Search className="h-4 w-4" />
                        Looking up matching dogs and owners...
                      </div>
                    )}
                    {!isLookupLoading &&
                      lookupResults.map((match) => (
                        <button
                          key={`${match.customerId}-${match.petId}`}
                          type="button"
                          className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
                          onClick={() => applyLookupResult(match)}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{match.petName}</p>
                            <p className="text-sm text-slate-600">
                              {match.customerName}
                              {match.customerPhone ? ` • ${match.customerPhone}` : ""}
                            </p>
                            <p className="text-xs text-slate-500">
                              {match.petBreed || "Breed not set"}
                              {match.petCoatType ? ` • ${match.petCoatType}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-brand-700">Use details</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Pet Section */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pet Details</h4>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="petName" className="text-right text-sm font-medium">
                  {(formData.dogCount || 1) > 1 ? "Dog Name(s) *" : "Pet Name *"}
                </label>
                <div className="col-span-3">
                  <Input
                    id="petName"
                    name="petName"
                    value={formData.petName || ""}
                    onChange={handleChange}
                    placeholder={(formData.dogCount || 1) > 1 ? "e.g. Buddy, Bella & Milo" : undefined}
                    aria-invalid={!!errors.petName}
                  />
                  <FieldError message={errors.petName} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="breed" className="text-right text-sm font-medium">
                  Breed
                </label>
                <Input
                  id="breed"
                  name="breed"
                  value={formData.breed || ""}
                  onChange={handleChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="age" className="text-right text-sm font-medium">
                  Age
                </label>
                <Input
                  id="age"
                  name="age"
                  value={formData.age || ""}
                  onChange={handleChange}
                  className="col-span-3"
                  placeholder="e.g. 2 yrs"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="notes" className="text-right text-sm font-medium">
                  Notes
                </label>
                <Input
                  id="notes"
                  name="notes"
                  value={formData.notes || ""}
                  onChange={handleChange}
                  className="col-span-3"
                  placeholder="Behavior, allergies, etc."
                />
              </div>
            </div>

            {/* Owner Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner Details</h4>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="ownerName" className="text-right text-sm font-medium">
                  Owner Name *
                </label>
                <div className="col-span-3">
                  <Input
                    id="ownerName"
                    name="ownerName"
                    value={formData.ownerName || ""}
                    onChange={handleChange}
                    aria-invalid={!!errors.ownerName}
                  />
                  <FieldError message={errors.ownerName} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="phone" className="text-right text-sm font-medium">
                  Phone
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={handleChange}
                  className="col-span-3"
                />
              </div>
            </div>

            {/* Service Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Appointment Details</h4>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="service" className="text-right text-sm font-medium">
                  Service *
                </label>
                <div className="col-span-3">
                  <Input
                    id="service"
                    name="service"
                    value={formData.service || ""}
                    onChange={handleChange}
                    aria-invalid={!!errors.service}
                  />
                  <FieldError message={errors.service} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="date" className="text-right text-sm font-medium">
                  Date & Time *
                </label>
                <div className="col-span-3">
                  <Input
                    id="date"
                    name="date"
                    type="datetime-local"
                    step={1800}
                    min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    value={formData.date ? format(formData.date, "yyyy-MM-dd'T'HH:mm") : ""}
                    onChange={handleDateChange}
                    aria-invalid={!!errors.date}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Booking starts are set in 30-minute slots between {formatScheduleTime(BOOKING_OPEN_TIME)} and{" "}
                    {formatScheduleTime(BOOKING_CLOSE_TIME)}.
                  </p>
                  <FieldError message={errors.date} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="duration" className="text-right text-sm font-medium">
                  Duration (m) *
                </label>
                <div className="col-span-3">
                  <Input
                    id="duration"
                    name="duration"
                    type="number"
                    value={formData.duration || ""}
                    onChange={handleChange}
                    aria-invalid={!!errors.duration}
                  />
                  <FieldError message={errors.duration} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="dogCount" className="text-right text-sm font-medium">
                  Dogs *
                </label>
                <div className="col-span-3">
                  <Input
                    id="dogCount"
                    name="dogCount"
                    type="number"
                    min={1}
                    max={4}
                    value={formData.dogCount || 1}
                    onChange={handleChange}
                    aria-invalid={!!errors.dogCount}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Online booking rules support up to 4 dogs. Bookings for 3 or 4 dogs need consecutive drop-off slots.
                  </p>
                  {formData.dogCountConfirmed === false && (
                    <p className="mt-2 text-xs font-medium text-amber-700">
                      Save this booking after confirming the dog count to restore accurate slot capacity.
                    </p>
                  )}
                  {dogCountReviewNote && formData.dogCountConfirmed !== false && (
                    <p className="mt-2 text-xs font-medium text-brand-700">{dogCountReviewNote}</p>
                  )}
                  <FieldError message={errors.dogCount} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="price" className="text-right text-sm font-medium">
                  Price (GBP) *
                </label>
                <div className="col-span-3">
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    value={formData.price || ""}
                    onChange={handleChange}
                    aria-invalid={!!errors.price}
                  />
                  <FieldError message={errors.price} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="status" className="text-right text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || ""}
                  onChange={handleChange}
                  className="col-span-3 flex h-10 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                >
                  {APPOINTMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_CONFIG[s]?.label || s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 mt-4">
              <Button type="button" variant="outline" onClick={() => (appointment ? setIsEditing(false) : onClose())}>
                Cancel
              </Button>
              <Button type="submit">{appointment ? "Save changes" : "Create Appointment"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
      <CustomerModal
        isOpen={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
        customer={null}
        onSave={handleSaveNewClient}
      />
    </Dialog>
  );
}
