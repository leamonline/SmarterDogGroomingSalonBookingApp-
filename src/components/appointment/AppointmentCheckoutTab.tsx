import { format } from "date-fns";
import { CheckCircle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { PaymentPanel } from "@/src/components/PaymentPanel";
import type { Appointment } from "@/src/components/AppointmentModal";

interface Props {
  formData: Partial<Appointment>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSave: (data: Appointment) => void;
}

export function AppointmentCheckoutTab({ formData, onChange, onSave }: Props) {
  return (
    <div className="space-y-4">
      <PaymentPanel
        appointmentId={formData.id || ""}
        totalDue={(formData.price || 0) + (formData.surcharge || 0)}
        depositRequired={formData.depositAmount as number | undefined}
      />

      <div className="border-t border-slate-100 pt-4 space-y-2">
        <label className="text-sm font-medium text-slate-700">Aftercare Notes</label>
        <textarea
          name="aftercareNotes"
          value={formData.aftercareNotes || ""}
          onChange={onChange}
          placeholder="Recommendations for the owner..."
          className="w-full min-h-[60px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        />
        <Button
          size="sm"
          onClick={() => {
            onSave({ ...formData, aftercareNotes: formData.aftercareNotes } as Appointment);
          }}
        >
          Save Aftercare Notes
        </Button>
      </div>

      {formData.completedAt && (
        <div className="text-xs text-accent font-medium flex items-center gap-1">
          <CheckCircle className="h-3.5 w-3.5" /> Completed at {format(new Date(formData.completedAt), "h:mm a")}
        </div>
      )}
    </div>
  );
}
