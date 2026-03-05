import db from '../db.js';

// Maximum grooming appointment duration used to bound the overlap query window.
export const MAX_DURATION_MINUTES = 480; // 8 hours, generous upper bound

// Helper to check for overlapping appointments.
// Uses a bounded time-window query instead of a full table scan.
export const hasOverlap = (dateString: string, duration: number, excludeId?: string) => {
    const start = new Date(dateString).getTime();
    const end = start + duration * 60000;

    // Only fetch rows that could possibly overlap this window
    const windowStart = new Date(start - MAX_DURATION_MINUTES * 60000).toISOString();
    const windowEnd = new Date(end).toISOString();

    const appointments = db.prepare(`
        SELECT id, date, duration FROM appointments
        WHERE date BETWEEN ? AND ?
          AND status NOT IN ('cancelled-by-customer', 'cancelled-by-salon', 'no-show')
    `).all(windowStart, windowEnd) as any[];

    for (const apt of appointments) {
        if (excludeId && apt.id === excludeId) continue;
        const aptStart = new Date(apt.date).getTime();
        const aptEnd = aptStart + (apt.duration || 60) * 60000;
        if (start < aptEnd && end > aptStart) return true;
    }
    return false;
};

export const getNextAvailableSlots = (fromIso: string, duration: number, maxResults = 5) => {
    const scheduleRows = db.prepare('SELECT day, openTime, closeTime, isClosed FROM schedule').all() as any[];
    const scheduleByDay = new Map(scheduleRows.map((r) => [r.day, r]));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const upcoming: string[] = [];
    const cursor = new Date(fromIso);
    const now = Number.isNaN(cursor.getTime()) ? new Date() : cursor;

    // Pre-fetch all appointments in the next 14-day window once
    const searchWindowStart = now.toISOString();
    const searchWindowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const existingAppts = db.prepare(`
        SELECT id, date, duration FROM appointments
        WHERE date BETWEEN ? AND ?
          AND status NOT IN ('cancelled-by-customer', 'cancelled-by-salon', 'no-show')
    `).all(searchWindowStart, searchWindowEnd) as any[];

    const slotConflicts = (slotStart: number, slotDur: number) => {
        const slotEnd = slotStart + slotDur * 60000;
        return existingAppts.some(apt => {
            const aptStart = new Date(apt.date).getTime();
            const aptEnd = aptStart + (apt.duration || 60) * 60000;
            return slotStart < aptEnd && slotEnd > aptStart;
        });
    };

    for (let dayOffset = 0; dayOffset < 14 && upcoming.length < maxResults; dayOffset++) {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() + dayOffset);
        const dayName = dayNames[dayDate.getDay()];
        const daySchedule = scheduleByDay.get(dayName);
        if (!daySchedule || daySchedule.isClosed) continue;

        const [openHour, openMin] = (daySchedule.openTime || '08:00').split(':').map(Number);
        const [closeHour, closeMin] = (daySchedule.closeTime || '17:00').split(':').map(Number);

        const windowStart = new Date(dayDate);
        windowStart.setHours(openHour, openMin, 0, 0);
        const windowEnd = new Date(dayDate);
        windowEnd.setHours(closeHour, closeMin, 0, 0);

        const slot = new Date(windowStart);
        while (slot.getTime() + duration * 60000 <= windowEnd.getTime() && upcoming.length < maxResults) {
            if (slot.getTime() >= now.getTime() && !slotConflicts(slot.getTime(), duration)) {
                upcoming.push(slot.toISOString());
            }
            slot.setMinutes(slot.getMinutes() + 15);
        }
    }

    return upcoming;
};
