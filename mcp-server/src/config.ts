/**
 * Salon operating rules and Google Calendar configuration.
 *
 * All business-logic constants live here so tools can share them
 * without duplicating magic numbers.
 */

// ── Google Calendar ──────────────────────────────────────────────────────────
export const CALENDAR_ID =
  process.env.GOOGLE_CALENDAR_ID ??
  "10eb503388601f95697a19ef49c09f12412ff5ef5716bda6962a523969cf137b@group.calendar.google.com";

// ── Operating schedule ───────────────────────────────────────────────────────
/** Days the salon is open (0 = Sunday, 1 = Monday, …). */
export const OPERATING_DAYS = new Set([1, 2, 3]); // Mon, Tue, Wed
export const OPERATING_DAY_NAMES = new Map([
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
]);

/** Inclusive start/end of the booking window in HH:MM. */
export const OPEN_TIME = "08:30";
export const CLOSE_TIME = "13:00";

/** Duration of a single slot in minutes. */
export const SLOT_DURATION_MINUTES = 30;

/** Maximum dogs allowed in a single slot. */
export const MAX_DOGS_PER_SLOT = 2;

// ── Derived helpers ──────────────────────────────────────────────────────────

/** Parse "HH:MM" into total minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Format total minutes since midnight back to "HH:MM". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** All slot start-times for one operating day (e.g. ["08:30", "09:00", …, "12:30"]). */
export function allSlotStartTimes(): string[] {
  const start = timeToMinutes(OPEN_TIME);
  const end = timeToMinutes(CLOSE_TIME);
  const slots: string[] = [];
  for (let m = start; m + SLOT_DURATION_MINUTES <= end; m += SLOT_DURATION_MINUTES) {
    slots.push(minutesToTime(m));
  }
  return slots;
}

/** Check whether a given JS Date falls on an operating day. */
export function isOperatingDay(date: Date): boolean {
  return OPERATING_DAYS.has(date.getDay());
}

/** Check whether a time string is a valid slot start. */
export function isValidSlotTime(time: string): boolean {
  return allSlotStartTimes().includes(time);
}

/**
 * Build an RFC 3339 datetime string for Google Calendar from a
 * date string ("YYYY-MM-DD") and a time string ("HH:MM").
 * Assumes the salon's local timezone (Europe/London).
 */
export const TIMEZONE = "Europe/London";

export function toRfc3339(dateStr: string, time: string): string {
  return `${dateStr}T${time}:00`;
}

export function slotEndTime(time: string): string {
  return minutesToTime(timeToMinutes(time) + SLOT_DURATION_MINUTES);
}
