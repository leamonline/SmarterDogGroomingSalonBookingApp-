import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { format } from "date-fns";

export type Appointment = {
  id: string;
  petName: string;
  breed: string;
  ownerName: string;
  service: string;
  date: Date;
  duration: number;
  status: string;
  price: number;
  avatar: string;
};

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  initialData?: Partial<Appointment>;
  onSave: (updatedAppointment: Appointment) => void;
}

export function AppointmentModal({ isOpen, onClose, appointment, initialData, onSave }: AppointmentModalProps) {
  const [formData, setFormData] = useState<Partial<Appointment>>({});

  useEffect(() => {
    if (appointment) {
      setFormData(appointment);
    } else {
      setFormData({
        id: Math.random().toString(36).substr(2, 9),
        petName: "",
        breed: "",
        ownerName: "",
        service: "",
        date: new Date(),
        duration: 60,
        status: "scheduled",
        price: 0,
        avatar: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&h=150&fit=crop&q=80",
        ...initialData,
      });
    }
  }, [appointment, initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "price" || name === "duration" ? Number(value) : value,
    }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    setFormData((prev) => ({ ...prev, date: newDate }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Appointment);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{appointment ? "Edit Appointment" : "New Appointment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="petName" className="text-right text-sm font-medium">
              Pet Name
            </label>
            <Input
              id="petName"
              name="petName"
              value={formData.petName || ""}
              onChange={handleChange}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="ownerName" className="text-right text-sm font-medium">
              Owner Name
            </label>
            <Input
              id="ownerName"
              name="ownerName"
              value={formData.ownerName || ""}
              onChange={handleChange}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="service" className="text-right text-sm font-medium">
              Service
            </label>
            <Input
              id="service"
              name="service"
              value={formData.service || ""}
              onChange={handleChange}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="date" className="text-right text-sm font-medium">
              Date & Time
            </label>
            <Input
              id="date"
              name="date"
              type="datetime-local"
              value={formData.date ? format(formData.date, "yyyy-MM-dd'T'HH:mm") : ""}
              onChange={handleDateChange}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="duration" className="text-right text-sm font-medium">
              Duration (m)
            </label>
            <Input
              id="duration"
              name="duration"
              type="number"
              value={formData.duration || ""}
              onChange={handleChange}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="price" className="text-right text-sm font-medium">
              Price ($)
            </label>
            <Input
              id="price"
              name="price"
              type="number"
              value={formData.price || ""}
              onChange={handleChange}
              className="col-span-3"
              required
            />
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
              className="col-span-3 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              <option value="scheduled">Scheduled</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{appointment ? "Save changes" : "Create Appointment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
