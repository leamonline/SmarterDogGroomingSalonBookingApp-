import React from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { formatCurrency } from "@/src/lib/utils";
import type { BookingResult } from "./types";

interface DoneStepProps {
  bookingResult: BookingResult;
  onBookAnother: () => void;
}

export function DoneStep({ bookingResult, onBookAnother }: DoneStepProps) {
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <div className="rounded-full bg-sage-light p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-accent" />
      </div>
      <h2 className="text-xl font-bold text-purple mb-2">
        {bookingResult.status === "pending-approval" ? "Booking Request Submitted!" : "Booking Confirmed!"}
      </h2>
      <p className="text-slate-500 mb-6">{bookingResult.message}</p>
      {(bookingResult.depositRequired ?? 0) > 0 && (
        <div className="bg-warning-light border border-warning rounded-lg p-4 mb-6 text-sm text-slate-800">
          <strong>Deposit Required:</strong> {formatCurrency(bookingResult.depositRequired)} — we'll be in touch with payment details.
        </div>
      )}
      <Button variant="outline" onClick={onBookAnother}>
        Book Another Appointment
      </Button>
    </div>
  );
}
