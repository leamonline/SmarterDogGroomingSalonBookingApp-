import React from "react";
import { format } from "date-fns";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import type { BookingScheduleDay } from "@/src/lib/bookingSchedule";
import type { Appointment } from "@/src/components/AppointmentModal";

type CalendarFilter = "all" | "needs-action" | "capacity-review" | "in-salon" | "done";

interface CalendarFilterBarProps {
  selectedDay: Date;
  selectedDayAppointments: Appointment[];
  selectedDaySchedule: BookingScheduleDay | null;
  activeFilter: CalendarFilter;
  filterOptions: Array<{ value: CalendarFilter; label: string; count: number }>;
  onFilterChange: (filter: CalendarFilter) => void;
}

export function CalendarFilterBar({
  selectedDay, selectedDayAppointments, selectedDaySchedule,
  activeFilter, filterOptions, onFilterChange,
}: CalendarFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">{format(selectedDay, "EEEE d MMMM")}</p>
        <p className="text-sm text-slate-500">
          {selectedDayAppointments.length} visible appointments. Drag in the grid to change the time.
        </p>
        {selectedDaySchedule && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={selectedDaySchedule.isClosed ? "outline" : "secondary"}>
              {selectedDaySchedule.isClosed ? "Booking closed" : "Booking open"}
            </Badge>
            <Badge variant="outline">
              {selectedDaySchedule.slots.filter((slot) => slot.isAvailable).length} start times enabled
            </Badge>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={activeFilter === filter.value ? "secondary" : "outline"}
            onClick={() => onFilterChange(filter.value)}
          >
            {filter.label} ({filter.count})
          </Button>
        ))}
      </div>
    </div>
  );
}
