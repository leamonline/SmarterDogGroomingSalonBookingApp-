import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { api } from "@/src/lib/api";
import { format, isToday } from "date-fns";
import { Calendar, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import { AppointmentModal, Appointment } from "@/src/components/AppointmentModal";

export function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    appointments: 0,
    activeRate: 0,
    newCustomers: 0
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [aptData, analyticsData] = await Promise.all([
          api.getAppointments(),
          api.getAnalytics()
        ]);
        setAppointments(aptData.map((d: any) => ({ ...d, date: new Date(d.date) })));
        setAnalytics(analyticsData);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    }
    loadData();
  }, []);

  const todayAppointments = appointments.filter((apt) => isToday(apt.date));

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleNewAppointmentClick = () => {
    setSelectedAppointment(null);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = async (updatedAppointment: Appointment) => {
    try {
      const exists = appointments.some((apt) => apt.id === updatedAppointment.id);
      if (exists) {
        await api.updateAppointment(updatedAppointment.id, updatedAppointment);
        setAppointments((prev) => prev.map((apt) => (apt.id === updatedAppointment.id ? updatedAppointment : apt)));
      } else {
        await api.createAppointment(updatedAppointment);
        setAppointments((prev) => [...prev, updatedAppointment]);
      }
    } catch (err: any) {
      console.error("Failed to save appointment", err);
      toast.error(err.message || 'Failed to save due to an error.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <Button onClick={handleNewAppointmentClick}>New Appointment</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.totalRevenue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.appointments}</div>
            <p className="text-xs text-slate-500">All-time appointments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{analytics.newCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeRate}%</div>
            <p className="text-xs text-slate-500">Customers with visits</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-slate-100 p-3 mb-4">
                    <Calendar className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">No appointments today</h3>
                  <p className="mt-1 text-sm text-slate-500">You are all caught up for the day.</p>
                </div>
              ) : (
                todayAppointments.sort((a, b) => a.date.getTime() - b.date.getTime()).map((appointment) => (
                  <div
                    key={appointment.id}
                    onClick={() => handleAppointmentClick(appointment)}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100 flex-shrink-0">
                        <img
                          src={appointment.avatar}
                          alt={appointment.petName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {appointment.petName} <span className="text-slate-500 font-normal">({appointment.breed})</span>
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(appointment.date, "h:mm a")} ({appointment.duration}m)
                          </span>
                          <span>•</span>
                          <span className="truncate">{appointment.service}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-slate-900">${appointment.price}</p>
                        <p className="text-xs text-slate-500">{appointment.ownerName}</p>
                      </div>
                      <Badge
                        variant={
                          appointment.status === "completed"
                            ? "default"
                            : appointment.status === "in-progress"
                              ? "secondary"
                              : "outline"
                        }
                        className={
                          appointment.status === "in-progress" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : ""
                        }
                      >
                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-slate-500">No recent activity.</p>
                </div>
              ) : (
                appointments.slice(0, 4).map((apt, i) => (
                  <div key={apt.id || i} className="flex items-start gap-4">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{apt.ownerName} booked {apt.service} for {apt.petName}</p>
                      <p className="text-xs text-slate-500">Scheduled for {format(apt.date, "MMM d, yyyy h:mm a")}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
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
