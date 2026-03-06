import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { FieldError } from "@/src/components/ui/field-error";
import { useFormValidation, required, positiveNumber } from "@/src/lib/useFormValidation";
import { Badge } from "@/src/components/ui/badge";
import { PaymentPanel } from "@/src/components/PaymentPanel";
import { format } from "date-fns";
import { CheckCircle, Clock, AlertTriangle, XCircle, Truck, Play, Pause, UserCheck } from "lucide-react";
import { APPOINTMENT_STATUSES } from "@/src/types";
import { formatCurrency } from "@/src/lib/utils";
import { BOOKING_CLOSE_TIME, BOOKING_OPEN_TIME, formatScheduleTime } from "@/src/lib/bookingSchedule";

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
};

const STATUS_CONFIG: Record<string, { label: string; colour: string; icon: any }> = {
  'pending-approval': { label: 'Pending Approval', colour: 'bg-amber-100 text-amber-800', icon: Clock },
  'confirmed': { label: 'Confirmed', colour: 'bg-sky-light text-brand-700', icon: CheckCircle },
  'scheduled': { label: 'Scheduled', colour: 'bg-sky-light text-brand-700', icon: Clock },
  'deposit-pending': { label: 'Deposit Pending', colour: 'bg-orange-100 text-orange-800', icon: Clock },
  'deposit-paid': { label: 'Deposit Paid', colour: 'bg-teal-100 text-teal-800', icon: CheckCircle },
  'checked-in': { label: 'Checked In', colour: 'bg-brand-50 text-brand-800', icon: UserCheck },
  'in-progress': { label: 'In Progress', colour: 'bg-purple-100 text-purple-800', icon: Play },
  'ready-for-collection': { label: 'Ready for Collection', colour: 'bg-sage-light text-brand-700', icon: Truck },
  'completed': { label: 'Completed', colour: 'bg-sage-light text-brand-700', icon: CheckCircle },
  'cancelled-by-customer': { label: 'Cancelled (Customer)', colour: 'bg-coral-light text-coral', icon: XCircle },
  'cancelled-by-salon': { label: 'Cancelled (Salon)', colour: 'bg-coral-light text-coral', icon: XCircle },
  'no-show': { label: 'No Show', colour: 'bg-coral-light text-coral', icon: AlertTriangle },
  'rescheduled': { label: 'Rescheduled', colour: 'bg-slate-100 text-slate-800', icon: Clock },
  'incomplete': { label: 'Incomplete', colour: 'bg-orange-100 text-orange-800', icon: Pause },
  'incident-review': { label: 'Incident Review', colour: 'bg-coral-light text-coral', icon: AlertTriangle },
};

