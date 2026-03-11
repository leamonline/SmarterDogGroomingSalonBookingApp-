import db from "../db.js";
import { BOOKING_SLOT_TIMES, DAY_NAMES_BY_INDEX, combineDateAndTime, normalizeScheduleRows } from "./schedule.js";

export const MAX_BOOKING_DOGS = 4;
export const MAX_DOGS_PER_DAY = 15;

type ExistingAppointment = {
  id: string;
  date: string;
  dogCount: number | null;
  dogCountConfirmed: number | null;
};

export type AvailabilityReason =
  | "invalid-date"
  | "past-date"
  | "invalid-dog-count"
  | "closed-day"
  | "manual-review"
  | "invalid-start-time"
  | "slot-unavailable"
  | "slot-capacity"
  | "slot-pair-unavailable"
  | "daily-dog-limit";

export type AvailabilityCheck = { ok: true } | { ok: false; reason: AvailabilityReason };

type DayState = {
  isManualReview: boolean;
  scheduleDay: ReturnType<typeof normalizeScheduleRows>[number] | null;
  slotCounts: number[];
  totalDogs: number;
};

const NON_BLOCKING_STATUSES = ["cancelled-by-customer", "cancelled-by-salon", "no-show"] as const;

function loadScheduleByDay() {
  const rows = db.prepare("SELECT * FROM schedule").all() as any[];
  const normalized = normalizeScheduleRows(rows);
  return new Map(normalized.map((day) => [day.day, day]));
}

function loadAppointmentsInRange(windowStart: string, windowEnd: string, excludeId?: string) {
  const appointments = db
    .prepare(
      `
    SELECT id, date, dogCount, dogCountConfirmed FROM appointments
    WHERE date BETWEEN ? AND ?
      AND status NOT IN (${NON_BLOCKING_STATUSES.map(() => "?").join(", ")})
  `,
    )
    .all(windowStart, windowEnd, ...NON_BLOCKING_STATUSES) as ExistingAppointment[];

  if (!excludeId) {
    return appointments;
  }

  return appointments.filter((appointment) => appointment.id !== excludeId);
}

function formatTimeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDogCount(dogCount?: number | null) {
  const parsed = Number(dogCount ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BOOKING_DOGS) {
    return null;
  }
  return parsed;
}

function isDogCountConfirmed(appointment: ExistingAppointment) {
  return appointment.dogCountConfirmed === 1;
}

function getDogPlacement(dogCount: number) {
  if (dogCount === 1) return [1];
  if (dogCount === 2) return [2];
  if (dogCount === 3) return [2, 1];
  return [2, 2];
}

function calculateSlotCaps(slotCounts: number[]) {
  return slotCounts.map((_, index) => {
    if (index < 2) {
      return 2;
    }

    return slotCounts[index - 1] === 2 && slotCounts[index - 2] === 2 ? 1 : 2;
  });
}

