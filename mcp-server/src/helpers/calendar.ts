/**
 * Google Calendar API wrapper.
 *
 * Supports two auth modes controlled by environment variables:
 *
 *   1. **Service account** (recommended for server-to-server):
 *      Set GOOGLE_SERVICE_ACCOUNT_KEY to the JSON key file contents
 *      (or GOOGLE_SERVICE_ACCOUNT_KEY_FILE to the path).
 *
 *   2. **OAuth2 credentials**:
 *      Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.
 *
 * The calendar helper exposes simple, typed wrappers around the Events
 * resource so the tool implementations never touch googleapis directly.
 */

import { google, calendar_v3 } from "googleapis";
import { CALENDAR_ID, TIMEZONE, MAX_DOGS_PER_SLOT, allSlotStartTimes, toRfc3339, slotEndTime } from "../config.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BookingEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  endTime: string;
  dogName: string;
  ownerName: string;
  phone?: string;
  serviceType?: string;
  notes?: string;
  summary: string;
}

export interface SlotInfo {
  time: string;
  endTime: string;
  bookings: BookingEvent[];
  spotsRemaining: number;
  isFull: boolean;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function getAuth() {
  // Service account path
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const saKeyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

  if (saKey || saKeyFile) {
    const credentials = saKey ? JSON.parse(saKey) : undefined;
    return new google.auth.GoogleAuth({
      ...(credentials ? { credentials } : { keyFile: saKeyFile }),
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  }

  // OAuth2 path
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  throw new Error(
    "Google Calendar auth not configured. " +
      "Set GOOGLE_SERVICE_ACCOUNT_KEY (or _KEY_FILE) for service-account auth, " +
      "or GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN for OAuth2.",
  );
}

let _calendar: calendar_v3.Calendar | null = null;

export function getCalendar(): calendar_v3.Calendar {
  if (!_calendar) {
    _calendar = google.calendar({ version: "v3", auth: getAuth() });
  }
  return _calendar;
}

// ── Event parsing ────────────────────────────────────────────────────────────

/**
 * Our convention for calendar event data:
 *   Summary: "Dog Name — Owner Name"
 *   Description (optional): "Service: Full Groom\nPhone: 07...\nNotes: ..."
 */
function parseEvent(event: calendar_v3.Schema$Event): BookingEvent | null {
  if (!event.id || !event.start?.dateTime || !event.summary) return null;

  const start = new Date(event.start.dateTime);
  const date = start.toISOString().slice(0, 10);
  const time = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;

  const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
  const endTime = end
    ? `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`
    : slotEndTime(time);

  // Parse summary: "DogName — OwnerName" or "DogName - OwnerName"
  const summaryParts = event.summary.split(/\s*[—–-]\s*/);
  const dogName = summaryParts[0]?.trim() ?? event.summary;
  const ownerName = summaryParts[1]?.trim() ?? "Unknown";

  // Parse description for structured fields
  const desc = event.description ?? "";
  const serviceMatch = desc.match(/Service:\s*(.+)/i);
  const phoneMatch = desc.match(/Phone:\s*(.+)/i);
  const notesMatch = desc.match(/Notes:\s*(.+)/i);

  return {
    id: event.id,
    date,
    time,
    endTime,
    dogName,
    ownerName,
    phone: phoneMatch?.[1]?.trim(),
    serviceType: serviceMatch?.[1]?.trim(),
    notes: notesMatch?.[1]?.trim(),
    summary: event.summary,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all booking events for a single date.
 */
export async function getEventsForDate(dateStr: string): Promise<BookingEvent[]> {
  const cal = getCalendar();
  const timeMin = `${dateStr}T00:00:00`;
  const timeMax = `${dateStr}T23:59:59`;

  const res = await cal.events.list({
    calendarId: CALENDAR_ID,
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    timeZone: TIMEZONE,
  });

  return (res.data.items ?? []).map(parseEvent).filter((e): e is BookingEvent => e !== null);
}

/**
 * Fetch events across a date range (inclusive).
 */
export async function getEventsForRange(startDate: string, endDate: string): Promise<BookingEvent[]> {
  const cal = getCalendar();

  const res = await cal.events.list({
    calendarId: CALENDAR_ID,
    timeMin: new Date(`${startDate}T00:00:00`).toISOString(),
    timeMax: new Date(`${endDate}T23:59:59`).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    timeZone: TIMEZONE,
  });

  return (res.data.items ?? []).map(parseEvent).filter((e): e is BookingEvent => e !== null);
}

/**
 * Build a slot-by-slot availability map for a date.
 */
export async function getSlotsForDate(dateStr: string): Promise<SlotInfo[]> {
  const events = await getEventsForDate(dateStr);
  const slotStarts = allSlotStartTimes();

  return slotStarts.map((time) => {
    const bookings = events.filter((e) => e.time === time);
    return {
      time,
      endTime: slotEndTime(time),
      bookings,
      spotsRemaining: MAX_DOGS_PER_SLOT - bookings.length,
      isFull: bookings.length >= MAX_DOGS_PER_SLOT,
    };
  });
}

/**
 * Check if a specific slot has room for one more booking.
 */
export async function isSlotAvailable(dateStr: string, time: string): Promise<boolean> {
  const events = await getEventsForDate(dateStr);
  const count = events.filter((e) => e.time === time).length;
  return count < MAX_DOGS_PER_SLOT;
}

/**
 * Create a new calendar event (booking).
 */
export async function createEvent(params: {
  date: string;
  time: string;
  dogName: string;
  ownerName: string;
  phone?: string;
  serviceType?: string;
  notes?: string;
}): Promise<BookingEvent> {
  const cal = getCalendar();

  const summary = `${params.dogName} — ${params.ownerName}`;
  const descriptionLines: string[] = [];
  if (params.serviceType) descriptionLines.push(`Service: ${params.serviceType}`);
  if (params.phone) descriptionLines.push(`Phone: ${params.phone}`);
  if (params.notes) descriptionLines.push(`Notes: ${params.notes}`);

  const res = await cal.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary,
      description: descriptionLines.join("\n") || undefined,
      start: {
        dateTime: toRfc3339(params.date, params.time),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: toRfc3339(params.date, slotEndTime(params.time)),
        timeZone: TIMEZONE,
      },
    },
  });

  return {
    id: res.data.id!,
    date: params.date,
    time: params.time,
    endTime: slotEndTime(params.time),
    dogName: params.dogName,
    ownerName: params.ownerName,
    phone: params.phone,
    serviceType: params.serviceType,
    notes: params.notes,
    summary,
  };
}

/**
 * Update an existing event.
 */
export async function updateEvent(
  eventId: string,
  updates: {
    date?: string;
    time?: string;
    dogName?: string;
    ownerName?: string;
    phone?: string;
    serviceType?: string;
    notes?: string;
  },
): Promise<BookingEvent> {
  const cal = getCalendar();

  // Fetch the existing event first
  const existing = await cal.events.get({
    calendarId: CALENDAR_ID,
    eventId,
  });

  const oldParsed = parseEvent(existing.data);
  if (!oldParsed) throw new Error(`Could not parse existing event ${eventId}`);

  const dogName = updates.dogName ?? oldParsed.dogName;
  const ownerName = updates.ownerName ?? oldParsed.ownerName;
  const date = updates.date ?? oldParsed.date;
  const time = updates.time ?? oldParsed.time;
  const phone = updates.phone ?? oldParsed.phone;
  const serviceType = updates.serviceType ?? oldParsed.serviceType;
  const notes = updates.notes ?? oldParsed.notes;

  const summary = `${dogName} — ${ownerName}`;
  const descriptionLines: string[] = [];
  if (serviceType) descriptionLines.push(`Service: ${serviceType}`);
  if (phone) descriptionLines.push(`Phone: ${phone}`);
  if (notes) descriptionLines.push(`Notes: ${notes}`);

  await cal.events.update({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: {
      summary,
      description: descriptionLines.join("\n") || undefined,
      start: {
        dateTime: toRfc3339(date, time),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: toRfc3339(date, slotEndTime(time)),
        timeZone: TIMEZONE,
      },
    },
  });

  return {
    id: eventId,
    date,
    time,
    endTime: slotEndTime(time),
    dogName,
    ownerName,
    phone,
    serviceType,
    notes,
    summary,
  };
}

/**
 * Delete (cancel) an event.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const cal = getCalendar();
  await cal.events.delete({
    calendarId: CALENDAR_ID,
    eventId,
  });
}

/**
 * Find a booking by date + time + dog name (case-insensitive).
 * Returns the first match or null.
 */
export async function findBooking(dateStr: string, time: string, dogName: string): Promise<BookingEvent | null> {
  const events = await getEventsForDate(dateStr);
  const needle = dogName.toLowerCase();
  return events.find((e) => e.time === time && e.dogName.toLowerCase() === needle) ?? null;
}
