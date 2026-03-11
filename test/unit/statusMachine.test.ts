import { describe, it, expect } from "vitest";
import { isValidTransition, STATUS_TRANSITIONS } from "../../server/helpers/statusMachine.js";

describe("statusMachine", () => {
  describe("isValidTransition", () => {
    it("allows confirmed → checked-in", () => {
      expect(isValidTransition("confirmed", "checked-in")).toBe(true);
    });

    it("allows in-progress → completed", () => {
      expect(isValidTransition("in-progress", "completed")).toBe(true);
    });

    it("allows pending-approval → confirmed", () => {
      expect(isValidTransition("pending-approval", "confirmed")).toBe(true);
    });

    it("allows checked-in → in-progress", () => {
      expect(isValidTransition("checked-in", "in-progress")).toBe(true);
    });

    it("rejects completed → in-progress (terminal)", () => {
      expect(isValidTransition("completed", "in-progress")).toBe(false);
    });

    it("rejects cancelled-by-salon → confirmed (terminal)", () => {
      expect(isValidTransition("cancelled-by-salon", "confirmed")).toBe(false);
    });

    it("rejects cancelled-by-customer → anything (terminal)", () => {
      expect(isValidTransition("cancelled-by-customer", "confirmed")).toBe(false);
      expect(isValidTransition("cancelled-by-customer", "scheduled")).toBe(false);
    });

    it("rejects no-show → anything (terminal)", () => {
      expect(isValidTransition("no-show", "confirmed")).toBe(false);
    });

    it("rejects skipping states (confirmed → completed)", () => {
      expect(isValidTransition("confirmed", "completed")).toBe(false);
    });

    it("rejects backward transitions (checked-in → confirmed)", () => {
      expect(isValidTransition("checked-in", "confirmed")).toBe(false);
    });

    it("returns false for unknown source status", () => {
      expect(isValidTransition("nonexistent", "confirmed")).toBe(false);
    });

    it("allows rescheduled → confirmed", () => {
      expect(isValidTransition("rescheduled", "confirmed")).toBe(true);
    });

    it("allows incomplete → incident-review", () => {
      expect(isValidTransition("incomplete", "incident-review")).toBe(true);
    });

    it("allows incident-review → completed", () => {
      expect(isValidTransition("incident-review", "completed")).toBe(true);
    });
  });

  describe("STATUS_TRANSITIONS completeness", () => {
    const allStatuses = Object.keys(STATUS_TRANSITIONS);

    it("has transition rules for all expected statuses", () => {
      const expected = [
        "pending-approval",
        "confirmed",
        "scheduled",
        "deposit-pending",
        "deposit-paid",
        "checked-in",
        "in-progress",
        "ready-for-collection",
        "completed",
        "cancelled-by-customer",
        "cancelled-by-salon",
        "no-show",
        "rescheduled",
        "incomplete",
        "incident-review",
      ];
      for (const status of expected) {
        expect(allStatuses).toContain(status);
      }
    });

    it("terminal statuses have empty transition arrays", () => {
      const terminals = ["completed", "cancelled-by-customer", "cancelled-by-salon", "no-show"];
      for (const status of terminals) {
        expect(STATUS_TRANSITIONS[status]).toEqual([]);
      }
    });

    it("every target status exists as a source status", () => {
      for (const [, targets] of Object.entries(STATUS_TRANSITIONS)) {
        for (const target of targets) {
          expect(allStatuses).toContain(target);
        }
      }
    });
  });
});