function loadDayState(
  targetDate: Date,
  existingAppointments: ExistingAppointment[],
  scheduleByDay: ReturnType<typeof loadScheduleByDay>,
): DayState {
  const dayName = DAY_NAMES_BY_INDEX[targetDate.getDay()];
  const scheduleDay = scheduleByDay.get(dayName) || null;
  if (!scheduleDay) {
    return {
      isManualReview: false,
      scheduleDay: null,
      slotCounts: [],
      totalDogs: 0,
    };
  }

  const dayKey = getDateKey(targetDate);
  const dayAppointments = existingAppointments.filter((appointment) => {
    const appointmentDate = new Date(appointment.date);
    return !Number.isNaN(appointmentDate.getTime()) && getDateKey(appointmentDate) === dayKey;
  });

  if (dayAppointments.some((appointment) => !isDogCountConfirmed(appointment))) {
    return {
      isManualReview: true,
      scheduleDay,
      slotCounts: [],
      totalDogs: 0,
    };
  }

  if (scheduleDay.isClosed && dayAppointments.length > 0) {
    return {
      isManualReview: true,
      scheduleDay,
      slotCounts: [],
      totalDogs: 0,
    };
  }

  const slotCounts = BOOKING_SLOT_TIMES.map(() => 0);

  for (const appointment of dayAppointments) {
    const appointmentDate = new Date(appointment.date);
    const timeKey = formatTimeKey(appointmentDate);
    const slotIndex = BOOKING_SLOT_TIMES.findIndex((slotTime) => slotTime === timeKey);
    const dogCount = normalizeDogCount(appointment.dogCount);

    if (Number.isNaN(appointmentDate.getTime()) || slotIndex === -1 || !dogCount) {
      return {
        isManualReview: true,
        scheduleDay,
        slotCounts: [],
        totalDogs: 0,
      };
    }

    const placement = getDogPlacement(dogCount);
    if (slotIndex + placement.length > BOOKING_SLOT_TIMES.length) {
      return {
        isManualReview: true,
        scheduleDay,
        slotCounts: [],
        totalDogs: 0,
      };
    }

    for (let offset = 0; offset < placement.length; offset += 1) {
      const scheduleSlot = scheduleDay.slots[slotIndex + offset];
      if (!scheduleSlot?.isAvailable) {
        return {
          isManualReview: true,
          scheduleDay,
          slotCounts: [],
          totalDogs: 0,
        };
      }
      slotCounts[slotIndex + offset] += placement[offset];
    }
  }

  const totalDogs = slotCounts.reduce((sum, count) => sum + count, 0);
  const caps = calculateSlotCaps(slotCounts);
  const exceedsCap = slotCounts.some((count, index) => count > caps[index]);

  if (totalDogs > MAX_DOGS_PER_DAY || exceedsCap) {
    return {
      isManualReview: true,
      scheduleDay,
      slotCounts,
      totalDogs,
    };
  }

  return {
    isManualReview: false,
    scheduleDay,
    slotCounts,
    totalDogs,
  };
}

function checkAvailabilityAgainstData(
  dateString: string,
  dogCount: number,
  existingAppointments: ExistingAppointment[],
  scheduleByDay: ReturnType<typeof loadScheduleByDay>,
): AvailabilityCheck {
  const startDate = new Date(dateString);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, reason: "invalid-date" };
  }

  if (startDate.getTime() < Date.now()) {
    return { ok: false, reason: "past-date" };
  }

  const normalizedDogCount = normalizeDogCount(dogCount);
  if (!normalizedDogCount) {
    return { ok: false, reason: "invalid-dog-count" };
  }

  const dayState = loadDayState(startDate, existingAppointments, scheduleByDay);
  if (dayState.isManualReview) {
    return { ok: false, reason: "manual-review" };
  }

  if (!dayState.scheduleDay || dayState.scheduleDay.isClosed) {
    return { ok: false, reason: "closed-day" };
  }

  const startTime = formatTimeKey(startDate);
  const startSlotIndex = BOOKING_SLOT_TIMES.findIndex((slotTime) => slotTime === startTime);
  if (startSlotIndex === -1) {
    return { ok: false, reason: "invalid-start-time" };
  }

  const placement = getDogPlacement(normalizedDogCount);
  if (startSlotIndex + placement.length > BOOKING_SLOT_TIMES.length) {
    return { ok: false, reason: placement.length > 1 ? "slot-pair-unavailable" : "slot-unavailable" };
  }

  for (let offset = 0; offset < placement.length; offset += 1) {
    const slot = dayState.scheduleDay.slots[startSlotIndex + offset];
    if (!slot?.isAvailable) {
      return { ok: false, reason: placement.length > 1 ? "slot-pair-unavailable" : "slot-unavailable" };
    }
  }

  const tentativeCounts = [...dayState.slotCounts];
  for (let offset = 0; offset < placement.length; offset += 1) {
    tentativeCounts[startSlotIndex + offset] += placement[offset];
  }

  const totalDogs = tentativeCounts.reduce((sum, count) => sum + count, 0);
  if (totalDogs > MAX_DOGS_PER_DAY) {
    return { ok: false, reason: "daily-dog-limit" };
  }

  const caps = calculateSlotCaps(tentativeCounts);
  const exceedsCap = tentativeCounts.some((count, index) => count > caps[index]);
  if (exceedsCap) {
    return { ok: false, reason: placement.length > 1 ? "slot-pair-unavailable" : "slot-capacity" };
  }

  return { ok: true };
}

