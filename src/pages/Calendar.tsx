import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grip,
  Plus,
  Scissors,
  Truck,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { api } from "@/src/lib/api";
import { cn, formatCurrency } from "@/src/lib/utils";
import { handleError } from "@/src/lib/handleError";
import { AppointmentModal, Appointment } from "@/src/components/AppointmentModal";
import { AppointmentStatusBar } from "@/src/components/AppointmentStatusBar";
import { CalendarSkeleton } from "@/src/components/ui/skeleton";
import { useLocation } from "react-router-dom";

type CalendarFilter = "all" | "needs-action" | "in-salon" | "done";

const LIVE_STATUSES = new Set(["checked-in", "in-progress", "ready-for-collection"]);
const NEEDS_ACTION_STATUSES = new Set([
  "pending-approval",
  "deposit-pending",
  "ready-for-collection",
  "incident-review",
  "scheduled",
  "confirmed",
  "deposit-paid",
]);
const DONE_STATUSES = new Set(["completed", "cancelled-by-customer", "cancelled-by-salon", "no-show"]);

function matchesFilter(appointment: Appointment, filter: CalendarFilter) {
  if (filter === "needs-action") {
    return NEEDS_ACTION_STATUSES.has(appointment.status);
  }
  if (filter === "in-salon") {
    return LIVE_STATUSES.has(appointment.status);
  }
  if (filter === "done") {
    return DONE_STATUSES.has(appointment.status);
  }

  return true;
}

function formatStatusLabel(status: string) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAppointmentTone(status: string) {
  if (status === "ready-for-collection") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (status === "completed") {
    return "border-sage bg-sage-light text-brand-700";
  }
  if (status === "in-progress") {
    return "border-sky bg-sky-light text-brand-700";
  }
  if (status === "checked-in") {
    return "border-brand-200 bg-brand-50 text-brand-700";
  }
  if (status.includes("cancelled") || status === "no-show") {
    return "border-coral/30 bg-coral-light text-coral";
  }

  return "border-brand-200 bg-brand-50 text-brand-700";
}

