import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { format } from "date-fns";

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
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setIsEditing(!appointment);
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{appointment ? (isEditing ? "Edit Appointment" : "Appointment Details") : "New Appointment"}</DialogTitle>
        </DialogHeader>
        {!isEditing ? (
          <div className="space-y-6 py-4">
            {/* Pet Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pet Information</h3>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-white shadow-sm flex-shrink-0">
                    <img src={formData.avatar} alt={formData.petName} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{formData.petName}</h4>
                    <p className="text-sm text-slate-500">{formData.breed || "Unknown breed"}{formData.age ? ` • ${formData.age}` : ""}</p>
                  </div>
                </div>
                {formData.notes && (
                  <div className="mt-2 text-sm text-slate-700 bg-white p-3 rounded border border-slate-100">
                    <span className="font-semibold block mb-1 text-xs text-slate-400">Notes:</span>
                    {formData.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Owner Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Owner Information</h3>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-2">
                <p className="text-sm text-slate-900"><span className="font-medium">Name:</span> {formData.ownerName}</p>
                <p className="text-sm text-slate-900"><span className="font-medium">Phone:</span> {formData.phone || "No phone provided"}</p>
              </div>
            </div>

            {/* Service Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Service Details</h3>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-2">
                <p className="text-sm text-slate-900"><span className="font-medium">Service:</span> {formData.service}</p>
                <p className="text-sm text-slate-900"><span className="font-medium">Date:</span> {formData.date ? format(formData.date, "EEEE, MMMM d, yyyy 'at' h:mm a") : ""}</p>
                <p className="text-sm text-slate-900"><span className="font-medium">Duration:</span> {formData.duration} minutes</p>
                <p className="text-sm text-slate-900"><span className="font-medium">Price:</span> ${formData.price}</p>
                <p className="text-sm text-slate-900"><span className="font-medium">Status:</span> <span className="capitalize">{formData.status}</span></p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              <Button type="button" onClick={() => setIsEditing(true)}>Edit Appointment</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Pet Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-slate-900 border-b pb-2">Pet Details</h4>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="petName" className="text-right text-sm font-medium">Pet Name</label>
                <Input id="petName" name="petName" value={formData.petName || ""} onChange={handleChange} className="col-span-3" required />
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
                <label htmlFor="ownerName" className="text-right text-sm font-medium">Owner Name</label>
                <Input id="ownerName" name="ownerName" value={formData.ownerName || ""} onChange={handleChange} className="col-span-3" required />
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
                <label htmlFor="service" className="text-right text-sm font-medium">Service</label>
                <Input id="service" name="service" value={formData.service || ""} onChange={handleChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="date" className="text-right text-sm font-medium">Date & Time</label>
                <Input id="date" name="date" type="datetime-local" value={formData.date ? format(formData.date, "yyyy-MM-dd'T'HH:mm") : ""} onChange={handleDateChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="duration" className="text-right text-sm font-medium">Duration (m)</label>
                <Input id="duration" name="duration" type="number" value={formData.duration || ""} onChange={handleChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="price" className="text-right text-sm font-medium">Price ($)</label>
                <Input id="price" name="price" type="number" value={formData.price || ""} onChange={handleChange} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="status" className="text-right text-sm font-medium">Status</label>
                <select id="status" name="status" value={formData.status || ""} onChange={handleChange} className="col-span-3 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
                  <option value="scheduled">Scheduled</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
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
