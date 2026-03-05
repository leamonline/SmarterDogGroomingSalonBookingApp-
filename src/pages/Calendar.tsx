import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { api } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { AppointmentModal, Appointment } from "@/src/components/AppointmentModal";
import { AppointmentStatusBar } from "@/src/components/AppointmentStatusBar";

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getAppointments();
        setAppointments(data.map((d: any) => ({ ...d, date: new Date(d.date) })));
      } catch (err) {
        console.error("Failed to load appointments", err);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (location.state?.appointmentId && appointments.length > 0) {
      const targetAppointment = appointments.find(a => a.id === location.state.appointmentId);
      if (targetAppointment) {
        setSelectedAppointment(targetAppointment);
        setIsModalOpen(true);
      }
      // Clear the state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, appointments]);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
  const hours = Array.from({ length: 10 }).map((_, i) => i + 8); // 8 AM to 5 PM

  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const today = () => setCurrentDate(new Date());

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

  const handleStatusUpdate = (updated: Appointment) => {
    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const handleDragStart = (e: React.DragEvent, appointmentId: string) => {
    e.dataTransfer.setData("appointmentId", appointmentId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    const appointmentId = e.dataTransfer.getData("appointmentId");
    if (!appointmentId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;

    // Calculate new time based on drop position (96px per hour)
    const droppedHour = Math.floor(y / 96) + 8;
    const droppedMinute = Math.round(((y % 96) / 96) * 60);
    const snappedMinute = Math.round(droppedMinute / 15) * 15; // Snap to 15 min intervals

    const appointmentToUpdate = appointments.find((a) => a.id === appointmentId);
    if (appointmentToUpdate) {
      const newDate = new Date(targetDay);
      newDate.setHours(droppedHour, snappedMinute, 0, 0);

      const updatedAppointment = { ...appointmentToUpdate, date: newDate };
      handleSaveAppointment(updatedAppointment);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-purple">Calendar</h1>
          <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
            <Button variant="ghost" size="icon" onClick={prevWeek} className="h-8 w-8 rounded-none border-r border-slate-200">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={today} className="h-8 rounded-none px-4 text-sm font-medium">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={nextWeek} className="h-8 w-8 rounded-none border-l border-slate-200">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-lg font-medium text-slate-900">
            {format(startDate, "MMMM yyyy")}
          </span>
        </div>
        <Button onClick={handleNewAppointmentClick}>
          <Plus className="mr-2 h-4 w-4" />
          New Appointment
        </Button>
      </div>

      <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto min-h-0">
        <div className="min-w-[800px] flex flex-col h-full">
          <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
            <div className="p-4 text-center text-sm font-medium text-slate-500">Time</div>
            {weekDays.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "border-l border-slate-200 p-4 text-center",
                  isSameDay(day, new Date()) ? "bg-brand-50" : ""
                )}
              >
                <div className={cn(
                  "text-sm font-medium",
                  isSameDay(day, new Date()) ? "text-brand-600" : "text-slate-900"
                )}>
                  {format(day, "EEE")}
                </div>
                <div className={cn(
                  "mt-1 text-2xl font-light",
                  isSameDay(day, new Date()) ? "text-brand-600" : "text-slate-500"
                )}>
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-8">
              <div className="border-r border-slate-200 bg-slate-50">
                {hours.map((hour) => (
                  <div key={hour} className="h-24 border-b border-slate-200 p-2 text-right text-xs font-medium text-slate-500">
                    {hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                ))}
              </div>
              <div className="col-span-7 grid grid-cols-7">
                {weekDays.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="relative border-r border-slate-200 last:border-r-0"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    {hours.map((hour) => (
                      <div key={hour} className="h-24 border-b border-slate-200 border-dashed" />
                    ))}
                    {appointments
                      .filter((apt) => isSameDay(apt.date, day))
                      .map((apt) => {
                        const startHour = apt.date.getHours();
                        const startMinute = apt.date.getMinutes();
                        const top = ((startHour - 8) * 96) + (startMinute / 60) * 96;
                        const height = (apt.duration / 60) * 96;

                        return (
                          <div
                            key={apt.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, apt.id)}
                            onClick={() => handleAppointmentClick(apt)}
                            className={cn(
                              "absolute left-1 right-1 rounded-md border p-2 text-xs shadow-sm transition-all hover:z-10 hover:shadow-md cursor-grab active:cursor-grabbing",
                              apt.status === "completed"
                                ? "border-sage bg-sage-light text-brand-700"
                                : apt.status === "in-progress"
                                  ? "border-sky bg-sky-light text-brand-700"
                                  : "border-brand-200 bg-brand-50 text-brand-700"
                            )}
                            // eslint-disable-next-line react/forbid-dom-props
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                            }}
                          >
                            <div className="font-semibold truncate">{apt.petName}</div>
                            <div className="truncate opacity-80">{apt.service}</div>
                            {height > 60 && (
                              <div className="mt-1 opacity-70 text-[10px]">
                                {format(apt.date, "h:mm a")} – {format(new Date(apt.date.getTime() + apt.duration * 60000), "h:mm a")}
                              </div>
                            )}
                            {height > 90 && (
                              <div className="mt-1" onClick={e => e.stopPropagation()}>
                                <AppointmentStatusBar appointment={apt} onUpdated={handleStatusUpdate} compact />
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

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        onSave={handleSaveAppointment}
      />
    </div>
  );
}
