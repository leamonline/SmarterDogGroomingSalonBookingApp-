/**
 * Appointment status transition rules.
 * Keep in sync with server/helpers/statusMachine.ts
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