function formatHourLabel(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CalendarFilter>("all");
  const [loading, setLoading] = useState(true);

  const location = useLocation();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getAppointments();
        setAppointments(data.map((item: any) => ({ ...item, date: new Date(item.date) })));
      } catch (err) {
        handleError(err, "Failed to load appointments");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (location.state?.appointmentId && appointments.length > 0) {
      const targetAppointment = appointments.find((appointment) => appointment.id === location.state.appointmentId);
      if (targetAppointment) {
        setCurrentDate(targetAppointment.date);
        setSelectedDay(targetAppointment.date);
        setSelectedAppointment(targetAppointment);
        setIsModalOpen(true);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, appointments]);

  const startDate = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEndExclusive = useMemo(() => addDays(startDate, 7), [startDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, index) => addDays(startDate, index)), [startDate]);
  const hours = useMemo(() => Array.from({ length: 10 }).map((_, index) => index + 8), []);
  const allWeekAppointments = useMemo(
    () => appointments
      .filter((appointment) => appointment.date >= startDate && appointment.date < weekEndExclusive)
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [appointments, startDate, weekEndExclusive],
  );
  const weekAppointments = useMemo(
    () => allWeekAppointments.filter((appointment) => matchesFilter(appointment, activeFilter)),
    [allWeekAppointments, activeFilter],
  );
  const selectedDayAppointments = useMemo(
    () => weekAppointments.filter((appointment) => isSameDay(appointment.date, selectedDay)),
    [weekAppointments, selectedDay],
  );

  const handleAppointmentClick = useCallback((appointment: Appointment) => {
    setSelectedDay(appointment.date);
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  }, []);

  const handleNewAppointmentClick = useCallback(() => {
    setSelectedAppointment(null);
    setIsModalOpen(true);
  }, []);

  const handleSaveAppointment = useCallback(async (
    updatedAppointment: Appointment,
    options?: { successMessage?: string },
  ) => {
    try {
      const exists = appointments.some((appointment) => appointment.id === updatedAppointment.id);
      if (exists) {
        await api.updateAppointment(updatedAppointment.id, updatedAppointment);
        setAppointments((prev) =>
          prev.map((appointment) => (appointment.id === updatedAppointment.id ? updatedAppointment : appointment)),
        );
      } else {
        await api.createAppointment(updatedAppointment);
        setAppointments((prev) => [...prev, updatedAppointment]);
      }

      if (options?.successMessage) {
        toast.success(options.successMessage);
      }

      return true;
    } catch (err) {
      handleError(err, "Failed to save appointment");
      return false;
    }
  }, [appointments]);

  const handleStatusUpdate = useCallback((updatedAppointment: Appointment) => {
    setAppointments((prev) =>
      prev.map((appointment) => (appointment.id === updatedAppointment.id ? updatedAppointment : appointment)),
    );
  }, []);

  const handleDragStart = useCallback((event: React.DragEvent, appointmentId: string) => {
    event.dataTransfer.setData("appointmentId", appointmentId);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent, targetDay: Date) => {
    event.preventDefault();
    const appointmentId = event.dataTransfer.getData("appointmentId");
    if (!appointmentId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const droppedHour = Math.floor(y / 96) + 8;
    const droppedMinute = Math.round(((y % 96) / 96) * 60);
    const snappedMinute = Math.round(droppedMinute / 30) * 30;

    const appointmentToUpdate = appointments.find((appointment) => appointment.id === appointmentId);
    if (appointmentToUpdate) {
      const newDate = new Date(targetDay);
      newDate.setHours(droppedHour, snappedMinute, 0, 0);

      const updatedAppointment = { ...appointmentToUpdate, date: newDate };
      const saved = await handleSaveAppointment(updatedAppointment, {
        successMessage: `${appointmentToUpdate.petName} moved to ${format(newDate, "EEE h:mm a")}`,
      });

      if (saved) {
        setSelectedDay(targetDay);
      }
    }
  }, [appointments, handleSaveAppointment]);

  const shiftWeek = useCallback((days: number) => {
    setCurrentDate((prev) => addDays(prev, days));
    setSelectedDay((prev) => addDays(prev, days));
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now);
  }, []);

  const weeklyInSalon = useMemo(() => weekAppointments.filter((a) => LIVE_STATUSES.has(a.status)).length, [weekAppointments]);
  const weeklyNeedsAction = useMemo(() => weekAppointments.filter((a) => NEEDS_ACTION_STATUSES.has(a.status)).length, [weekAppointments]);
  const weeklyDone = useMemo(() => weekAppointments.filter((a) => DONE_STATUSES.has(a.status)).length, [weekAppointments]);
  const selectedDayRevenue = useMemo(
    () => selectedDayAppointments
      .filter((a) => !a.status.includes("cancelled") && a.status !== "no-show")
      .reduce((sum, a) => sum + (a.price || 0), 0),
    [selectedDayAppointments],
  );

  const filterOptions = useMemo<Array<{ value: CalendarFilter; label: string; count: number }>>(() => [
    { value: "all", label: "All", count: allWeekAppointments.length },
    { value: "needs-action", label: "Needs Action", count: allWeekAppointments.filter((a) => matchesFilter(a, "needs-action")).length },
    { value: "in-salon", label: "In Salon", count: allWeekAppointments.filter((a) => matchesFilter(a, "in-salon")).length },
    { value: "done", label: "Done", count: allWeekAppointments.filter((a) => matchesFilter(a, "done")).length },
  ], [allWeekAppointments]);

  if (loading) return <CalendarSkeleton />;

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-purple">Calendar</h1>
          <p className="text-sm text-slate-500">
            Drag appointments to reschedule, filter the floor view, and use the day agenda to keep staff aligned.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-slate-200 bg-white shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => shiftWeek(-7)} className="h-9 w-9 rounded-full border-r border-slate-200">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={goToToday} className="h-9 rounded-none px-4 text-sm font-medium">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => shiftWeek(7)} className="h-9 w-9 rounded-full border-l border-slate-200">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleNewAppointmentClick}>
            <Plus className="mr-2 h-4 w-4" />
            New Appointment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visible This Week</CardTitle>
            <CalendarRange className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekAppointments.length}</div>
            <p className="text-xs text-slate-500">{format(startDate, "d MMM")} to {format(addDays(startDate, 6), "d MMM")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Action</CardTitle>
            <Grip className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyNeedsAction}</div>
            <p className="text-xs text-slate-500">Approvals, pickups, and live follow-ups</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Salon</CardTitle>
            <Scissors className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyInSalon}</div>
            <p className="text-xs text-slate-500">Checked in, grooming, or ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Done</CardTitle>
            <Truck className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyDone}</div>
            <p className="text-xs text-slate-500">Completed, cancelled, or no-show</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{format(selectedDay, "EEEE d MMMM")}</p>
          <p className="text-sm text-slate-500">
            {selectedDayAppointments.length} visible appointments. Drag in the grid to change the time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              size="sm"
              variant={activeFilter === filter.value ? "secondary" : "outline"}
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label} ({filter.count})
            </Button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="min-w-[880px] flex flex-col h-full">
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
              <div className="p-4 text-center text-sm font-medium text-slate-500">Time</div>
              {weekDays.map((day) => {
                const dayAppointments = weekAppointments.filter((appointment) => isSameDay(appointment.date, day));
                const isSelected = isSameDay(day, selectedDay);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "border-l border-slate-200 p-4 text-center transition-colors",
                      isSelected ? "bg-brand-50" : "hover:bg-slate-100",
                    )}
                  >
                    <div className={cn("text-sm font-medium", isSelected ? "text-brand-700" : "text-slate-900")}>
                      {format(day, "EEE")}
                    </div>
                    <div className={cn("mt-1 text-2xl font-light", isSelected ? "text-brand-700" : "text-slate-500")}>
                      {format(day, "d")}
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-slate-500">
                      {dayAppointments.length} appt{dayAppointments.length === 1 ? "" : "s"}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-8">
                <div className="border-r border-slate-200 bg-slate-50">
                  {hours.map((hour) => (
                    <div key={hour} className="h-24 border-b border-slate-200 p-2 text-right text-xs font-medium text-slate-500">
                      {formatHourLabel(hour)}
                    </div>
                  ))}
                </div>
                <div className="col-span-7 grid grid-cols-7">
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "relative border-r border-slate-200 last:border-r-0",
                        isSameDay(day, selectedDay) ? "bg-brand-50/30" : "",
                      )}
                      onDragOver={handleDragOver}
                      onDrop={(event) => handleDrop(event, day)}
                    >
                      {hours.map((hour) => (
                        <div key={hour} className="h-24 border-b border-slate-200 border-dashed" />
                      ))}
                      {weekAppointments
                        .filter((appointment) => isSameDay(appointment.date, day))
                        .map((appointment) => {
                          const startHour = appointment.date.getHours();
                          const startMinute = appointment.date.getMinutes();
                          const top = ((startHour - 8) * 96) + (startMinute / 60) * 96;
                          const height = (appointment.duration / 60) * 96;

                          return (
                            <div
                              key={appointment.id}
                              draggable
                              onDragStart={(event) => handleDragStart(event, appointment.id)}
                              onClick={() => handleAppointmentClick(appointment)}
                              className={cn(
                                "absolute left-1 right-1 rounded-lg border p-2 text-xs shadow-sm transition-all hover:z-10 hover:shadow-md cursor-grab active:cursor-grabbing",
                                getAppointmentTone(appointment.status),
                              )}
                              // eslint-disable-next-line react/forbid-dom-props
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                            >
                              <div className="font-semibold truncate">{appointment.petName}</div>
                              <div className="truncate opacity-80">{appointment.service}</div>
                              {height > 74 && (
                                <div className="truncate opacity-70">{appointment.ownerName}</div>
                              )}
                              {height > 90 && (
                                <div className="mt-1 opacity-70 text-[10px]">
                                  {format(appointment.date, "h:mm a")} – {format(new Date(appointment.date.getTime() + appointment.duration * 60000), "h:mm a")}
                                </div>
                              )}
                              {height > 112 && (
                                <div className="mt-1" onClick={(event) => event.stopPropagation()}>
                                  <AppointmentStatusBar appointment={appointment} onUpdated={handleStatusUpdate} compact />
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card className="h-fit xl:h-full">
          <CardHeader className="space-y-4">
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
                  {selectedDayAppointments.filter((appointment) => LIVE_STATUSES.has(appointment.status)).length}
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
                <Button className="mt-4" size="sm" variant="outline" onClick={handleNewAppointmentClick}>
                  Add Appointment
                </Button>
              </div>
            ) : (
              selectedDayAppointments.map((appointment) => (
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
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <AppointmentStatusBar appointment={appointment} onUpdated={handleStatusUpdate} />
                    <Button type="button" size="sm" variant="outline" onClick={() => handleAppointmentClick(appointment)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        onSave={handleSaveAppointment}
      />
    </div>
  );
}
