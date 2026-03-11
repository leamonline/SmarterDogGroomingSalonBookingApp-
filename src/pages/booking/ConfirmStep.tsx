import React from "react";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Dog } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { format } from "date-fns";
import { formatCurrency } from "@/src/lib/utils";
import type { BookableService } from "./types";
import { hasDeposit, formatServicePrice } from "./types";

interface ConfirmStepProps {
  selectedService: BookableService;
  selectedSlot: string;
  petName: string;
  breed: string;
  petNotes: string;
  dogCount: number;
  isBooking: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmStep({
  selectedService, selectedSlot, petName, breed, petNotes, dogCount,
  isBooking, onConfirm, onBack,
}: ConfirmStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-purple">Confirm Your Booking</h2>
        <Button size="sm" variant="outline" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-md mx-auto">
        <div className="bg-purple text-white px-6 py-4">
          <h3 className="font-bold text-lg">{selectedService.name}</h3>
          <p className="text-slate-300 text-sm">{selectedService.duration} minutes</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> Date</span>
            <span className="font-medium">{format(new Date(selectedSlot), "EEE d MMMM yyyy")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time</span>
            <span className="font-medium">{format(new Date(selectedSlot), "h:mm a")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 flex items-center gap-1.5"><Dog className="h-3.5 w-3.5" /> {dogCount > 1 ? "Dogs" : "Dog"}</span>
            <span className="font-medium">{petName} {breed && `(${breed})`}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Number of dogs</span>
            <span className="font-medium">{dogCount}</span>
          </div>
          <div className="border-t border-slate-100 pt-3 flex justify-between text-sm font-bold">
            <span>Price</span>
            <span>{formatServicePrice(selectedService)}</span>
          </div>
          {hasDeposit(selectedService) && (
            <div className="flex justify-between text-sm text-warning">
              <span>Deposit Required</span>
              <span>{formatCurrency(selectedService.depositAmount)}</span>
            </div>
          )}
          {petNotes && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Notes for the salon</p>
              <p className="mt-1 whitespace-pre-wrap">{petNotes}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <Button className="w-full" onClick={onConfirm} disabled={isBooking}>
            {isBooking ? "Booking..." : "Confirm Booking"}
          </Button>
        </div>
      </div>
    </div>
  );
}
