import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getEventsForDate } from "../helpers/calendar.js";
import { OPEN_TIME, CLOSE_TIME, allSlotStartTimes, MAX_DOGS_PER_SLOT } from "../config.js";

/** Simple price estimates by service type for the cash-up summary. */
const SERVICE_PRICES: Record<string, number> = {
  "full groom": 35,
  "bath & dry": 20,
  "bath and dry": 20,
  "nail trim": 10,
  "puppy introduction": 15,
  "deshedding treatment": 30,
  deshedding: 30,
};

function estimatePrice(serviceType?: string): number {
  if (!serviceType) return 35; // default to full groom price
  const key = serviceType.toLowerCase().trim();
  return SERVICE_PRICES[key] ?? 35;
}

export function register(server: McpServer) {
  server.registerTool(
    "run_daily_cashup",
    {
      description:
        "Generate an end-of-day cash-up summary for a given date. " +
        "Shows total bookings, estimated revenue by service type, " +
        "slot utilisation, and a breakdown of each appointment.",
      inputSchema: {
        date: z.string().describe("Date to summarise in YYYY-MM-DD format"),
      },
    },
    async ({ date }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }) }],
        };
      }

      const bookings = await getEventsForDate(date);
      const totalSlots = allSlotStartTimes().length;
      const maxCapacity = totalSlots * MAX_DOGS_PER_SLOT;

      // Group by service type
      const byService = new Map<string, { count: number; revenue: number }>();
      let totalRevenue = 0;

      for (const b of bookings) {
        const svc = b.serviceType ?? "Not specified";
        const price = estimatePrice(b.serviceType);
        totalRevenue += price;

        const entry = byService.get(svc) ?? { count: 0, revenue: 0 };
        entry.count += 1;
        entry.revenue += price;
        byService.set(svc, entry);
      }

      // Slot utilisation
      const slotsUsed = new Set(bookings.map((b) => b.time)).size;

      const result = {
        date,
        operatingHours: `${OPEN_TIME}–${CLOSE_TIME}`,
        summary: {
          totalBookings: bookings.length,
          maxCapacity,
          utilisationPercent: maxCapacity > 0 ? Math.round((bookings.length / maxCapacity) * 100) : 0,
          slotsUsed,
          totalSlots,
          estimatedRevenue: `£${totalRevenue}`,
        },
        byService: Object.fromEntries(
          [...byService.entries()].map(([svc, data]) => [
            svc,
            { count: data.count, estimatedRevenue: `£${data.revenue}` },
          ]),
        ),
        bookings: bookings.map((b) => ({
          time: b.time,
          endTime: b.endTime,
          dogName: b.dogName,
          ownerName: b.ownerName,
          serviceType: b.serviceType ?? "Not specified",
          estimatedPrice: `£${estimatePrice(b.serviceType)}`,
        })),
        note: "Revenue figures are estimates based on standard pricing. Actual charges may vary.",
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
