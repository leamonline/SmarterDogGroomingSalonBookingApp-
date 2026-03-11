import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import type { Appointment } from "@/src/components/AppointmentModal";

interface Props {
  formData: Partial<Appointment>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSave: (data: Appointment) => void;
}

export function AppointmentGroomTab({ formData, onChange, onSave }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Groom Notes</label>
        <textarea
          name="groomNotes"
          value={formData.groomNotes || ""}
          onChange={onChange}
          placeholder="Style details, clips used..."
          className="w-full min-h-[60px] rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Products Used</label>
        <Input
          name="productsUsed"
          value={formData.productsUsed || ""}
          onChange={onChange}
          placeholder="Shampoo, conditioner..."
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Behaviour During Groom</label>
        <Input
          name="behaviourDuringGroom"
          value={formData.behaviourDuringGroom || ""}
          onChange={onChange}
          placeholder="Calm, anxious, bitey..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Surcharge (GBP)</label>
          <Input name="surcharge" type="number" value={formData.surcharge || 0} onChange={onChange} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Surcharge Reason</label>
          <Input
            name="surchargeReason"
            value={formData.surchargeReason || ""}
            onChange={onChange}
            placeholder="Matting, extra time..."
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => {
          onSave({ ...formData } as Appointment);
        }}
      >
        Save Groom Notes
      </Button>
    </div>
  );
}
