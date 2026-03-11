import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import type { Appointment } from "@/src/components/AppointmentModal";
import { formatDogCountLabel } from "@/src/lib/appointmentUtils";
import { formatCurrency } from "@/src/lib/utils";

interface Props {
  formData: Partial<Appointment>;
  dogCountReviewNote: string | null;
}

export function AppointmentDetailsTab({ formData, dogCountReviewNote }: Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pet</h3>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow-sm flex-shrink-0">
              <img src={formData.avatar} alt={formData.petName} className="h-full w-full object-cover" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900">{formData.petName}</h4>
              <p className="text-sm text-slate-500">
                {formData.breed || "Unknown breed"}
                {formData.age ? ` • ${formData.age}` : ""}
              </p>
            </div>
          </div>
          {formData.notes && (
            <div className="mt-2 text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
              <span className="font-semibold text-xs text-slate-400">Notes:</span> {formData.notes}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</h3>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1">
          <p className="text-sm">
            <span className="font-medium text-slate-700">Name:</span> {formData.ownerName}
          </p>
          <p className="text-sm">
            <span className="font-medium text-slate-700">Phone:</span> {formData.phone || "—"}
          </p>
          {(formData.emergencyContact || formData.emergencyPhone) && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Emergency Contact
              </p>
              {formData.emergencyContact && (
                <p className="text-sm">
                  <span className="font-medium text-slate-700">Name:</span> {formData.emergencyContact}
                </p>
              )}
              {formData.emergencyPhone && (
                <p className="text-sm">
                  <span className="font-medium text-slate-700">Phone:</span> {formData.emergencyPhone}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Service</h3>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 grid grid-cols-2 gap-2">
          <p className="text-sm">
            <span className="font-medium text-slate-700">Service:</span> {formData.service}
          </p>
          <p className="text-sm">
            <span className="font-medium text-slate-700">Duration:</span> {formData.duration}m
          </p>
          <p className="text-sm">
            <span className="font-medium text-slate-700">Dogs:</span> {formatDogCountLabel(formData.dogCount)}
          </p>
          <p className="text-sm">
            <span className="font-medium text-slate-700">Date:</span>{" "}
            {formData.date ? format(formData.date, "EEE d MMM, h:mm a") : ""}
          </p>
          <p className="text-sm">
            <span className="font-medium text-slate-700">Price:</span> {formatCurrency(formData.price)}
          </p>
        </div>
        {formData.dogCountConfirmed === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Dog count needs review
            </div>
            <p className="mt-1 text-xs text-amber-800">
              This booking was created before per-dog capacity tracking. Confirm the number of dogs and save to bring it
              back into online availability checks.
            </p>
          </div>
        )}
        {dogCountReviewNote && formData.dogCountConfirmed !== false && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
            {dogCountReviewNote}
          </div>
        )}
      </div>
    </div>
  );
}
