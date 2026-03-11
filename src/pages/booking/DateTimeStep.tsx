import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { format } from "date-fns";
import { formatCurrency } from "@/src/lib/utils";
import { BOOKING_CLOSE_TIME, BOOKING_OPEN_TIME, formatScheduleTime } from "@/src/lib/bookingSchedule";
import type { BookableService } from "./types";
import { hasDeposit, formatServicePrice } from "./types";

interface DateTimeStepProps {
  selectedService: BookableService;
  dates: Date[];
  selectedDate: string;
  slots: string[];
  selectedSlot: string;
  loadingSlots: boolean;
  findingFirstAvailable: boolean;
  noAvailability: boolean;
  dogCount: number;
  authed: boolean;
  isDayDisabled: (d: Date) => boolean;
  onSelectDate: (ds: string) => void;
  onSelectSlot: (slot: string) => void;
  onDogCountChange: (count: number) => void;
  onFindFirstAvailable: () => void;
  onContinue: () => void;
  onBack: () => void;
}

export function DateTimeStep({
  selectedService, dates, selectedDate, slots, selectedSlot, loadingSlots,
  findingFirstAvailable, noAvailability, dogCount, authed,
  isDayDisabled, onSelectDate, onSelectSlot, onDogCountChange, onFindFirstAvailable,
  onContinue, onBack,
}: DateTimeStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-purple">Pick a Date &amp; Time</h2>
        <Button size="sm" variant="outline" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back</Button>
      </div>

      {/* Service summary card */}
      <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Selected service</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{selectedService.name}</h3>
            <p className="text-sm text-slate-500">Choose a day below and we&apos;ll help you lock in a time that suits.</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Price</p>
              <p className="font-semibold text-slate-900">{formatServicePrice(selectedService)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
              <p className="font-semibold text-slate-900">{selectedService.duration} min</p>
            </div>
            {hasDeposit(selectedService) && (
              <div className="rounded-lg bg-warning-light px-3 py-2 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-warning">Deposit</p>
                <p className="font-semibold text-slate-800">{formatCurrency(selectedService.depositAmount)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Info blurb */}
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Booking windows run from {formatScheduleTime(BOOKING_OPEN_TIME)} to {formatScheduleTime(BOOKING_CLOSE_TIME)}.
          Start times open in 30-minute steps, each slot can take up to 2 dogs, and 3 or 4 dogs need back-to-back drop-off windows.
        </div>

        {/* Dog count selector */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">How many dogs?</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onDogCountChange(count)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${
                  dogCount === count
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"
                }`}
              >
                {count} {count === 1 ? "dog" : "dogs"}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Online booking supports up to 4 dogs per request. We&apos;ll always offer the earliest valid drop-off slot or slot pair.
          </p>
        </div>
      </div>

      {/* Date picker */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent z-10 rounded-l-xl" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent z-10 rounded-r-xl" />
        <div className="flex gap-2 overflow-x-auto pb-2 scroll-smooth" role="radiogroup" aria-label="Select a date">
          {dates.map((d, idx) => {
            const ds = format(d, "yyyy-MM-dd");
            const isSelected = ds === selectedDate;
            const disabled = isDayDisabled(d);
            return (
              <button
                key={ds}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${format(d, "EEEE d MMMM")}${disabled ? ' (unavailable)' : ''}`}
                onClick={() => onSelectDate(ds)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    for (let n = idx + 1; n < dates.length; n++) {
                      if (!isDayDisabled(dates[n])) {
                        onSelectDate(format(dates[n], 'yyyy-MM-dd'));
                        const next = e.currentTarget.parentElement?.children[n] as HTMLElement;
                        next?.focus();
                        break;
                      }
                    }
                  }
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    for (let n = idx - 1; n >= 0; n--) {
                      if (!isDayDisabled(dates[n])) {
                        onSelectDate(format(dates[n], 'yyyy-MM-dd'));
                        const prev = e.currentTarget.parentElement?.children[n] as HTMLElement;
                        prev?.focus();
                        break;
                      }
                    }
                  }
                }}
                tabIndex={isSelected ? 0 : -1}
                disabled={disabled}
                className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition-all ${
                  isSelected ? "bg-brand-600 text-white shadow-md" :
                  disabled ? "bg-slate-100 text-slate-300 cursor-not-allowed" :
                  "bg-white border border-slate-200 text-slate-700 hover:border-brand-400"
                }`}
              >
                <span className="text-[10px] font-medium uppercase block">{format(d, "EEE")}</span>
                <span className="text-lg font-bold block">{format(d, "d")}</span>
                <span className="text-[10px] block">{format(d, "MMM")}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Fully booked banner */}
      {dates.every(isDayDisabled) && Object.keys(dates).length > 0 && (
         <div className="mt-4 rounded-xl border border-gold bg-gold-light p-4 text-left">
           <p className="text-sm font-semibold text-purple">No appointments available in the next two weeks</p>
           <p className="mt-1 text-sm text-slate-600">We're fully booked for this service right now. Please give us a call to find a cancellation slot.</p>
         </div>
      )}

      {/* Time slots */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Available Times</h3>
        {loadingSlots ? (
          <p className="text-sm text-slate-400 py-4 text-center">Loading slots...</p>
        ) : slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center" data-testid="booking-no-slots-card">
            <p className="text-sm font-medium text-slate-900">No available slots on this date.</p>
            <p className="mt-1 text-sm text-slate-500">Try another day, or let us jump to the next available appointment for you.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={onFindFirstAvailable} disabled={findingFirstAvailable}>
              {findingFirstAvailable ? "Finding next slot..." : "Find first available"}
            </Button>
            {noAvailability && (
              <div className="mt-4 rounded-xl border border-gold bg-gold-light p-4 text-left" data-testid="booking-no-availability-banner">
                <p className="text-sm font-semibold text-purple">No appointments available in the next two weeks</p>
                <p className="mt-1 text-sm text-slate-600">We're fully booked right now. Give us a call and we'll find the perfect slot for you.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {slots.map(slot => {
              const t = new Date(slot);
              const isSelected = slot === selectedSlot;
              return (
                <button
                  key={slot}
                  onClick={() => onSelectSlot(slot)}
                  className={`py-2 px-1 rounded-lg text-sm font-medium transition-all ${
                    isSelected ? "bg-brand-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-700 hover:border-brand-400"
                  }`}
                >
                  {format(t, "h:mm a")}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedSlot && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3" data-testid="booking-selected-slot-summary">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Selected time</p>
            <p className="font-semibold text-slate-900">{format(new Date(selectedSlot), "EEEE d MMMM • h:mm a")}</p>
          </div>
          <Button onClick={onContinue}>
            Continue <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
