import React, { useState } from "react";
import { toast } from "sonner";
import { api } from "@/src/lib/api";
import type { Appointment } from "@/src/components/AppointmentModal";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import { UserCheck, Play, Truck, CheckCircle, XCircle, AlertTriangle, Loader2, ChevronRight } from "lucide-react";

// ─── Status machine ─────────────────────────────────────────────────────────
// Maps current status → array of [nextStatus, label, icon, style]
type ActionDef = {
  status: string;
  label: string;
  icon: React.ElementType;
  style: "primary" | "success" | "warning" | "danger";
};

const TRANSITIONS: Record<string, ActionDef[]> = {
  "pending-approval": [
    { status: "confirmed", label: "Approve", icon: CheckCircle, style: "primary" },
    { status: "cancelled-by-salon", label: "Decline", icon: XCircle, style: "danger" },
  ],
  confirmed: [
    { status: "checked-in", label: "Check In", icon: UserCheck, style: "primary" },
    { status: "no-show", label: "No Show", icon: AlertTriangle, style: "warning" },
    { status: "cancelled-by-salon", label: "Cancel", icon: XCircle, style: "danger" },
  ],
  scheduled: [
    { status: "checked-in", label: "Check In", icon: UserCheck, style: "primary" },
    { status: "no-show", label: "No Show", icon: AlertTriangle, style: "warning" },
    { status: "cancelled-by-salon", label: "Cancel", icon: XCircle, style: "danger" },
  ],
  "deposit-pending": [
    { status: "confirmed", label: "Mark Paid", icon: CheckCircle, style: "success" },
    { status: "cancelled-by-salon", label: "Cancel", icon: XCircle, style: "danger" },
  ],
  "deposit-paid": [{ status: "checked-in", label: "Check In", icon: UserCheck, style: "primary" }],
  "checked-in": [
    { status: "in-progress", label: "Start Groom", icon: Play, style: "primary" },
    { status: "cancelled-by-salon", label: "Cancel", icon: XCircle, style: "danger" },
  ],
  "in-progress": [
    { status: "ready-for-collection", label: "Ready", icon: Truck, style: "success" },
    { status: "incomplete", label: "Incomplete", icon: AlertTriangle, style: "warning" },
  ],
  "ready-for-collection": [{ status: "completed", label: "Collected", icon: CheckCircle, style: "success" }],
  // Terminal statuses — no actions
  completed: [],
  "cancelled-by-customer": [],
  "cancelled-by-salon": [],
  "no-show": [],
  incomplete: [],
  "incident-review": [],
  rescheduled: [],
};

const STYLE_CLASSES: Record<string, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  success: "bg-accent text-white hover:bg-accent/90",
  warning: "bg-warning text-white hover:bg-warning/90",
  danger: "bg-coral text-white hover:bg-coral/90",
};

// ─── Component ───────────────────────────────────────────────────────────────
interface AppointmentStatusBarProps {
  appointment: Appointment;
  onUpdated: (updated: Appointment) => void;
  /** Compact: shows only icons with tooltip-like labels. Full: shows icon + label text */
  compact?: boolean;
}

const DESTRUCTIVE_STYLES = new Set(["danger", "warning"]);

const CONFIRM_MESSAGES: Record<string, { title: string; description: string }> = {
  "cancelled-by-salon": {
    title: "Cancel Appointment",
    description: "Are you sure you want to cancel this appointment? This cannot be undone.",
  },
  "no-show": {
    title: "Mark as No Show",
    description: "Are you sure you want to mark this appointment as a no-show? This cannot be undone.",
  },
  incomplete: {
    title: "Mark as Incomplete",
    description: "Are you sure you want to mark this groom as incomplete? This cannot be undone.",
  },
};

export function AppointmentStatusBar({ appointment, onUpdated, compact = false }: AppointmentStatusBarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionDef | null>(null);

  const actions = TRANSITIONS[appointment.status] ?? [];
  if (actions.length === 0) return null;

  const handleClick = (action: ActionDef) => {
    if (DESTRUCTIVE_STYLES.has(action.style)) {
      setPendingAction(action);
    } else {
      advance(action);
    }
  };

  const advance = async (action: ActionDef) => {
    setLoading(action.status);
    const now = new Date().toISOString();
    const updates: Partial<Appointment> = { status: action.status };

    if (action.status === "checked-in") updates.checkedInAt = now;
    if (action.status === "in-progress") {
      /* groomer starts */
    }
    if (action.status === "ready-for-collection") updates.readyForCollectionAt = now;
    if (action.status === "completed") {
      updates.completedAt = now;
      updates.finalPrice = (appointment.price || 0) + (appointment.surcharge || 0);
    }
    if (action.status === "cancelled-by-salon" || action.status === "cancelled-by-customer") {
      updates.cancelledAt = now;
    }

    const updated = { ...appointment, ...updates } as Appointment;
    try {
      await api.updateAppointment(appointment.id, updated);
      onUpdated(updated);
      toast.success(`${appointment.petName} → ${action.label}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {actions.map((action) => {
        const Icon = action.icon;
        const isLoading = loading === action.status;
        return (
          <button
            key={action.status}
            onClick={() => handleClick(action)}
            disabled={!!loading}
            title={action.label}
            className={`
                            inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium
                            transition-all disabled:opacity-50 disabled:cursor-not-allowed
                            ${STYLE_CLASSES[action.style]}
                        `}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            {!compact && <span>{action.label}</span>}
            {!compact && <ChevronRight className="h-3 w-3 opacity-60" />}
          </button>
        );
      })}
      {pendingAction && (
        <ConfirmDialog
          isOpen
          title={CONFIRM_MESSAGES[pendingAction.status]?.title ?? pendingAction.label}
          description={
            CONFIRM_MESSAGES[pendingAction.status]?.description ??
            `Are you sure you want to mark ${appointment.petName}'s appointment as "${pendingAction.label}"? This cannot be undone.`
          }
          confirmText={pendingAction.label}
          variant="destructive"
          onConfirm={() => {
            const action = pendingAction;
            setPendingAction(null);
            advance(action);
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
