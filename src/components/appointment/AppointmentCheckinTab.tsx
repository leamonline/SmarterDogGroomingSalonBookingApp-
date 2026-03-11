import { format } from "date-fns";
import { CheckCircle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import type { Appointment } from "@/src/components/AppointmentModal";

interface Props {
  formData: Partial<Appointment>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSave: (data: Appointment) => void;
}

export function AppointmentCheckinTab({ formData, onChange, onSave }: Props) {
  return (
    <div className="space-y-4">
      {formData.checkedInAt && (
        <div className="text-xs text-accent font-medium flex items-center gap-1">
          <CheckCircle className="h-3.5 w-3.5" /> Checked in at {format(new Date(formData.checkedInAt), "h:mm a")}
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Check-in Notes</label>
        <textarea
          name="checkedInNotes"
          value={formData.checkedInNotes || ""}
          onChange={onChange}
          placeholder="Health changes, coat condition, behaviour at arrival..."
          className="w-full min-h-[80px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        />
      </div>
      <Button
        size="sm"
        onClick={() => {
          onSave({ ...formData, checkedInNotes: formData.checkedInNotes } as Appointment);
        }}
      >
        Save Check-in Notes
      </Button>
    </div>
  );
}
