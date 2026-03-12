import React from "react";
import { format } from "date-fns";
import { Clock3, UserRound, Dog as DogIcon, Mail, AlertTriangle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Select } from "@/src/components/ui/select";
import { formatCurrency } from "@/src/lib/utils";
import {
  formatStatusLabel,
  formatDogCountLabel,
  formatDogCountReviewNote,
} from "@/src/lib/appointmentUtils";
import { AppointmentStatusBar } from "@/src/components/AppointmentStatusBar";
import type { Appointment } from "@/src/components/AppointmentModal";

// ── Types ──
type CalendarFilter = "all" | "needs-action" | "capacity-review" | "in-salon" | "done";

const LIVE_STATUSES = new Set(["ready-for-collection"]);

const STATUS_GROUPS: { label: string; statuses: Set<string>; tone: string }[] = [
  { label: "Action Needed", statuses: new Set(["pending-approval"]), tone: "text-gold" },
  { label: "Ready", statuses: new Set(["ready-for-collection"]), tone: "text-sky-600" },
  { label: "Upcoming", statuses: new Set(["booked", "deposit-paid"]), tone: "text-brand-600" },
  { label: "Done/Cancelled", statuses: new Set(["cancelled-by-customer", "cancelled-by-salon", "no-show"]), tone: "text-slate-500" },
];

interface CalendarSidebarProps {
  selectedDay: Date;
  selectedDayAppointments: Appointment[];
  selectedDayRevenue: number;
  upcomingCapacityReview: Appointment[];
  isConfirmingAllReviewItems: boolean;
  reviewDogCounts: Record<string, number>;
  confirmingAppointmentIds: string[];
  onAppointmentClick: (appointment: Appointment) => void;
  onNewAppointmentClick: () => void;
  onStatusUpdate: (appointment: Appointment) => void;
  onOpenCapacityReview: (appointment: Appointment) => void;
  onConfirmReviewItem: (appointment: Appointment) => void;
  onConfirmAllReviewItems: () => void;
  onReviewDogCountChange: (appointmentId: string, value: string) => void;
  getReviewDogCount: (appointment: Appointment) => number;
  isConfirmingReviewItem: (appointmentId: string) => boolean;
  onOpenClientProfile: (customerId?: string) => void;
  onOpenDogProfile: (dogId?: string) => void;
  onOpenMessaging: (appointment: Appointment) => void;
}

