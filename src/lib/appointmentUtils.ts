import { format } from "date-fns";
import type { Appointment } from "@/src/components/AppointmentModal";

export function formatDogCountLabel(dogCount?: number) {
  const count = dogCount || 1;
  return `${count} ${count === 1 ? "dog" : "dogs"}`;
}

export function formatDogCountReviewNote(reviewedAt?: string, reviewedBy?: string) {
  if (!reviewedAt) return null;
  const parsed = new Date(reviewedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return `Confirmed by ${reviewedBy || "staff"} on ${format(parsed, "d MMM yyyy 'at' h:mm a")}`;
}

export function isDogCountConfirmed(value: unknown) {
  return value === true || value === 1;
}

export function normalizeAppointment(item: any): Appointment {
  return {
    ...item,
    date: item.date instanceof Date ? item.date : new Date(item.date),
    dogCount: item.dogCount ?? 1,
    dogCountConfirmed: isDogCountConfirmed(item.dogCountConfirmed),
  };
}
