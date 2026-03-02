import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { mockAppointments } from "@/src/data/mockData";
import { format } from "date-fns";
import { Calendar, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import { AppointmentModal, Appointment } from "@/src/components/AppointmentModal";

export function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const todayAppointments = appointments.filter(
    (apt) => apt.date.toDateString() === new Date().toDateString()
  );

  const totalRevenue = todayAppointments.reduce((sum, apt) => sum + apt.price, 0);

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleNewAppointmentClick = () => {
    setSelectedAppointment(null);
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (updatedAppointment: Appointment) => {
    setAppointments((prev) => {
      const exists = prev.some((apt) => apt.id === updatedAppointment.id);
      if (exists) {
        return prev.map((apt) => (apt.id === updatedAppointment.id ? updatedAppointment : apt));
      }
      return [...prev, updatedAppointment];
    });
    
    // Also update mockData so changes persist across pages in this simple clone
    const index = mockAppointments.findIndex((a) => a.id === updatedAppointment.id);
    if (index !== -1) {
      mockAppointments[index] = updatedAppointment;
    } else {
      mockAppointments.push(updatedAppointment);
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
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue}</div>
            <p className="text-xs text-slate-500">+20.1% from yesterday</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAppointments.length}</div>
            <p className="text-xs text-slate-500">2 pending, 3 completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12</div>
            <p className="text-xs text-slate-500">+180.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89%</div>
            <p className="text-xs text-slate-500">+4% from last week</p>
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
              {todayAppointments.sort((a, b) => a.date.getTime() - b.date.getTime()).map((appointment) => (
                <div
                  key={appointment.id}
                  onClick={() => handleAppointmentClick(appointment)}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100">
                      <img
                        src={appointment.avatar}
                        alt={appointment.petName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {appointment.petName} <span className="text-slate-500 font-normal">({appointment.breed})</span>
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(appointment.date, "h:mm a")} ({appointment.duration}m)
                        </span>
                        <span>•</span>
                        <span>{appointment.service}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
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
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {[
                { time: "10 mins ago", text: "Sarah Johnson booked a Full Groom for Bella" },
                { time: "1 hour ago", text: "Payment of $45 received from Michael Chen" },
                { time: "2 hours ago", text: "Charlie's Nail Trim appointment completed" },
                { time: "3 hours ago", text: "New customer Emily Davis registered" },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-indigo-500" />
                  <div className="space-y-1">
                    <p className="text-sm text-slate-900">{activity.text}</p>
                    <p className="text-xs text-slate-500">{activity.time}</p>
                  </div>
                </div>
              ))}
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
