import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grip,
  Pause,
  Play,
  Plus,
  Scissors,
  Settings2,
  Truck,
  UserCheck,
  UserRound,
  XCircle,
  Dog as DogIcon,
  Mail,
} from "lucide-react";
import { BookingScheduleEditor } from "@/src/components/BookingScheduleEditor";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Select } from "@/src/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { type BookingScheduleDay, normalizeScheduleDays } from "@/src/lib/bookingSchedule";
import { cn, formatCurrency } from "@/src/lib/utils";
import { handleError } from "@/src/lib/handleError";
import { AppointmentModal, Appointment } from "@/src/components/AppointmentModal";
import { AppointmentStatusBar } from "@/src/components/AppointmentStatusBar";
import { CalendarSkeleton } from "@/src/components/ui/skeleton";
import { useLocation, useNavigate } from "react-router-dom";

type CalendarFilter = "all" | "needs-action" | "capacity-review" | "in-salon" | "done";

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
  if (filter === "capacity-review") {
    return appointment.dogCountConfirmed === false;
  }
  if (filter === "needs-action") {
    return NEEDS_ACTION_STATUSES.has(appointment.status) || appointment.dogCountConfirmed === false;
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
    return "border-gold bg-gold-light text-purple";
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

function formatDogCountLabel(dogCount?: number) {
  const count = dogCount || 1;
  return `${count} ${count === 1 ? "dog" : "dogs"}`;
}

function formatDogCountReviewNote(reviewedAt?: string, reviewedBy?: string) {
  if (!reviewedAt) return null;
  const parsed = new Date(reviewedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return `Confirmed by ${reviewedBy || "staff"} on ${format(parsed, "d MMM yyyy 'at' h:mm a")}`;
}

function isDogCountConfirmed(value: unknown) {
  return value === true || value === 1;
}

function normalizeAppointment(item: any): Appointment {
  return {
    ...item,
    date: item.date instanceof Date ? item.date : new Date(item.date),
    dogCount: item.dogCount ?? 1,
    dogCountConfirmed: isDogCountConfirmed(item.dogCountConfirmed),
  };
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "pending-approval": Clock3,
  confirmed: CheckCircle,
  scheduled: Clock3,
  "deposit-pending": Clock3,
  "deposit-paid": CheckCircle,
  "checked-in": UserCheck,
  "in-progress": Play,
  "ready-for-collection": Truck,
  completed: CheckCircle,
  "cancelled-by-customer": XCircle,
  "cancelled-by-salon": XCircle,
  "no-show": AlertTriangle,
  rescheduled: Clock3,
  incomplete: Pause,
  "incident-review": AlertTriangle,
};

function formatHourLabel(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

export function Calendar() {
  const { isAdmin } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedule, setSchedule] = useState<BookingScheduleDay[]>(() => normalizeScheduleDays());
  const [scheduleDraft, setScheduleDraft] = useState<BookingScheduleDay[]>([]);
  const [editingScheduleDay, setEditingScheduleDay] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CalendarFilter>("all");
  const [reviewDogCounts, setReviewDogCounts] = useState<Record<string, number>>({});
  const [confirmingAppointmentIds, setConfirmingAppointmentIds] = useState<string[]>([]);
  const [isConfirmingAllReviewItems, setIsConfirmingAllReviewItems] = useState(false);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        const [appointmentData, settingsData] = await Promise.all([api.getAppointments(), api.getSettings()]);

        setAppointments(appointmentData.map((item: any) => normalizeAppointment(item)));
        setSchedule(normalizeScheduleDays(settingsData.schedule));
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
    () =>
      appointments.filter((appointment) => appointment.date >= startDate && appointment.date < weekEndExclusive),
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
  const scheduleByDay = useMemo(
    () => new Map(schedule.map((daySchedule) => [daySchedule.day, daySchedule])),
    [schedule],
  );
  const selectedDayName = useMemo(() => format(selectedDay, "EEEE"), [selectedDay]);
  const selectedDaySchedule = useMemo(
    () => scheduleByDay.get(selectedDayName) || null,
    [scheduleByDay, selectedDayName],
  );
  const editingDaySchedule = useMemo(
    () =>
      editingScheduleDay ? scheduleDraft.find((daySchedule) => daySchedule.day === editingScheduleDay) || null : null,
    [editingScheduleDay, scheduleDraft],
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

  const handleSaveAppointment = useCallback(
    async (updatedAppointment: Appointment, options?: { successMessage?: string }) => {
      try {
        const exists = appointments.some((appointment) => appointment.id === updatedAppointment.id);
        const savedAppointment = normalizeAppointment(
          exists
            ? await api.updateAppointment(updatedAppointment.id, updatedAppointment)
            : await api.createAppointment(updatedAppointment),
        );
        if (exists) {
          setAppointments((prev) =>
            prev.map((appointment) => (appointment.id === updatedAppointment.id ? savedAppointment : appointment)),
          );
        } else {
          setAppointments((prev) => [...prev, savedAppointment]);
        }

        if (options?.successMessage) {
          toast.success(options.successMessage);
        }

        return true;
      } catch (err) {
        handleError(err, "Failed to save appointment");
        return false;
      }
    },
    [appointments],
  );

  const handleStatusUpdate = useCallback((updatedAppointment: Appointment) => {
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === updatedAppointment.id ? normalizeAppointment(updatedAppointment) : appointment,
      ),
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

  const handleDrop = useCallback(
    async (event: React.DragEvent, targetDay: Date) => {
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
    },
    [appointments, handleSaveAppointment],
  );

  const shiftWeek = useCallback((days: number) => {
    setCurrentDate((prev) => addDays(prev, days));
    setSelectedDay((prev) => addDays(prev, days));
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now);
  }, []);

  const openClientProfile = useCallback(
    (customerId?: string) => {
      if (!customerId) return;
      navigate("/clients", { state: { customerId } });
    },
    [navigate],
  );

  const openDogProfile = useCallback(
    (dogId?: string) => {
      if (!dogId) return;
      navigate("/dogs", { state: { dogId } });
    },
    [navigate],
  );

  const openMessaging = useCallback(
    (appointment: Appointment) => {
      if (!appointment.customerId) return;
      navigate("/messaging", {
        state: {
          customerId: appointment.customerId,
          dogId: appointment.dogId,
          appointmentId: appointment.id,
        },
      });
    },
    [navigate],
  );

  const openScheduleSettings = useCallback(
    (day: Date) => {
      setSelectedDay(day);
      setScheduleDraft(schedule);
      setEditingScheduleDay(format(day, "EEEE"));
    },
    [schedule],
  );

  const openCapacityReview = useCallback((appointment: Appointment) => {
    setCurrentDate(appointment.date);
    setSelectedDay(appointment.date);
    setActiveFilter("capacity-review");
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  }, []);

  const closeScheduleSettings = useCallback(() => {
    setEditingScheduleDay(null);
    setScheduleDraft([]);
  }, []);

  const handleSaveSchedule = useCallback(async () => {
    if (!editingScheduleDay) return;

    try {
      setIsSavingSchedule(true);
      await api.updateSettings({ schedule: scheduleDraft });
      setSchedule(scheduleDraft);
      toast.success(`${editingScheduleDay} booking settings saved`);
      closeScheduleSettings();
    } catch (err) {
      handleError(err, "Failed to save booking schedule");
    } finally {
      setIsSavingSchedule(false);
    }
  }, [closeScheduleSettings, editingScheduleDay, scheduleDraft]);

  const weeklyInSalon = useMemo(
    () => weekAppointments.filter((a) => LIVE_STATUSES.has(a.status)).length,
    [weekAppointments],
  );
  const weeklyNeedsAction = useMemo(
    () => weekAppointments.filter((a) => NEEDS_ACTION_STATUSES.has(a.status)).length,
    [weekAppointments],
  );
  const weeklyCapacityReview = useMemo(
    () => allWeekAppointments.filter((a) => a.dogCountConfirmed === false).length,
    [allWeekAppointments],
  );
  const weeklyDone = useMemo(
    () => weekAppointments.filter((a) => DONE_STATUSES.has(a.status)).length,
    [weekAppointments],
  );
  const upcomingCapacityReview = useMemo(
    () =>
      appointments.filter((appointment) => appointment.dogCountConfirmed === false),
    [appointments],
  );
  const selectedDayRevenue = useMemo(
    () =>
      selectedDayAppointments
        .filter((a) => !a.status.includes("cancelled") && a.status !== "no-show")
        .reduce((sum, a) => sum + (a.price || 0), 0),
    [selectedDayAppointments],
  );

  useEffect(() => {
    setReviewDogCounts((prev) => {
      const nextEntries = upcomingCapacityReview.map(
        (appointment) => [appointment.id, prev[appointment.id] ?? appointment.dogCount ?? 1] as const,
      );
      const next = Object.fromEntries(nextEntries);
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const unchanged = prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key]);
      return unchanged ? prev : next;
    });
  }, [upcomingCapacityReview]);

  const getReviewDogCount = useCallback(
    (appointment: Appointment) => reviewDogCounts[appointment.id] ?? appointment.dogCount ?? 1,
    [reviewDogCounts],
  );

  const isConfirmingReviewItem = useCallback(
    (appointmentId: string) => confirmingAppointmentIds.includes(appointmentId),
    [confirmingAppointmentIds],
  );

  const handleReviewDogCountChange = useCallback((appointmentId: string, value: string) => {
    const dogCount = Number(value);
    if (!Number.isInteger(dogCount) || dogCount < 1 || dogCount > 4) return;
    setReviewDogCounts((prev) => ({ ...prev, [appointmentId]: dogCount }));
  }, []);

  const handleConfirmReviewItem = useCallback(
    async (appointment: Appointment) => {
      if (isConfirmingReviewItem(appointment.id)) return;

      setConfirmingAppointmentIds((prev) => [...prev, appointment.id]);
      try {
        const confirmedDogCount = getReviewDogCount(appointment);
        const saved = await handleSaveAppointment(
          { ...appointment, dogCount: confirmedDogCount },
          { successMessage: `${appointment.petName} is now confirmed for ${formatDogCountLabel(confirmedDogCount)}` },
        );
        return Boolean(saved);
      } finally {
        setConfirmingAppointmentIds((prev) => prev.filter((id) => id !== appointment.id));
      }
    },
    [getReviewDogCount, handleSaveAppointment, isConfirmingReviewItem],
  );

  const handleConfirmAllReviewItems = useCallback(async () => {
    if (isConfirmingAllReviewItems || upcomingCapacityReview.length === 0) return;

    setIsConfirmingAllReviewItems(true);
    let confirmedCount = 0;
    let failedCount = 0;

    try {
      for (const appointment of upcomingCapacityReview) {
        setConfirmingAppointmentIds((prev) => (prev.includes(appointment.id) ? prev : [...prev, appointment.id]));
        try {
          const confirmedDogCount = getReviewDogCount(appointment);
          const saved = await handleSaveAppointment({ ...appointment, dogCount: confirmedDogCount });
          if (saved) {
            confirmedCount += 1;
          } else {
            failedCount += 1;
          }
        } finally {
          setConfirmingAppointmentIds((prev) => prev.filter((id) => id !== appointment.id));
        }
      }

      if (confirmedCount > 0) {
        toast.success(`Confirmed ${confirmedCount} booking${confirmedCount === 1 ? "" : "s"} in the review queue.`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} booking${failedCount === 1 ? "" : "s"} still need the full booking screen.`);
      }
    } finally {
      setIsConfirmingAllReviewItems(false);
    }
  }, [getReviewDogCount, handleSaveAppointment, isConfirmingAllReviewItems, upcomingCapacityReview]);

  const filterOptions = useMemo<Array<{ value: CalendarFilter; label: string; count: number }>>(
    () => [
      { value: "all", label: "All", count: allWeekAppointments.length },
      {
        value: "needs-action",
        label: "Needs Action",
        count: allWeekAppointments.filter((a) => matchesFilter(a, "needs-action")).length,
      },
      { value: "capacity-review", label: "Capacity Review", count: weeklyCapacityReview },
      {
        value: "in-salon",
        label: "In Salon",
        count: allWeekAppointments.filter((a) => matchesFilter(a, "in-salon")).length,
      },
      { value: "done", label: "Done", count: allWeekAppointments.filter((a) => matchesFilter(a, "done")).length },
    ],
    [allWeekAppointments, weeklyCapacityReview],
  );

  if (loading) return <CalendarSkeleton />;

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-purple">Bookings</h1>
          <p className="text-sm text-slate-500">
            Run the salon from one calendar-first workspace, then jump straight into the linked client, dog, or message
            thread.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-slate-200 bg-white shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftWeek(-7)}
              className="h-9 w-9 rounded-full border-r border-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={goToToday} className="h-9 rounded-none px-4 text-sm font-medium">
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shiftWeek(7)}
              className="h-9 w-9 rounded-full border-l border-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleNewAppointmentClick}>
            <Plus className="mr-2 h-4 w-4" />
            New Appointment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visible This Week</CardTitle>
            <CalendarRange className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekAppointments.length}</div>
            <p className="text-xs text-slate-500">
              {format(startDate, "d MMM")} to {format(addDays(startDate, 6), "d MMM")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Action</CardTitle>
            <Grip className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyNeedsAction}</div>
            <p className="text-xs text-slate-500">Approvals, pickups, and dog-count reviews</p>
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
            <CardTitle className="text-sm font-medium">Capacity Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingCapacityReview.length}</div>
            <p className="text-xs text-slate-500">Future bookings blocking online slots until confirmed</p>
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
          {selectedDaySchedule && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={selectedDaySchedule.isClosed ? "outline" : "secondary"}>
                {selectedDaySchedule.isClosed ? "Booking closed" : "Booking open"}
              </Badge>
              <Badge variant="outline">
                {selectedDaySchedule.slots.filter((slot) => slot.isAvailable).length} start times enabled
              </Badge>
            </div>
          )}
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

      {upcomingCapacityReview.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Capacity review queue</p>
              <p className="text-sm text-amber-800">
                {upcomingCapacityReview.length} future booking{upcomingCapacityReview.length === 1 ? "" : "s"} still
                need a confirmed dog count before online capacity reopens.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setActiveFilter("capacity-review")}>
                Show review items
              </Button>
              <Button type="button" size="sm" onClick={() => openCapacityReview(upcomingCapacityReview[0])}>
                Review next booking
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <div className="min-w-[880px] flex flex-col h-full">
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
              <div className="p-4 text-center text-sm font-medium text-slate-500">Time</div>
              {weekDays.map((day) => {
                const dayAppointments = weekAppointments.filter((appointment) => isSameDay(appointment.date, day));
                const isSelected = isSameDay(day, selectedDay);
                const daySchedule = scheduleByDay.get(format(day, "EEEE"));

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-l border-slate-200 p-4 text-center transition-colors",
                      isSelected ? "bg-brand-50" : "hover:bg-slate-100",
                    )}
                  >
                    <button type="button" onClick={() => setSelectedDay(day)} className="w-full">
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
                    {daySchedule && (
                      <div className="mt-3 flex flex-col items-center gap-2">
                        <Badge variant={daySchedule.isClosed ? "outline" : "secondary"}>
                          {daySchedule.isClosed ? "Closed" : "Open"}
                        </Badge>
                        {isAdmin && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={() => openScheduleSettings(day)}
                          >
                            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                            Schedule
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-8">
                <div className="border-r border-slate-200 bg-slate-50">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="h-24 border-b border-slate-200 p-2 text-right text-xs font-medium text-slate-500"
                    >
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
                          const top = (startHour - 8) * 96 + (startMinute / 60) * 96;
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
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                            >
                              <div className="font-semibold truncate flex items-center gap-1">
                                {(() => {
                                  const Icon = STATUS_ICONS[appointment.status];
                                  return Icon ? <Icon className="h-3 w-3 shrink-0" /> : null;
                                })()}
                                {appointment.petName}
                                <span className="ml-auto text-[9px] font-medium opacity-70 uppercase tracking-wide shrink-0">
                                  {formatStatusLabel(appointment.status)}
                                </span>
                              </div>
                              <div className="truncate opacity-80">{appointment.service}</div>
                              {height > 58 && (
                                <div className="truncate opacity-75">{formatDogCountLabel(appointment.dogCount)}</div>
                              )}
                              {height > 74 && <div className="truncate opacity-70">{appointment.ownerName}</div>}
                              {height > 90 && appointment.dogCountConfirmed === false && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-800">
                                  <AlertTriangle className="h-3 w-3" />
                                  Review dog count
                                </div>
                              )}
                              {height > 90 && (
                                <div className="mt-1 opacity-70 text-[10px]">
                                  {format(appointment.date, "h:mm a")} –{" "}
                                  {format(
                                    new Date(appointment.date.getTime() + appointment.duration * 60000),
                                    "h:mm a",
                                  )}
                                </div>
                              )}
                              {height > 112 && (
                                <div className="mt-1" onClick={(event) => event.stopPropagation()}>
                                  <AppointmentStatusBar
                                    appointment={appointment}
                                    onUpdated={handleStatusUpdate}
                                    compact
                                  />
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
            {upcomingCapacityReview.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Capacity review queue</p>
                    <p className="text-xs text-amber-800">
                      Set the dog count here, then confirm without opening every booking.
                    </p>
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
                    onClick={() => openCapacityReview(upcomingCapacityReview[0])}
                    disabled={isConfirmingAllReviewItems}
                  >
                    Open next
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmAllReviewItems}
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
                              onChange={(event) => handleReviewDogCountChange(appointment.id, event.target.value)}
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
                              onClick={() => handleConfirmReviewItem(appointment)}
                              disabled={isSaving || isConfirmingAllReviewItems}
                            >
                              {isSaving ? "Confirming..." : "Confirm count"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openCapacityReview(appointment)}
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
              (() => {
                const STATUS_GROUPS: { label: string; statuses: Set<string>; tone: string }[] = [
                  {
                    label: "Action Needed",
                    statuses: new Set(["ready-for-collection", "pending-approval"]),
                    tone: "text-gold",
                  },
                  { label: "In Salon", statuses: new Set(["checked-in", "in-progress"]), tone: "text-sky-600" },
                  {
                    label: "Upcoming",
                    statuses: new Set(["confirmed", "scheduled", "deposit-paid", "deposit-pending"]),
                    tone: "text-brand-600",
                  },
                  {
                    label: "Done",
                    statuses: new Set([
                      "completed",
                      "cancelled-by-customer",
                      "cancelled-by-salon",
                      "no-show",
                      "rescheduled",
                      "incomplete",
                      "incident-review",
                    ]),
                    tone: "text-slate-500",
                  },
                ];

                const grouped = STATUS_GROUPS.map((group) => ({
                  ...group,
                  appointments: selectedDayAppointments.filter((a) => group.statuses.has(a.status)),
                })).filter((g) => g.appointments.length > 0);

                // Catch any status that doesn't fit a group
                const groupedIds = new Set(grouped.flatMap((g) => g.appointments.map((a) => a.id)));
                const ungrouped = selectedDayAppointments.filter((a) => !groupedIds.has(a.id));
                if (ungrouped.length > 0) {
                  grouped.push({
                    label: "Other",
                    appointments: ungrouped,
                    statuses: new Set(),
                    tone: "text-slate-500",
                  });
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
                              <p className="text-sm text-slate-600">
                                {appointment.service} for {appointment.ownerName}
                              </p>
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
                            {appointment.dogCountConfirmed === false ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                Capacity review needed
                              </Badge>
                            ) : null}
                          </div>
                          {appointment.dogCountConfirmed !== false &&
                            (() => {
                              const reviewNote = formatDogCountReviewNote(
                                appointment.dogCountReviewedAt,
                                appointment.dogCountReviewedBy,
                              );
                              return reviewNote ? (
                                <p className="mt-2 text-xs font-medium text-brand-700">{reviewNote}</p>
                              ) : null;
                            })()}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                              {appointment.customerId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openClientProfile(appointment.customerId)}
                                >
                                  <UserRound className="mr-1.5 h-3.5 w-3.5" />
                                  Client
                                </Button>
                              ) : null}
                              {appointment.dogId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDogProfile(appointment.dogId)}
                                >
                                  <DogIcon className="mr-1.5 h-3.5 w-3.5" />
                                  Dog
                                </Button>
                              ) : null}
                              {appointment.customerId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openMessaging(appointment)}
                                >
                                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                                  Message
                                </Button>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <AppointmentStatusBar appointment={appointment} onUpdated={handleStatusUpdate} />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleAppointmentClick(appointment)}
                              >
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
      </div>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        onSave={handleSaveAppointment}
      />
      <Dialog
        open={Boolean(editingScheduleDay)}
        onOpenChange={(open) => {
          if (!open) {
            closeScheduleSettings();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingScheduleDay} booking settings</DialogTitle>
            <DialogDescription>
              These controls only update online booking for {editingScheduleDay}. Monday to Wednesday default to open,
              while Thursday to Sunday default to closed.
            </DialogDescription>
          </DialogHeader>
          {editingDaySchedule && (
            <BookingScheduleEditor
              schedule={scheduleDraft}
              setSchedule={setScheduleDraft}
              visibleDays={[editingDaySchedule.day]}
            />
          )}
          <DialogFooter className="border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={closeScheduleSettings}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveSchedule} disabled={isSavingSchedule}>
              {isSavingSchedule ? "Saving..." : "Save Day Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