export function getAvailabilityErrorMessage(reason: AvailabilityReason) {
  switch (reason) {
    case "past-date":
      return "Appointments cannot be scheduled in the past.";
    case "invalid-dog-count":
      return "Online booking currently supports up to 4 dogs per request. Please contact the salon for larger groups.";
    case "closed-day":
      return "This day is closed for bookings.";
    case "manual-review":
      return "This day needs a quick manual review before we can add another booking. Please contact the salon.";
    case "invalid-start-time":
      return "Appointments must start on one of the configured 30-minute booking slots.";
    case "slot-unavailable":
      return "One or more of the required drop-off slots are unavailable for booking.";
    case "slot-pair-unavailable":
      return "I do not have a suitable consecutive drop-off window for that number of dogs on this day.";
    case "daily-dog-limit":
      return "This day has already reached its 15-dog booking limit.";
    case "slot-capacity":
      return "This slot is already at capacity.";
    default:
      return "This appointment time is unavailable.";
  }
}

export function getAvailabilityReason(availability: AvailabilityCheck) {
  return "reason" in availability ? availability.reason : null;
}

export function getAvailableSlotsForDate(dateStr: string, dogCount: number, excludeId?: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  if (Number.isNaN(localDate.getTime())) {
    return [];
  }

  const scheduleByDay = loadScheduleByDay();
  const existingAppointments = loadAppointmentsForLocalDay(localDate, excludeId);
  const dayState = loadDayState(localDate, existingAppointments, scheduleByDay);
  if (!dayState.scheduleDay || dayState.scheduleDay.isClosed || dayState.isManualReview) {
    return [];
  }

  const now = new Date();

  return dayState.scheduleDay.slots.flatMap((slot) => {
    if (!slot.isAvailable) {
      return [];
    }

    const slotStart = combineDateAndTime(localDate, slot.time);
    if (slotStart.getTime() < now.getTime()) {
      return [];
    }

    const availability = checkAvailabilityAgainstData(
      slotStart.toISOString(),
      dogCount,
      existingAppointments,
      scheduleByDay,
    );

    return availability.ok ? [slotStart.toISOString()] : [];
  });
}

function loadAppointmentsForLocalDay(localDate: Date, excludeId?: string) {
  const dayStart = new Date(localDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(localDate);
  dayEnd.setHours(23, 59, 59, 999);
  return loadAppointmentsInRange(dayStart.toISOString(), dayEnd.toISOString(), excludeId);
}

export const getNextAvailableSlots = (
  fromIso: string,
  dogCount: number,
  maxResults = 5,
  options?: { excludeId?: string },
) => {
  const upcoming: string[] = [];
  const cursor = new Date(fromIso);
  const now = Number.isNaN(cursor.getTime()) ? new Date() : cursor;
  const scheduleByDay = loadScheduleByDay();

  for (let dayOffset = 0; dayOffset < 14 && upcoming.length < maxResults; dayOffset += 1) {
    const dayDate = new Date(now);
    dayDate.setHours(0, 0, 0, 0);
    dayDate.setDate(dayDate.getDate() + dayOffset);

    const dayAppointments = loadAppointmentsForLocalDay(dayDate, options?.excludeId);
    const dayState = loadDayState(dayDate, dayAppointments, scheduleByDay);
    if (!dayState.scheduleDay || dayState.scheduleDay.isClosed || dayState.isManualReview) {
      continue;
    }

    for (const slot of dayState.scheduleDay.slots) {
      if (upcoming.length >= maxResults || !slot.isAvailable) {
        continue;
      }

      const slotStart = combineDateAndTime(dayDate, slot.time);
      if (slotStart.getTime() < now.getTime()) {
        continue;
      }

      const availability = checkAvailabilityAgainstData(
        slotStart.toISOString(),
        dogCount,
        dayAppointments,
        scheduleByDay,
      );

      if (availability.ok) {
        upcoming.push(slotStart.toISOString());
      }
    }
  }

  return upcoming;
};

export function getAppointmentAvailability(
  dateString: string,
  dogCount: number,
  excludeId?: string,
): AvailabilityCheck {
  const startDate = new Date(dateString);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, reason: "invalid-date" } as const;
  }

  return checkAvailabilityAgainstData(
    dateString,
    dogCount,
    loadAppointmentsForLocalDay(startDate, excludeId),
    loadScheduleByDay(),
  );
}
