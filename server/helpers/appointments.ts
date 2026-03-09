import db from '../db.js';
import {
  BOOKING_SLOT_CAPACITY,
  BOOKING_SLOT_TIMES,
  DAY_NAMES_BY_INDEX,
  combineDateAndTime,
  getSlotTimesForDuration,
  normalizeScheduleRows,
} from './schedule.js';

// Maximum grooming appointment duration used to bound the overlap query window.
export const MAX_DURATION_MINUTES = 480; // 8 hours, generous upper bound

type ExistingAppointment = {
  id: string;
  date: string;
  duration: number;
};

export type AvailabilityReason =
  | 'invalid-date'
  | 'closed-day'
  | 'invalid-start-time'
  | 'outside-hours'
  | 'slot-unavailable'
  | 'slot-capacity';

export type AvailabilityCheck =
  | { ok: true }
  | { ok: false; reason: AvailabilityReason };

const NON_BLOCKING_STATUSES = ['cancelled-by-customer', 'cancelled-by-salon', 'no-show'] as const;

function loadScheduleByDay() {
  const rows = db.prepare('SELECT * FROM schedule').all() as any[];
  const normalized = normalizeScheduleRows(rows);
  return new Map(normalized.map((day) => [day.day, day]));
}

function loadAppointmentsInRange(windowStart: string, windowEnd: string, excludeId?: string) {
  const appointments = db.prepare(`
    SELECT id, date, duration FROM appointments
    WHERE date BETWEEN ? AND ?
      AND status NOT IN (${NON_BLOCKING_STATUSES.map(() => '?').join(', ')})
  `).all(windowStart, windowEnd, ...NON_BLOCKING_STATUSES) as ExistingAppointment[];

  if (!excludeId) {
    return appointments;
  }

  return appointments.filter((appointment) => appointment.id !== excludeId);
}

function formatTimeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function overlaps(windowStart: number, windowEnd: number, appointment: ExistingAppointment) {
  const apptStart = new Date(appointment.date).getTime();
  const apptEnd = apptStart + ((appointment.duration || 60) * 60000);
  return windowStart < apptEnd && windowEnd > apptStart;
}

function checkAvailabilityAgainstData(
  dateString: string,
  duration: number,
  existingAppointments: ExistingAppointment[],
  scheduleByDay: ReturnType<typeof loadScheduleByDay>,
): AvailabilityCheck {
  const startDate = new Date(dateString);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, reason: 'invalid-date' };
  }

  const dayName = DAY_NAMES_BY_INDEX[startDate.getDay()];
  const daySchedule = scheduleByDay.get(dayName);
  if (!daySchedule || daySchedule.isClosed) {
    return { ok: false, reason: 'closed-day' };
  }

  const startTime = formatTimeKey(startDate);
  if (!BOOKING_SLOT_TIMES.includes(startTime as any)) {
    return { ok: false, reason: 'invalid-start-time' };
  }

  const startSlot = daySchedule.slots.find((slot) => slot.time === startTime);
  if (!startSlot?.isAvailable) {
    return { ok: false, reason: 'slot-unavailable' };
  }

  const appointmentEnd = new Date(startDate.getTime() + (duration * 60000));
  const closingTime = combineDateAndTime(startDate, daySchedule.closeTime);
  if (appointmentEnd.getTime() > closingTime.getTime()) {
    return { ok: false, reason: 'outside-hours' };
  }

  const slotMap = new Map(daySchedule.slots.map((slot) => [slot.time, slot]));
  const coveredSlotTimes = getSlotTimesForDuration(startTime, duration);

  for (const slotTime of coveredSlotTimes) {
    const slotConfig = slotMap.get(slotTime as any);
    if (!slotConfig?.isAvailable) {
      return { ok: false, reason: 'slot-unavailable' };
    }

    const slotWindowStart = combineDateAndTime(startDate, slotTime);
    const slotWindowEnd = new Date(slotWindowStart.getTime() + (30 * 60000));
    const concurrentAppointments = existingAppointments.filter((appointment) =>
      overlaps(slotWindowStart.getTime(), slotWindowEnd.getTime(), appointment),
    ).length;

    if (concurrentAppointments >= BOOKING_SLOT_CAPACITY) {
      return { ok: false, reason: 'slot-capacity' };
    }
  }

  return { ok: true };
}

