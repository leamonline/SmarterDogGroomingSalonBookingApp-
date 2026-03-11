/**
 * Appointment status transition rules — shared source of truth for server and client.
 *
 * Terminal statuses (empty array) cannot transition to anything else.
 */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  "pending-approval": ["confirmed", "cancelled-by-salon"],
  confirmed: ["checked-in", "cancelled-by-customer", "cancelled-by-salon", "no-show", "rescheduled"],
  scheduled: ["checked-in", "cancelled-by-customer", "cancelled-by-salon", "no-show", "rescheduled"],
  "deposit-pending": ["deposit-paid", "cancelled-by-customer", "cancelled-by-salon"],
  "deposit-paid": ["confirmed", "checked-in"],
  "checked-in": ["in-progress", "cancelled-by-salon"],
  "in-progress": ["ready-for-collection", "completed", "incomplete", "incident-review"],
  "ready-for-collection": ["completed"],
  completed: [],
  "cancelled-by-customer": [],
  "cancelled-by-salon": [],
  "no-show": [],
  rescheduled: ["confirmed", "scheduled"],
  incomplete: ["incident-review"],
  "incident-review": ["completed"],
};

export function isValidTransition(from: string, to: string): boolean {
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
