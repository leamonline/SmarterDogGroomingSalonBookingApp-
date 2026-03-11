import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findBooking, updateEvent, deleteEvent, isSlotAvailable } from "../helpers/calendar.js";
import { OPERATING_DAYS, OPERATING_DAY_NAMES, isValidSlotTime, allSlotStartTimes } from "../config.js";

export function register(server: McpServer) {
  server.registerTool(
    "modify_booking",
    {
      description:
        "Reschedule, update, or cancel an existing booking. " +
        "Finds the booking by date + time + dog name, then applies the requested changes. " +
        "Set action to 'cancel' to delete the booking, or 'update' to change details.",
      inputSchema: {
        date: z.string().describe("Current appointment date in YYYY-MM-DD format"),
        time: z.string().describe("Current slot time in HH:MM format"),
        dogName: z.string().describe("Name of the dog (used to find the booking)"),
        action: z.enum(["update", "cancel"]).describe("Whether to update or cancel the booking"),
        newDate: z.string().optional().describe("New date if rescheduling (YYYY-MM-DD)"),
        newTime: z.string().optional().describe("New time if rescheduling (HH:MM)"),
        newDogName: z.string().optional().describe("Updated dog name"),
        newOwnerName: z.string().optional().describe("Updated owner name"),
        phone: z.string().optional().describe("Updated phone number"),
        serviceType: z.string().optional().describe("Updated service type"),
        notes: z.string().optional().describe("Updated notes"),
      },
    },
    async ({ date, time, dogName, action, newDate, newTime, newDogName, newOwnerName, phone, serviceType, notes }) => {
      // Find the existing booking
      const booking = await findBooking(date, time, dogName);
      if (!booking) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `No booking found for "${dogName}" at ${time} on ${date}. Check the date, time, and dog name.`,
              }),
            },
          ],
        };
      }

      // Handle cancellation
      if (action === "cancel") {
        await deleteEvent(booking.id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Booking for ${booking.dogName} (owner: ${booking.ownerName}) on ${date} at ${time} has been cancelled.`,
              }),
            },
          ],
        };
      }

      // Handle update/reschedule
      const targetDate = newDate ?? date;
      const targetTime = newTime ?? time;

      // Validate new date if rescheduling
      if (newDate) {
        const d = new Date(`${newDate}T12:00:00`);
        if (!OPERATING_DAYS.has(d.getDay())) {
          const dayNames = [...OPERATING_DAY_NAMES.values()].join(", ");
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Cannot reschedule to ${newDate} — salon is closed. Operating days: ${dayNames}.`,
                }),
              },
            ],
          };
        }
      }

      // Validate new time
      if (newTime && !isValidSlotTime(newTime)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Invalid slot time "${newTime}". Valid times: ${allSlotStartTimes().join(", ")}.`,
              }),
            },
          ],
        };
      }

      // Check availability if date or time changed
      if (newDate || newTime) {
        const available = await isSlotAvailable(targetDate, targetTime);
        if (!available) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `The ${targetTime} slot on ${targetDate} is fully booked. Choose a different time.`,
                }),
              },
            ],
          };
        }
      }

      const updated = await updateEvent(booking.id, {
        date: newDate,
        time: newTime,
        dogName: newDogName,
        ownerName: newOwnerName,
        phone,
        serviceType,
        notes,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message: `Booking updated for ${updated.dogName} (owner: ${updated.ownerName}).`,
                booking: {
                  id: updated.id,
                  date: updated.date,
                  time: updated.time,
                  endTime: updated.endTime,
                  dogName: updated.dogName,
                  ownerName: updated.ownerName,
                  serviceType: updated.serviceType ?? "Not specified",
                  phone: updated.phone,
                  notes: updated.notes,
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