export function CalendarSidebar({
  selectedDay, selectedDayAppointments, selectedDayRevenue,
  upcomingCapacityReview, isConfirmingAllReviewItems,
  onAppointmentClick, onNewAppointmentClick, onStatusUpdate,
  onOpenCapacityReview, onConfirmReviewItem, onConfirmAllReviewItems,
  onReviewDogCountChange, getReviewDogCount, isConfirmingReviewItem,
  onOpenClientProfile, onOpenDogProfile, onOpenMessaging,
}: CalendarSidebarProps) {
  return (
    <Card className="h-fit xl:h-full">
      <CardHeader className="space-y-4">
        {upcomingCapacityReview.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Capacity review queue</p>
                <p className="text-xs text-amber-800">Set the dog count here, then confirm without opening every booking.</p>
              </div>
              <Badge variant="outline" className="border-amber-200 bg-white text-amber-800">
                {upcomingCapacityReview.length} waiting
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => upcomingCapacityReview[0] && onOpenCapacityReview(upcomingCapacityReview[0])}
                disabled={isConfirmingAllReviewItems}
              >
                Open next
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onConfirmAllReviewItems}
                disabled={isConfirmingAllReviewItems}
              >
                {isConfirmingAllReviewItems ? "Confirming queue..." : "Confirm all current counts"}
              </Button>
            </div>
            <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">
              {upcomingCapacityReview.map((appointment) => {
                const isSaving = isConfirmingReviewItem(appointment.id);
                return (
                  <div key={appointment.id} className="rounded-lg border border-amber-200 bg-white px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{appointment.petName}</p>
                        <p className="text-sm text-slate-600">{format(appointment.date, "EEE d MMM • h:mm a")}</p>
                        <p className="text-xs text-amber-800">{appointment.ownerName}</p>
                      </div>
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                        Needs review
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-[110px]">
                        <Select
                          size="sm"
                          value={String(getReviewDogCount(appointment))}
                          onChange={(event) => onReviewDogCountChange(appointment.id, event.target.value)}
                          disabled={isSaving || isConfirmingAllReviewItems}
                          aria-label={`Dog count for ${appointment.petName}`}
                        >
                          <option value="1">1 dog</option>
                          <option value="2">2 dogs</option>
                          <option value="3">3 dogs</option>
                          <option value="4">4 dogs</option>
                        </Select>
                      </div>
                      <div className="flex flex-1 flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onConfirmReviewItem(appointment)}
                          disabled={isSaving || isConfirmingAllReviewItems}
                        >
                          {isSaving ? "Confirming..." : "Confirm count"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenCapacityReview(appointment)}
                          disabled={isSaving || isConfirmingAllReviewItems}
                        >
                          Open booking
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <CardTitle>{format(selectedDay, "EEEE d MMMM")}</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            {selectedDayAppointments.length} appointments in view for this day.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bookings</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{selectedDayAppointments.length}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">In Salon</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {selectedDayAppointments.filter((a) => LIVE_STATUSES.has(a.status)).length}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Revenue</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(selectedDayRevenue)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {selectedDayAppointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
            <p className="text-sm font-semibold text-slate-900">No appointments in this view</p>
            <p className="mt-1 text-sm text-slate-500">Try another filter, switch days, or add a new booking.</p>
            <Button className="mt-4" size="sm" variant="outline" onClick={onNewAppointmentClick}>
              Add Appointment
            </Button>
          </div>
        ) : (
          (() => {
            const grouped = STATUS_GROUPS.map((group) => ({
              ...group,
              appointments: selectedDayAppointments.filter((a) => group.statuses.has(a.status)),
            })).filter((g) => g.appointments.length > 0);

            const groupedIds = new Set(grouped.flatMap((g) => g.appointments.map((a) => a.id)));
            const ungrouped = selectedDayAppointments.filter((a) => !groupedIds.has(a.id));
            if (ungrouped.length > 0) {
              grouped.push({ label: "Other", appointments: ungrouped, statuses: new Set(), tone: "text-slate-500" });
            }

            return grouped.map((group) => (
              <div key={group.label}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${group.tone}`}>
                  {group.label} ({group.appointments.length})
                </p>
                <div className="space-y-2">
                  {group.appointments.map((appointment) => (
                    <div key={appointment.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {format(appointment.date, "h:mm a")} • {appointment.petName}
                          </p>
                          <p className="text-sm text-slate-600">{appointment.service} for {appointment.ownerName}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {formatStatusLabel(appointment.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-4 w-4" />
                          {appointment.duration} mins
                        </span>
                        <span className="font-medium text-slate-900">{formatCurrency(appointment.price)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{formatDogCountLabel(appointment.dogCount)}</Badge>
                        {appointment.dogCountConfirmed === false && (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                            Capacity review needed
                          </Badge>
                        )}
                      </div>
                      {appointment.dogCountConfirmed !== false && (() => {
                        const reviewNote = formatDogCountReviewNote(appointment.dogCountReviewedAt, appointment.dogCountReviewedBy);
                        return reviewNote ? <p className="mt-2 text-xs font-medium text-brand-700">{reviewNote}</p> : null;
                      })()}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          {appointment.customerId && (
                            <Button type="button" size="sm" variant="outline" onClick={() => onOpenClientProfile(appointment.customerId)}>
                              <UserRound className="mr-1.5 h-3.5 w-3.5" /> Client
                            </Button>
                          )}
                          {appointment.dogId && (
                            <Button type="button" size="sm" variant="outline" onClick={() => onOpenDogProfile(appointment.dogId)}>
                              <DogIcon className="mr-1.5 h-3.5 w-3.5" /> Dog
                            </Button>
                          )}
                          {appointment.customerId && (
                            <Button type="button" size="sm" variant="outline" onClick={() => onOpenMessaging(appointment)}>
                              <Mail className="mr-1.5 h-3.5 w-3.5" /> Message
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <AppointmentStatusBar appointment={appointment} onUpdated={onStatusUpdate} />
                          <Button type="button" size="sm" variant="outline" onClick={() => onAppointmentClick(appointment)}>
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()
        )}
      </CardContent>
    </Card>
  );
}
