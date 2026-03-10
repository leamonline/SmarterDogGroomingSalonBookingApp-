import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { handleError } from "@/src/lib/handleError";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { api } from "@/src/lib/api";
import { format, isToday } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  Dog,
  DollarSign,
  Scissors,
  Truck,
  Users,
} from "lucide-react";
import { AppointmentModal, Appointment } from "@/src/components/AppointmentModal";
import { AppointmentStatusBar } from "@/src/components/AppointmentStatusBar";
import { formatCurrency } from "@/src/lib/utils";
import { DashboardSkeleton } from "@/src/components/ui/skeleton";

type ScheduleFilter = "all" | "upcoming" | "active" | "done";

const ACTIVE_STATUSES = new Set(["checked-in", "in-progress", "ready-for-collection"]);
const COMPLETED_STATUSES = new Set(["completed"]);
const DONE_STATUSES = new Set(["completed", "cancelled-by-customer", "cancelled-by-salon", "no-show"]);
const ATTENTION_STATUSES = new Set(["pending-approval", "deposit-pending", "ready-for-collection", "incident-review"]);

function formatStatusLabel(status: string) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusBadge(appointment: Appointment) {
  if (appointment.status === "ready-for-collection") {
    return { label: "Ready", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" };
  }
  if (appointment.status === "completed") {
    return { label: "Completed", className: "bg-sage-light text-brand-700 hover:bg-sage-light" };
  }
  if (appointment.status === "in-progress") {
    return { label: "In Progress", className: "bg-sky-light text-brand-700 hover:bg-sky-light" };
  }
  if (appointment.status === "checked-in") {
    return { label: "Checked In", className: "bg-brand-50 text-brand-700 hover:bg-brand-50" };
  }
  if (appointment.status.includes("cancelled") || appointment.status === "no-show") {
    return { label: formatStatusLabel(appointment.status), className: "bg-coral-light text-coral hover:bg-coral-light" };
  }

  return { label: formatStatusLabel(appointment.status), className: "" };
}

export function Dashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>("all");
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    appointments: 0,
    activeRate: 0,
    newCustomers: 0,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [aptData, analyticsData] = await Promise.all([
          api.getAppointments(),
          api.getAnalytics(),
        ]);
        setAppointments(aptData.map((d: any) => ({ ...d, date: new Date(d.date) })));
        setAnalytics(analyticsData);
      } catch (err) {
        handleError(err, "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const now = new Date();
  const sortedAppointments = [...appointments].sort((a, b) => a.date.getTime() - b.date.getTime());
  const todayAppointments = sortedAppointments.filter((appointment) => isToday(appointment.date));
  const activeAppointments = todayAppointments.filter((appointment) => ACTIVE_STATUSES.has(appointment.status));
  const readyForCollection = todayAppointments.filter((appointment) => appointment.status === "ready-for-collection");
  const completedToday = todayAppointments.filter((appointment) => COMPLETED_STATUSES.has(appointment.status));
  const expectedTodayRevenue = todayAppointments
    .filter((appointment) => !appointment.status.includes("cancelled") && appointment.status !== "no-show")
    .reduce((sum, appointment) => sum + (appointment.price || 0), 0);
  const nextAppointment = todayAppointments.find((appointment) => appointment.date.getTime() >= now.getTime() && !DONE_STATUSES.has(appointment.status)) ?? null;
  const attentionAppointments = sortedAppointments.filter((appointment) => {
    if (ATTENTION_STATUSES.has(appointment.status)) {
      return true;
    }

    return (
      isToday(appointment.date) &&
      appointment.date.getTime() < now.getTime() - 15 * 60 * 1000 &&
      ["scheduled", "confirmed", "deposit-paid", "deposit-pending"].includes(appointment.status)
    );
  }).slice(0, 5);

  const visibleTodayAppointments = todayAppointments.filter((appointment) => {
    if (scheduleFilter === "upcoming") {
      return appointment.date.getTime() >= now.getTime() && !DONE_STATUSES.has(appointment.status);
    }
    if (scheduleFilter === "active") {
      return ACTIVE_STATUSES.has(appointment.status);
    }
    if (scheduleFilter === "done") {
      return DONE_STATUSES.has(appointment.status);
    }

    return true;
  });

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleNewAppointmentClick = () => {
    setSelectedAppointment(null);
    setIsModalOpen(true);
  };

  const openInCalendar = (appointment: Appointment) => {
    navigate("/calendar", { state: { appointmentId: appointment.id } });
  };

  const handleSaveAppointment = async (updatedAppointment: Appointment) => {
    try {
      const exists = appointments.some((appointment) => appointment.id === updatedAppointment.id);
      if (exists) {
        await api.updateAppointment(updatedAppointment.id, updatedAppointment);
        setAppointments((prev) =>
          prev.map((appointment) => (appointment.id === updatedAppointment.id ? updatedAppointment : appointment)),
        );
      } else {
        await api.createAppointment(updatedAppointment);
        setAppointments((prev) => [...prev, updatedAppointment].sort((a, b) => a.date.getTime() - b.date.getTime()));
      }
      return true;
    } catch (err: any) {
      const suggestions: string[] = err?.details?.suggestions || [];
      if (suggestions.length > 0) {
        toast.error(`${err.message} Next openings: ${suggestions.map((slot) => format(new Date(slot), "EEE h:mm a")).join(", ")}`);
      } else {
        handleError(err, "Failed to save appointment");
      }
      return false;
    }
  };

  const handleStatusUpdate = (updatedAppointment: Appointment) => {
    setAppointments((prev) =>
      prev.map((appointment) => (appointment.id === updatedAppointment.id ? updatedAppointment : appointment)),
    );
  };

  const scheduleFilters: Array<{ value: ScheduleFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: todayAppointments.length },
    {
      value: "upcoming",
      label: "Upcoming",
      count: todayAppointments.filter((appointment) => appointment.date.getTime() >= now.getTime() && !DONE_STATUSES.has(appointment.status)).length,
    },
    { value: "active", label: "In Salon", count: activeAppointments.length },
    { value: "done", label: "Done", count: todayAppointments.filter((appointment) => DONE_STATUSES.has(appointment.status)).length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-purple">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Keep the salon moving with today&apos;s priorities, live appointments, and quick handoff actions.
          </p>
          {nextAppointment && (
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
              <Clock className="h-4 w-4" />
              Next up: {nextAppointment.petName} at {format(nextAppointment.date, "h:mm a")}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/calendar")}>
            Open Calendar
          </Button>
          <Button onClick={handleNewAppointmentClick}>New Appointment</Button>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayAppointments.length}</div>
                <p className="text-xs text-slate-500">{completedToday.length} already completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Live In Salon</CardTitle>
                <Scissors className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeAppointments.length}</div>
                <p className="text-xs text-slate-500">Checked in, grooming, or ready</p>
              </CardContent>
            </Card>
            <Card className={readyForCollection.length > 0 ? "border-gold bg-gold-light ring-1 ring-gold/50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ready For Collection</CardTitle>
                <Truck className={`h-4 w-4 ${readyForCollection.length > 0 ? "text-purple" : "text-slate-500"}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{readyForCollection.length}</div>
                <p className={`text-xs ${readyForCollection.length > 0 ? "text-purple font-medium" : "text-slate-500"}`}>
                  {readyForCollection.length > 0 ? "Action needed — contact owners" : "Owners to contact or greet"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expected Today</CardTitle>
                <DollarSign className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(expectedTodayRevenue)}</div>
                <p className="text-xs text-slate-500">All-time revenue {formatCurrency(analytics.totalRevenue)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Today&apos;s Schedule</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      {todayAppointments.length} appointments today, {activeAppointments.length} currently in the salon.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {scheduleFilters.map((filter) => (
                      <Button
                        key={filter.value}
                        type="button"
                        size="sm"
                        variant={scheduleFilter === filter.value ? "secondary" : "outline"}
                        onClick={() => setScheduleFilter(filter.value)}
                      >
                        {filter.label} ({filter.count})
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {visibleTodayAppointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-200 bg-brand-50/30 py-12 text-center">
                      <div className="rounded-full bg-brand-100 p-4">
                        <Dog className="h-7 w-7 text-brand-500" />
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-slate-900">All clear — no appointments here!</h3>
                      <p className="mt-1 text-sm text-slate-500 max-w-xs">Try a different filter, or head to the calendar to schedule something new.</p>
                    </div>
                  ) : (
                    visibleTodayAppointments.map((appointment) => {
                      const statusBadge = getStatusBadge(appointment);

                      return (
                        <div
                          key={appointment.id}
                          onClick={() => handleAppointmentClick(appointment)}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-brand-200 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
                                {appointment.avatar ? (
                                  <img
                                    src={appointment.avatar}
                                    alt={appointment.petName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Dog className="h-5 w-5" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-base font-semibold text-slate-900">
                                    {appointment.petName}
                                    {appointment.breed ? ` (${appointment.breed})` : ""}
                                  </p>
                                  <Badge variant="outline" className={statusBadge.className}>
                                    {statusBadge.label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-600">
                                  {appointment.service} for {appointment.ownerName}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {format(appointment.date, "h:mm a")} ({appointment.duration}m)
                                  </span>
                                  <span>{formatCurrency(appointment.price)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-start gap-3 lg:items-end">
                              <AppointmentStatusBar appointment={appointment} onUpdated={handleStatusUpdate} compact />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openInCalendar(appointment);
                                }}
                              >
                                Open In Calendar
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Staff Focus</CardTitle>
                <p className="text-sm text-slate-500">The next appointment plus anything waiting on the team.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Next appointment</p>
                  {nextAppointment ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{nextAppointment.petName}</p>
                          <p className="text-sm text-slate-600">{nextAppointment.service} for {nextAppointment.ownerName}</p>
                        </div>
                        <p className="text-sm font-semibold text-brand-700">{format(nextAppointment.date, "h:mm a")}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openInCalendar(nextAppointment)}>
                        Open in calendar
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">No more upcoming appointments today.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">Needs attention</h3>
                      <p className="text-sm text-slate-500">Late arrivals, approvals, and pickups.</p>
                    </div>
                    <Badge variant="secondary">{attentionAppointments.length}</Badge>
                  </div>

                  {attentionAppointments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      No urgent follow-ups right now. The floor looks under control.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attentionAppointments.map((appointment) => {
                        const isLateArrival =
                          isToday(appointment.date) &&
                          appointment.date.getTime() < now.getTime() - 15 * 60 * 1000 &&
                          ["scheduled", "confirmed", "deposit-paid", "deposit-pending"].includes(appointment.status);

                        return (
                          <button
                            key={appointment.id}
                            type="button"
                            onClick={() => openInCalendar(appointment)}
                            className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50"
                          >
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-900">{appointment.petName}</p>
                              <p className="text-sm text-slate-600">{appointment.service} for {appointment.ownerName}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="h-3.5 w-3.5" />
                                {format(appointment.date, isToday(appointment.date) ? "h:mm a" : "EEE h:mm a")}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-right">
                              {isLateArrival ? (
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                              ) : (
                                <Users className="h-4 w-4 text-slate-400" />
                              )}
                              <div className="text-xs font-medium text-slate-600">
                                {isLateArrival ? "Check arrival" : formatStatusLabel(appointment.status)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        onSave={handleSaveAppointment}
      />
    </div>
  );
}
