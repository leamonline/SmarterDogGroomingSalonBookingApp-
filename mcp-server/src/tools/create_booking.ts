import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEvent, isSlotAvailable } from "../helpers/calendar.js";
import { OPERATING_DAYS, OPERATING_DAY_NAMES, isValidSlotTime, allSlotStartTimes } from "../config.js";

export function register(server: McpServer) {
  server.registerTool(
    "create_booking",
    {
      description:
        "Book a grooming appointment for a dog. " +
        "Checks slot availability before creating. " +
        "The salon operates Mon–Wed, 08:30–13:00, with 30-minute slots (max 2 dogs per slot).",
      inputSchema: {
        date: z.string().describe("Appointment date in YYYY-MM-DD format"),
        time: z.string().describe("Slot start time in HH:MM format (e.g. 09:00)"),
        dogName: z.string().describe("Name of the dog"),
        ownerName: z.string().describe("Name of the dog's owner"),
        phone: z.string().optional().describe("Owner's phone number"),
        serviceType: z
          .string()
          .optional()
          .describe("Type of grooming service (e.g. Full Groom, Bath & Dry, Nail Trim)"),
        notes: z.string().optional().describe("Additional notes for the groomer"),
      },
    },
    async ({ date, time, dogName, ownerName, phone, serviceType, notes }) => {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }) },
          ],
        };
      }

      // Validate operating day
      const d = new Date(`${date}T12:00:00`);
      if (!OPERATING_DAYS.has(d.getDay())) {
        const dayNames = [...OPERATING_DAY_NAMES.values()].join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `The salon is closed on ${d.toLocaleDateString("en-GB", { weekday: "long" })}. Operating days: ${dayNames}.`,
              }),
            },
          ],
        };
      }

      // Validate slot time
      if (!isValidSlotTime(time)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Invalid slot time "${time}". Valid times: ${allSlotStartTimes().join(", ")}.`,
              }),
            },
          ],
        };
      }

      // Check availability
      const available = await isSlotAvailable(date, time);
      if (!available) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `The ${time} slot on ${date} is fully booked. Please choose a different time.`,
              }),
            },
          ],
        };
      }

      const booking = await createEvent({ date, time, dogName, ownerName, phone, serviceType, notes });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message: `Booking confirmed for ${dogName} (owner: ${ownerName}) on ${date} at ${time}.`,
                booking: {
                  id: booking.id,
                  date: booking.date,
                  time: booking.time,
                  endTime: booking.endTime,
                  dogName: booking.dogName,
                  ownerName: booking.ownerName,
                  serviceType: booking.serviceType ?? "Not specified",
                  phone: booking.phone,
                  notes: booking.notes,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