// Valid next-status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending-approval': ['confirmed', 'cancelled-by-salon'],
  'confirmed': ['checked-in', 'cancelled-by-customer', 'cancelled-by-salon', 'no-show', 'rescheduled'],
  'scheduled': ['checked-in', 'cancelled-by-customer', 'cancelled-by-salon', 'no-show', 'rescheduled'],
  'deposit-pending': ['deposit-paid', 'cancelled-by-customer', 'cancelled-by-salon'],
  'deposit-paid': ['confirmed', 'checked-in'],
  'checked-in': ['in-progress', 'cancelled-by-salon'],
  'in-progress': ['ready-for-collection', 'completed', 'incomplete', 'incident-review'],
  'ready-for-collection': ['completed'],
  'completed': [],
  'cancelled-by-customer': [],
  'cancelled-by-salon': [],
  'no-show': [],
  'rescheduled': ['confirmed', 'scheduled'],
  'incomplete': ['incident-review'],
  'incident-review': ['completed'],
};

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  initialData?: Partial<Appointment>;
  onSave: (updatedAppointment: Appointment) => void;
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
  const [activeTab, setActiveTab] = useState<'details' | 'checkin' | 'groom' | 'checkout'>('details');

  const { errors, validate, clearError, clearAll } = useFormValidation<Appointment>({
    petName: required('Pet name'),
    ownerName: required('Owner name'),
    service: required('Service'),
    date: (v: any) => (!v ? 'Date & time is required' : null),
    duration: (v: any) => (!v || Number(v) <= 0 ? 'Duration must be greater than 0' : null),
    price: positiveNumber('Price'),
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
    setActiveTab('details');
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
      [name]: name === "price" || name === "duration" || name === "surcharge" || name === "finalPrice" ? Number(value) : value,
    }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError('date');
    const newDate = snapToHalfHour(new Date(e.target.value));
    setFormData((prev) => ({ ...prev, date: newDate }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(formData)) return;
    onSave(formData as Appointment);
    onClose();
  };

  const handleStatusChange = (newStatus: string) => {
    const now = new Date().toISOString();
    const updates: Partial<Appointment> = { status: newStatus };

    if (newStatus === 'checked-in') updates.checkedInAt = now;
    if (newStatus === 'completed') {
      updates.completedAt = now;
      updates.finalPrice = (formData.price || 0) + (formData.surcharge || 0);
    }
    if (newStatus === 'ready-for-collection') updates.readyForCollectionAt = now;
    if (newStatus === 'cancelled-by-customer' || newStatus === 'cancelled-by-salon') updates.cancelledAt = now;

    const updated = { ...formData, ...updates } as Appointment;
    setFormData(updated);
    onSave(updated);
  };

  const currentStatus = formData.status || 'scheduled';
  const statusInfo = STATUS_CONFIG[currentStatus] || STATUS_CONFIG['scheduled'];
  const StatusIcon = statusInfo.icon;
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{appointment ? (isEditing ? "Edit Appointment" : "Appointment") : "New Appointment"}</DialogTitle>
            {appointment && !isEditing && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.colour}`}>
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
              {(['details', 'checkin', 'groom', 'checkout'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {tab === 'details' ? 'Details' : tab === 'checkin' ? 'Check-in' : tab === 'groom' ? 'Groom' : 'Check-out'}
                </button>
              ))}
            </div>

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pet</h3>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow-sm flex-shrink-0">
                        <img src={formData.avatar} alt={formData.petName} className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{formData.petName}</h4>
                        <p className="text-sm text-slate-500">{formData.breed || "Unknown breed"}{formData.age ? ` • ${formData.age}` : ""}</p>
                      </div>
                    </div>
                    {formData.notes && (
                      <div className="mt-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                        <span className="font-semibold text-xs text-slate-400">Notes:</span> {formData.notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</h3>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1">
                    <p className="text-sm"><span className="font-medium text-slate-700">Name:</span> {formData.ownerName}</p>
                    <p className="text-sm"><span className="font-medium text-slate-700">Phone:</span> {formData.phone || "—"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Service</h3>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 grid grid-cols-2 gap-2">
                    <p className="text-sm"><span className="font-medium text-slate-700">Service:</span> {formData.service}</p>
                    <p className="text-sm"><span className="font-medium text-slate-700">Duration:</span> {formData.duration}m</p>
                    <p className="text-sm"><span className="font-medium text-slate-700">Date:</span> {formData.date ? format(formData.date, "EEE d MMM, h:mm a") : ""}</p>
                    <p className="text-sm"><span className="font-medium text-slate-700">Price:</span> {formatCurrency(formData.price)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Check-in Tab */}
            {activeTab === 'checkin' && (
              <div className="space-y-4">
                {formData.checkedInAt && (
                  <div className="text-xs text-accent font-medium flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Checked in at {format(new Date(formData.checkedInAt), "h:mm a")}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Check-in Notes</label>
                  <textarea
                    name="checkedInNotes"
                    value={formData.checkedInNotes || ""}
                    onChange={handleChange}
                    placeholder="Health changes, coat condition, behaviour at arrival..."
                    className="w-full min-h-[80px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onSave({ ...formData, checkedInNotes: formData.checkedInNotes } as Appointment);
                  }}
                >
                  Save Check-in Notes
                </Button>
              </div>
            )}

            {/* Groom Tab */}
            {activeTab === 'groom' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Groom Notes</label>
                  <textarea name="groomNotes" value={formData.groomNotes || ""} onChange={handleChange} placeholder="Style details, clips used..." className="w-full min-h-[60px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Products Used</label>
                  <Input name="productsUsed" value={formData.productsUsed || ""} onChange={handleChange} placeholder="Shampoo, conditioner..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Behaviour During Groom</label>
                  <Input name="behaviourDuringGroom" value={formData.behaviourDuringGroom || ""} onChange={handleChange} placeholder="Calm, anxious, bitey..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Surcharge (GBP)</label>
                    <Input name="surcharge" type="number" value={formData.surcharge || 0} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Surcharge Reason</label>
                    <Input name="surchargeReason" value={formData.surchargeReason || ""} onChange={handleChange} placeholder="Matting, extra time..." />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onSave({ ...formData } as Appointment);
                  }}
                >
                  Save Groom Notes
                </Button>
              </div>
            )}

            {/* Check-out Tab */}
            {activeTab === 'checkout' && (
              <div className="space-y-4">
                {/* Payment Panel */}
                <PaymentPanel
                  appointmentId={formData.id || ''}
                  totalDue={(formData.price || 0) + (formData.surcharge || 0)}
                  depositRequired={formData.depositAmount as number | undefined}
                />

                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <label className="text-sm font-medium text-slate-700">Aftercare Notes</label>
                  <textarea name="aftercareNotes" value={formData.aftercareNotes || ""} onChange={handleChange} placeholder="Recommendations for the owner..." className="w-full min-h-[60px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2" />
                  <Button
                    size="sm"
                    onClick={() => {
                      onSave({ ...formData, aftercareNotes: formData.aftercareNotes } as Appointment);
                    }}
                  >
                    Save Aftercare Notes
                  </Button>
                </div>

                {formData.completedAt && (
                  <div className="text-xs text-accent font-medium flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Completed at {format(new Date(formData.completedAt), "h:mm a")}
                  </div>
                )}
              </div>
            )}

            {/* Status Transition Buttons */}
            {nextStatuses.length > 0 && (
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map(ns => {
                    const cfg = STATUS_CONFIG[ns];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    return (
                      <Button
                        key={ns}
                        size="sm"
                        variant={ns.startsWith('cancel') || ns === 'no-show' ? 'destructive' : 'outline'}
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
            {(currentStatus === 'cancelled-by-customer' || currentStatus === 'cancelled-by-salon') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Cancellation Reason</label>
                <Input name="cancellationReason" value={formData.cancellationReason || ""} onChange={handleChange} placeholder="Reason..." />
                <Button size="sm" onClick={() => onSave(formData as Appointment)}>Save Reason</Button>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              <Button type="button" onClick={() => setIsEditing(true)}>Edit</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Pet Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-slate-900 border-b pb-2">Pet Details</h4>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="petName" className="text-right text-sm font-medium">Pet Name *</label>
                <div className="col-span-3">
                  <Input id="petName" name="petName" value={formData.petName || ""} onChange={handleChange} aria-invalid={!!errors.petName} />
                  <FieldError message={errors.petName} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="breed" className="text-right text-sm font-medium">Breed</label>
                <Input id="breed" name="breed" value={formData.breed || ""} onChange={handleChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="age" className="text-right text-sm font-medium">Age</label>
                <Input id="age" name="age" value={formData.age || ""} onChange={handleChange} className="col-span-3" placeholder="e.g. 2 yrs" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="notes" className="text-right text-sm font-medium">Notes</label>
                <Input id="notes" name="notes" value={formData.notes || ""} onChange={handleChange} className="col-span-3" placeholder="Behavior, allergies, etc." />
              </div>
            </div>

            {/* Owner Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="font-medium text-slate-900 border-b pb-2">Owner Details</h4>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="ownerName" className="text-right text-sm font-medium">Owner Name *</label>
                <div className="col-span-3">
                  <Input id="ownerName" name="ownerName" value={formData.ownerName || ""} onChange={handleChange} aria-invalid={!!errors.ownerName} />
                  <FieldError message={errors.ownerName} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="phone" className="text-right text-sm font-medium">Phone</label>
                <Input id="phone" name="phone" type="tel" value={formData.phone || ""} onChange={handleChange} className="col-span-3" />
              </div>
            </div>

            {/* Service Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="font-medium text-slate-900 border-b pb-2">Appointment Details</h4>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="service" className="text-right text-sm font-medium">Service *</label>
                <div className="col-span-3">
                  <Input id="service" name="service" value={formData.service || ""} onChange={handleChange} aria-invalid={!!errors.service} />
                  <FieldError message={errors.service} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="date" className="text-right text-sm font-medium">Date & Time *</label>
                <div className="col-span-3">
                  <Input id="date" name="date" type="datetime-local" step={1800} value={formData.date ? format(formData.date, "yyyy-MM-dd'T'HH:mm") : ""} onChange={handleDateChange} aria-invalid={!!errors.date} />
                  <p className="mt-1 text-xs text-slate-500">
                    Booking starts are set in 30-minute slots between {formatScheduleTime(BOOKING_OPEN_TIME)} and {formatScheduleTime(BOOKING_CLOSE_TIME)}.
                  </p>
                  <FieldError message={errors.date} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="duration" className="text-right text-sm font-medium">Duration (m) *</label>
                <div className="col-span-3">
                  <Input id="duration" name="duration" type="number" value={formData.duration || ""} onChange={handleChange} aria-invalid={!!errors.duration} />
                  <FieldError message={errors.duration} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="price" className="text-right text-sm font-medium">Price (GBP) *</label>
                <div className="col-span-3">
                  <Input id="price" name="price" type="number" value={formData.price || ""} onChange={handleChange} aria-invalid={!!errors.price} />
                  <FieldError message={errors.price} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="status" className="text-right text-sm font-medium">Status</label>
                <select id="status" name="status" value={formData.status || ""} onChange={handleChange} className="col-span-3 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
                  {APPOINTMENT_STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 mt-4">
              <Button type="button" variant="outline" onClick={() => appointment ? setIsEditing(false) : onClose()}>
                Cancel
              </Button>
              <Button type="submit">{appointment ? "Save changes" : "Create Appointment"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
