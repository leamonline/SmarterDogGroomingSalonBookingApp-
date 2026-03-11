import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the calendar helper before importing tools
vi.mock("../src/helpers/calendar.js", () => ({
  getEventsForDate: vi.fn(),
  getEventsForRange: vi.fn(),
  getSlotsForDate: vi.fn(),
  isSlotAvailable: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  findBooking: vi.fn(),
  getCalendar: vi.fn(),
}));

import {
  getEventsForDate,
  getSlotsForDate,
  isSlotAvailable,
  createEvent,
  findBooking,
  updateEvent,
  deleteEvent,
} from "../src/helpers/calendar.js";
// We'll test tool logic by importing the register functions and
// capturing the handler they register.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ToolHandler = (args: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

function registerAll(handlers: Map<string, ToolHandler>) {
  const fakeServer = {
    registerTool: (name: string, _meta: any, handler: ToolHandler) => {
      handlers.set(name, handler);
    },
  } as unknown as McpServer;

  // Dynamically import and register each tool
  return import("../src/tools/get_bookings.js")
    .then((m) => {
      m.register(fakeServer);
      return import("../src/tools/create_booking.js");
    })
    .then((m) => {
      m.register(fakeServer);
      return import("../src/tools/modify_booking.js");
    })
    .then((m) => {
      m.register(fakeServer);
      return import("../src/tools/answer_customer_query.js");
    })
    .then((m) => {
      m.register(fakeServer);
      return import("../src/tools/run_daily_cashup.js");
    })
    .then((m) => {
      m.register(fakeServer);
    });
}

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MCP Tools", () => {
  const handlers = new Map<string, ToolHandler>();

  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    await registerAll(handlers);
  });

  // ── get_bookings ──────────────────────────────────────────────────────────

  describe("get_bookings", () => {
    it("returns error for invalid date format", async () => {
      const handler = handlers.get("get_bookings")!;
      const result = parseResult(await handler({ date: "not-a-date" }));
      expect(result.error).toContain("Invalid date format");
    });

    it("returns error for non-operating day (Thursday)", async () => {
      const handler = handlers.get("get_bookings")!;
      const result = parseResult(await handler({ date: "2026-03-12" })); // Thursday
      expect(result.error).toContain("closed");
    });

    it("returns slots for a valid operating day", async () => {
      vi.mocked(getSlotsForDate).mockResolvedValue([
        {
          time: "08:30",
          endTime: "09:00",
          bookings: [],
          spotsRemaining: 2,
          isFull: false,
        },
        {
          time: "09:00",
          endTime: "09:30",
          bookings: [
            {
              id: "evt1",
              date: "2026-03-09",
              time: "09:00",
              endTime: "09:30",
              dogName: "Buddy",
              ownerName: "Jane",
              summary: "Buddy — Jane",
            },
          ],
          spotsRemaining: 1,
          isFull: false,
        },
      ]);

      const handler = handlers.get("get_bookings")!;
      const result = parseResult(await handler({ date: "2026-03-09" })); // Monday
      expect(result.date).toBe("2026-03-09");
      expect(result.totalBookings).toBe(1);
      expect(result.slots).toHaveLength(2);
      expect(result.slots[1].bookings[0].dogName).toBe("Buddy");
    });
  });

  // ── create_booking ────────────────────────────────────────────────────────

  describe("create_booking", () => {
    it("rejects invalid date format", async () => {
      const handler = handlers.get("create_booking")!;
      const result = parseResult(await handler({ date: "bad", time: "09:00", dogName: "Rex", ownerName: "Bob" }));
      expect(result.error).toContain("Invalid date format");
    });

    it("rejects non-operating day", async () => {
      const handler = handlers.get("create_booking")!;
      const result = parseResult(
        await handler({ date: "2026-03-14", time: "09:00", dogName: "Rex", ownerName: "Bob" }),
      ); // Saturday
      expect(result.error).toContain("closed");
    });

    it("rejects invalid slot time", async () => {
      const handler = handlers.get("create_booking")!;
      const result = parseResult(
        await handler({ date: "2026-03-09", time: "10:15", dogName: "Rex", ownerName: "Bob" }),
      );
      expect(result.error).toContain("Invalid slot time");
    });

    it("rejects fully booked slot", async () => {
      vi.mocked(isSlotAvailable).mockResolvedValue(false);
      const handler = handlers.get("create_booking")!;
      const result = parseResult(
        await handler({ date: "2026-03-09", time: "09:00", dogName: "Rex", ownerName: "Bob" }),
      );
      expect(result.error).toContain("fully booked");
    });

    it("creates booking successfully", async () => {
      vi.mocked(isSlotAvailable).mockResolvedValue(true);
      vi.mocked(createEvent).mockResolvedValue({
        id: "new-evt",
        date: "2026-03-09",
        time: "09:00",
        endTime: "09:30",
        dogName: "Rex",
        ownerName: "Bob",
        summary: "Rex — Bob",
        serviceType: "Full Groom",
      });

      const handler = handlers.get("create_booking")!;
      const result = parseResult(
        await handler({
          date: "2026-03-09",
          time: "09:00",
          dogName: "Rex",
          ownerName: "Bob",
          serviceType: "Full Groom",
        }),
      );
      expect(result.success).toBe(true);
      expect(result.booking.id).toBe("new-evt");
      expect(result.booking.dogName).toBe("Rex");
    });
  });

  // ── modify_booking ────────────────────────────────────────────────────────

  describe("modify_booking", () => {
    it("returns error when booking not found", async () => {
      vi.mocked(findBooking).mockResolvedValue(null);
      const handler = handlers.get("modify_booking")!;
      const result = parseResult(
        await handler({ date: "2026-03-09", time: "09:00", dogName: "Rex", action: "update" }),
      );
      expect(result.error).toContain("No booking found");
    });

    it("cancels a booking", async () => {
      vi.mocked(findBooking).mockResolvedValue({
        id: "evt1",
        date: "2026-03-09",
        time: "09:00",
        endTime: "09:30",
        dogName: "Rex",
        ownerName: "Bob",
        summary: "Rex — Bob",
      });
      vi.mocked(deleteEvent).mockResolvedValue(undefined);

      const handler = handlers.get("modify_booking")!;
      const result = parseResult(
        await handler({ date: "2026-03-09", time: "09:00", dogName: "Rex", action: "cancel" }),
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain("cancelled");
      expect(deleteEvent).toHaveBeenCalledWith("evt1");
    });

    it("reschedules a booking to a new time", async () => {
      vi.mocked(findBooking).mockResolvedValue({
        id: "evt1",
        date: "2026-03-09",
        time: "09:00",
        endTime: "09:30",
        dogName: "Rex",
        ownerName: "Bob",
        summary: "Rex — Bob",
      });
      vi.mocked(isSlotAvailable).mockResolvedValue(true);
      vi.mocked(updateEvent).mockResolvedValue({
        id: "evt1",
        date: "2026-03-09",
        time: "10:00",
        endTime: "10:30",
        dogName: "Rex",
        ownerName: "Bob",
        summary: "Rex — Bob",
      });

      const handler = handlers.get("modify_booking")!;
      const result = parseResult(
        await handler({
          date: "2026-03-09",
          time: "09:00",
          dogName: "Rex",
          action: "update",
          newTime: "10:00",
        }),
      );
      expect(result.success).toBe(true);
      expect(result.booking.time).toBe("10:00");
    });

    it("rejects rescheduling to a non-operating day", async () => {
      vi.mocked(findBooking).mockResolvedValue({
        id: "evt1",
        date: "2026-03-09",
        time: "09:00",
        endTime: "09:30",
        dogName: "Rex",
        ownerName: "Bob",
        summary: "Rex — Bob",
      });

      const handler = handlers.get("modify_booking")!;
      const result = parseResult(
        await handler({
          date: "2026-03-09",
          time: "09:00",
          dogName: "Rex",
          action: "update",
          newDate: "2026-03-14",
        }),
      ); // Saturday
      expect(result.error).toContain("closed");
    });
  });

  // ── answer_customer_query ─────────────────────────────────────────────────

  describe("answer_customer_query", () => {
    it("returns hours info", async () => {
      const handler = handlers.get("answer_customer_query")!;
      const result = parseResult(await handler({ topic: "hours" }));
      expect(result.answer).toContain("08:30");
      expect(result.answer).toContain("13:00");
      expect(result.operatingDays).toContain("Monday");
    });

    it("returns services info", async () => {
      const handler = handlers.get("answer_customer_query")!;
      const result = parseResult(await handler({ topic: "services" }));
      expect(result.services).toContain("Full Groom");
      expect(result.services).toContain("Nail Trim");
    });

    it("returns pricing guidance", async () => {
      const handler = handlers.get("answer_customer_query")!;
      const result = parseResult(await handler({ topic: "pricing" }));
      expect(result.guidance).toBeInstanceOf(Array);
      expect(result.note).toContain("Prices vary");
    });

    it("looks up a booking", async () => {
      vi.mocked(findBooking).mockResolvedValue({
        id: "evt1",
        date: "2026-03-09",
        time: "09:00",
        endTime: "09:30",
        dogName: "Buddy",
        ownerName: "Jane",
        summary: "Buddy — Jane",
      });

      const handler = handlers.get("answer_customer_query")!;
      const result = parseResult(
        await handler({ topic: "booking_lookup", date: "2026-03-09", time: "09:00", dogName: "Buddy" }),
      );
      expect(result.booking.dogName).toBe("Buddy");
    });

    it("requires all params for booking lookup", async () => {
      const handler = handlers.get("answer_customer_query")!;
      const result = parseResult(await handler({ topic: "booking_lookup" }));
      expect(result.error).toContain("provide the date");
    });

    it("returns general info", async () => {
      const handler = handlers.get("answer_customer_query")!;
      const result = parseResult(await handler({ topic: "general" }));
      expect(result.answer).toContain("PetSpa");
    });
  });

  // ── run_daily_cashup ──────────────────────────────────────────────────────

  describe("run_daily_cashup", () => {
    it("rejects invalid date format", async () => {
      const handler = handlers.get("run_daily_cashup")!;
      const result = parseResult(await handler({ date: "bad" }));
      expect(result.error).toContain("Invalid date format");
    });

    it("returns empty summary for a day with no bookings", async () => {
      vi.mocked(getEventsForDate).mockResolvedValue([]);
      const handler = handlers.get("run_daily_cashup")!;
      const result = parseResult(await handler({ date: "2026-03-09" }));
      expect(result.summary.totalBookings).toBe(0);
      expect(result.summary.estimatedRevenue).toBe("£0");
      expect(result.bookings).toHaveLength(0);
    });

    it("calculates revenue from bookings", async () => {
      vi.mocked(getEventsForDate).mockResolvedValue([
        {
          id: "e1",
          date: "2026-03-09",
          time: "09:00",
          endTime: "09:30",
          dogName: "Rex",
          ownerName: "Bob",
          serviceType: "Full Groom",
          summary: "Rex — Bob",
        },
        {
          id: "e2",
          date: "2026-03-09",
          time: "10:00",
          endTime: "10:30",
          dogName: "Max",
          ownerName: "Sue",
          serviceType: "Nail Trim",
          summary: "Max — Sue",
        },
      ]);

      const handler = handlers.get("run_daily_cashup")!;
      const result = parseResult(await handler({ date: "2026-03-09" }));
      expect(result.summary.totalBookings).toBe(2);
      expect(result.summary.estimatedRevenue).toBe("£45"); // 35 + 10
      expect(result.byService["Full Groom"].count).toBe(1);
      expect(result.byService["Nail Trim"].count).toBe(1);
    });
  });
});
