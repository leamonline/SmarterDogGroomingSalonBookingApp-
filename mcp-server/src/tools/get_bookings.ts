import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSlotsForDate } from "../helpers/calendar.js";
import { OPEN_TIME, CLOSE_TIME, OPERATING_DAY_NAMES, OPERATING_DAYS, allSlotStartTimes } from "../config.js";

export function register(server: McpServer) {
  server.registerTool(
    "get_bookings",
    {
      description:
        "Retrieve bookings and slot availability for a given date. " +
        "Returns each slot with its bookings and remaining capacity. " +
        "Use this to check the schedule, find open slots, or look up a specific dog's appointment.",
      inputSchema: {
        date: z.string().describe("Date to query in YYYY-MM-DD format (e.g. 2026-03-11)"),
      },
    },
    async ({ date }) => {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }),
            },
          ],
        };
      }

      const d = new Date(`${date}T12:00:00`);
      const dayOfWeek = d.getDay();

      if (!OPERATING_DAYS.has(dayOfWeek)) {
        const dayNames = [...OPERATING_DAY_NAMES.values()].join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  `The salon is closed on ${d.toLocaleDateString("en-GB", { weekday: "long" })}. ` +
                  `Operating days are: ${dayNames}.`,
              }),
            },
          ],
        };
      }

      const slots = await getSlotsForDate(date);
      const allBookings = slots.flatMap((s) => s.bookings);

      const result = {
        date,
        operatingHours: `${OPEN_TIME}–${CLOSE_TIME}`,
        totalSlots: allSlotStartTimes().length,
        totalBookings: allBookings.length,
        slots: slots.map((s) => ({
          time: s.time,
          endTime: s.endTime,
          spotsRemaining: s.spotsRemaining,
          isFull: s.isFull,
          bookings: s.bookings.map((b) => ({
            id: b.id,
            dogName: b.dogName,
            ownerName: b.ownerName,
            serviceType: b.serviceType ?? "Not specified",
            phone: b.phone,
            notes: b.notes,
          })),
        })),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
