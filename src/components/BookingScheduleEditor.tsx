import type { Dispatch, SetStateAction } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  BOOKING_CLOSE_TIME,
  BOOKING_OPEN_TIME,
  type BookingScheduleDay,
  formatScheduleTime,
} from "@/src/lib/bookingSchedule";

type BookingScheduleEditorProps = {
  schedule: BookingScheduleDay[];
  setSchedule: Dispatch<SetStateAction<BookingScheduleDay[]>>;
  visibleDays?: string[];
  showFixedHoursSummary?: boolean;
};

export function BookingScheduleEditor({
  schedule,
  setSchedule,
  visibleDays,
  showFixedHoursSummary = true,
}: BookingScheduleEditorProps) {
  const visibleDaySet = visibleDays ? new Set(visibleDays) : null;
  const visibleSchedule = visibleDaySet
    ? schedule.filter((daySchedule) => visibleDaySet.has(daySchedule.day))
    : schedule;

  const updateScheduleDay = (day: string, updater: (current: BookingScheduleDay) => BookingScheduleDay) => {
    setSchedule((prev) => prev.map((entry) => (entry.day === day ? updater(entry) : entry)));
  };

  const toggleDayClosed = (day: string, isClosed: boolean) => {
    updateScheduleDay(day, (current) => ({ ...current, isClosed }));
  };

  const toggleSlotAvailability = (day: string, time: string) => {
    updateScheduleDay(day, (current) => ({
      ...current,
      slots: current.slots.map((slot) => (slot.time === time ? { ...slot, isAvailable: !slot.isAvailable } : slot)),
    }));
  };

  const setAllSlotsForDay = (day: string, isAvailable: boolean) => {
    updateScheduleDay(day, (current) => ({
      ...current,
      slots: current.slots.map((slot) => ({ ...slot, isAvailable })),
    }));
  };

  if (visibleSchedule.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        No booking schedule found for this day.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showFixedHoursSummary && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            Fixed booking hours: {formatScheduleTime(BOOKING_OPEN_TIME)} to {formatScheduleTime(BOOKING_CLOSE_TIME)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Appointments start in 30-minute increments and each half-hour slot can handle up to 2 dogs.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {visibleSchedule.map((daySchedule) => {
          const availableCount = daySchedule.slots.filter((slot) => slot.isAvailable).length;

          return (
            <div
              key={daySchedule.day}
              className={`rounded-2xl border p-4 transition-colors ${daySchedule.isClosed ? "border-slate-200 bg-slate-50" : "border-brand-100 bg-white"}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{daySchedule.day}</h3>
                    <Badge variant={daySchedule.isClosed ? "outline" : "secondary"}>
                      {daySchedule.isClosed ? "Closed" : "Open"}
                    </Badge>
                    <Badge variant="outline">
                      {availableCount}/{daySchedule.slots.length} starts bookable
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {daySchedule.isClosed
                      ? "Online booking is blocked for the full day until you reopen it."
                      : `Customers can book between ${formatScheduleTime(daySchedule.openTime || BOOKING_OPEN_TIME)} and ${formatScheduleTime(daySchedule.closeTime || BOOKING_CLOSE_TIME)}.`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={daySchedule.isClosed ? "secondary" : "outline"}
                    onClick={() => toggleDayClosed(daySchedule.day, false)}
                  >
                    Open Day
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={daySchedule.isClosed ? "outline" : "secondary"}
                    onClick={() => toggleDayClosed(daySchedule.day, true)}
                  >
                    Close Day
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAllSlotsForDay(daySchedule.day, true)}
                  >
                    All Slots On
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAllSlotsForDay(daySchedule.day, false)}
                  >
                    All Slots Off
                  </Button>
                </div>
              </div>

              <div
                className={`mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5 ${daySchedule.isClosed ? "opacity-70" : ""}`}
              >
                {daySchedule.slots.map((slot) => (
                  <button
                    key={`${daySchedule.day}-${slot.time}`}
                    type="button"
                    onClick={() => toggleSlotAvailability(daySchedule.day, slot.time)}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      slot.isAvailable
                        ? "border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">{formatScheduleTime(slot.time)}</div>
                    <div className="mt-1 text-xs">{slot.isAvailable ? "Available to book" : "Unavailable"}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
