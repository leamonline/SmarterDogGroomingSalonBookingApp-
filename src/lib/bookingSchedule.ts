export const BOOKING_DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const BOOKING_DEFAULT_OPEN_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
] as const;

export const BOOKING_OPEN_TIME = "08:30";
export const BOOKING_CLOSE_TIME = "15:30";
export const BOOKING_SLOT_CAPACITY = 2;
export const BOOKING_SLOT_TIMES = [
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
] as const;

export type BookingSlot = {
  time: string;
  isAvailable: boolean;
  capacity?: number;
};

export type BookingScheduleDay = {
  day: string;
  openTime?: string | null;
  closeTime?: string | null;
  isClosed: boolean;
  slots: BookingSlot[];
};

const DEFAULT_OPEN_DAY_SET = new Set<string>(BOOKING_DEFAULT_OPEN_DAYS);

function defaultSlots() {
  return BOOKING_SLOT_TIMES.map((time) => ({
    time,
    isAvailable: true,
    capacity: BOOKING_SLOT_CAPACITY,
  }));
}

export function isBookingDayClosedByDefault(dayName: string) {
  return !DEFAULT_OPEN_DAY_SET.has(dayName);
}

export function createDefaultScheduleDay(dayName: string): BookingScheduleDay {
  return {
    day: dayName,
    openTime: BOOKING_OPEN_TIME,
    closeTime: BOOKING_CLOSE_TIME,
    isClosed: isBookingDayClosedByDefault(dayName),
    slots: defaultSlots(),
  };
}

export function normalizeScheduleDays(days?: any[]): BookingScheduleDay[] {
  const byDay = new Map((days || []).map((day) => [day.day, day]));

  return BOOKING_DAY_ORDER.map((dayName) => {
    const row = byDay.get(dayName);
    const defaultDay = createDefaultScheduleDay(dayName);
    const slotMap = new Map<string, { isAvailable?: boolean; capacity?: number }>(
      (row?.slots || []).map((slot: any) => [slot.time, slot]),
    );

    return {
      ...defaultDay,
      isClosed: row?.isClosed == null ? defaultDay.isClosed : Boolean(row.isClosed),
      slots: defaultDay.slots.map((slot) => {
        const incoming = slotMap.get(slot.time);
        return {
          time: slot.time,
          isAvailable: incoming?.isAvailable !== false,
          capacity: incoming?.capacity ?? BOOKING_SLOT_CAPACITY,
        };
      }),
    };
  });
}

export function formatScheduleTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")}${suffix}`;
}