export function getAvailabilityErrorMessage(reason: AvailabilityReason) {
  switch (reason) {
    case 'closed-day':
      return 'This day is closed for bookings.';
    case 'invalid-start-time':
      return 'Appointments must start on one of the configured 30-minute booking slots.';
    case 'outside-hours':
      return 'This appointment would finish outside your booking hours.';
    case 'slot-unavailable':
      return 'One or more of the required time slots are unavailable for booking.';
    case 'slot-capacity':
      return 'This slot is already at capacity.';
    default:
      return 'This appointment time is unavailable.';
  }
}

export function getAvailabilityReason(availability: AvailabilityCheck) {
  return 'reason' in availability ? availability.reason : null;
}

export function getAvailableSlotsForDate(dateStr: string, duration: number, excludeId?: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  if (Number.isNaN(localDate.getTime())) {
    return [];
  }

  const dayName = DAY_NAMES_BY_INDEX[localDate.getDay()];
  const scheduleByDay = loadScheduleByDay();
  const daySchedule = scheduleByDay.get(dayName);
  if (!daySchedule || daySchedule.isClosed) {
    return [];
  }

  const dayStart = new Date(localDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(localDate);
  dayEnd.setHours(23, 59, 59, 999);
  const existingAppointments = loadAppointmentsInRange(dayStart.toISOString(), dayEnd.toISOString(), excludeId);
  const now = new Date();

  return daySchedule.slots.flatMap((slot) => {
    if (!slot.isAvailable) {
      return [];
    }

    const slotStart = combineDateAndTime(localDate, slot.time);
    if (slotStart.getTime() < now.getTime()) {
      return [];
    }

    const availability = checkAvailabilityAgainstData(
      slotStart.toISOString(),
      duration,
      existingAppointments,
      scheduleByDay,
    );

    return availability.ok ? [slotStart.toISOString()] : [];
  });
}

export const getNextAvailableSlots = (
  fromIso: string,
  duration: number,
  maxResults = 5,
  options?: { excludeId?: string },
) => {
  const upcoming: string[] = [];
  const cursor = new Date(fromIso);
  const now = Number.isNaN(cursor.getTime()) ? new Date() : cursor;
  const scheduleByDay = loadScheduleByDay();

  const searchWindowStart = new Date(now.getTime() - (MAX_DURATION_MINUTES * 60000)).toISOString();
  const searchWindowEnd = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000) + (MAX_DURATION_MINUTES * 60000)).toISOString();
  const existingAppointments = loadAppointmentsInRange(searchWindowStart, searchWindowEnd, options?.excludeId);

  for (let dayOffset = 0; dayOffset < 14 && upcoming.length < maxResults; dayOffset += 1) {
    const dayDate = new Date(now);
    dayDate.setHours(0, 0, 0, 0);
    dayDate.setDate(dayDate.getDate() + dayOffset);

    const dayName = DAY_NAMES_BY_INDEX[dayDate.getDay()];
    const daySchedule = scheduleByDay.get(dayName);
    if (!daySchedule || daySchedule.isClosed) {
      continue;
    }

    for (const slot of daySchedule.slots) {
      if (upcoming.length >= maxResults || !slot.isAvailable) {
        continue;
      }

      const slotStart = combineDateAndTime(dayDate, slot.time);
      if (slotStart.getTime() < now.getTime()) {
        continue;
      }

      const availability = checkAvailabilityAgainstData(
        slotStart.toISOString(),
        duration,
        existingAppointments,
        scheduleByDay,
      );

      if (availability.ok) {
        upcoming.push(slotStart.toISOString());
      }
    }
  }

  return upcoming;
};

export function getAppointmentAvailability(dateString: string, duration: number, excludeId?: string): AvailabilityCheck {
  const startDate = new Date(dateString);
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, reason: 'invalid-date' } as const;
  }

  const dayStart = new Date(startDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  return checkAvailabilityAgainstData(
    dateString,
    duration,
    loadAppointmentsInRange(dayStart.toISOString(), dayEnd.toISOString(), excludeId),
    loadScheduleByDay(),
  );
}
