export const BOOKING_DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const BOOKING_DEFAULT_OPEN_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
] as const;

export const DAY_NAMES_BY_INDEX = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const BOOKING_OPEN_TIME = '08:30';
export const BOOKING_CLOSE_TIME = '15:30';
export const BOOKING_SLOT_CAPACITY = 2;
export const BOOKING_SLOT_TIMES = [
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
] as const;

export type BookingSlotTime = typeof BOOKING_SLOT_TIMES[number];

export type RawScheduleRow = {
  day: string;
  openTime?: string | null;
  closeTime?: string | null;
  isClosed?: boolean | number | null;
  slotConfig?: string | null;
};

export type NormalizedScheduleSlot = {
  time: BookingSlotTime;
  isAvailable: boolean;
  capacity: number;
};

export type NormalizedScheduleDay = {
  day: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  slots: NormalizedScheduleSlot[];
};

const DEFAULT_OPEN_DAY_SET = new Set<string>(BOOKING_DEFAULT_OPEN_DAYS);

export function createDefaultSlotConfig() {
  return JSON.stringify(
    Object.fromEntries(BOOKING_SLOT_TIMES.map((time) => [time, true])),
  );
}

export function isBookingDayClosedByDefault(day: string) {
  return !DEFAULT_OPEN_DAY_SET.has(day);
}

export function parseSlotConfig(slotConfig?: string | null) {
  let parsed: Record<string, unknown> = {};

  if (slotConfig) {
    try {
      const value = JSON.parse(slotConfig);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      parsed = {};
    }
  }

  return Object.fromEntries(
    BOOKING_SLOT_TIMES.map((time) => [time, typeof parsed[time] === 'boolean' ? Boolean(parsed[time]) : true]),
  ) as Record<BookingSlotTime, boolean>;
}

export function serializeSlotConfig(
  slots?: Array<{ time: string; isAvailable?: boolean | null }> | Record<string, boolean> | null,
) {
  if (!slots) {
    return createDefaultSlotConfig();
  }

  const entries = Array.isArray(slots)
    ? slots.reduce<Record<string, boolean>>((acc, slot) => {
      acc[slot.time] = slot.isAvailable !== false;
      return acc;
    }, {})
    : slots;

  return JSON.stringify(
    Object.fromEntries(
      BOOKING_SLOT_TIMES.map((time) => [time, typeof entries[time] === 'boolean' ? Boolean(entries[time]) : true]),
    ),
  );
}

export function normalizeScheduleRow(row?: RawScheduleRow | null, dayOverride?: string): NormalizedScheduleDay {
  const day = dayOverride || row?.day || 'Monday';
  const slotAvailability = parseSlotConfig(row?.slotConfig);

  return {
    day,
    openTime: BOOKING_OPEN_TIME,
    closeTime: BOOKING_CLOSE_TIME,
    isClosed: row?.isClosed == null ? isBookingDayClosedByDefault(day) : Boolean(row.isClosed),
    slots: BOOKING_SLOT_TIMES.map((time) => ({
      time,
      isAvailable: slotAvailability[time],
      capacity: BOOKING_SLOT_CAPACITY,
    })),
  };
}

export function normalizeScheduleRows(rows: RawScheduleRow[]) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return BOOKING_DAY_ORDER.map((day) => normalizeScheduleRow(byDay.get(day), day));
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60) + minutes;
}

export function combineDateAndTime(baseDate: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(baseDate);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

export function getSlotTimesForDuration(startTime: string, duration: number) {
  const slotTimes: string[] = [];
  const startMinutes = timeToMinutes(startTime);
  const slotCount = Math.max(1, Math.ceil(duration / 30));

  for (let index = 0; index < slotCount; index += 1) {
    const minutes = startMinutes + (index * 30);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    slotTimes.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
  }

  return slotTimes;
}
