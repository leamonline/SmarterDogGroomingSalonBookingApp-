import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findBooking } from "../helpers/calendar.js";
import {
  OPEN_TIME,
  CLOSE_TIME,
  OPERATING_DAY_NAMES,
  SLOT_DURATION_MINUTES,
  MAX_DOGS_PER_SLOT,
  allSlotStartTimes,
} from "../config.js";

export function register(server: McpServer) {
  server.registerTool(
    "answer_customer_query",
    {
      description:
        "Answer common customer questions about the salon: opening hours, " +
        "services offered, pricing guidance, and how to find/manage their booking. " +
        "Use this for general enquiries rather than booking operations.",
      inputSchema: {
        topic: z
          .enum(["hours", "services", "pricing", "booking_lookup", "general"])
          .describe("Category of the customer's question"),
        date: z.string().optional().describe("Relevant date in YYYY-MM-DD format (for booking lookup or availability)"),
        dogName: z.string().optional().describe("Dog name (for booking lookup)"),
        time: z.string().optional().describe("Slot time (for booking lookup)"),
        freeformQuestion: z.string().optional().describe("The customer's question in their own words, for context"),
      },
    },
    async ({ topic, date, dogName, time, freeformQuestion }) => {
      switch (topic) {
        case "hours": {
          const days = [...OPERATING_DAY_NAMES.values()].join(", ");
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  answer:
                    `The salon is open ${days}, from ${OPEN_TIME} to ${CLOSE_TIME}. ` +
                    `Appointments are in ${SLOT_DURATION_MINUTES}-minute slots, with up to ${MAX_DOGS_PER_SLOT} dogs per slot.`,
                  operatingDays: days,
                  openTime: OPEN_TIME,
                  closeTime: CLOSE_TIME,
                  slotDuration: `${SLOT_DURATION_MINUTES} minutes`,
                  maxDogsPerSlot: MAX_DOGS_PER_SLOT,
                }),
              },
            ],
          };
        }

        case "services": {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  answer:
                    "We offer a range of grooming services including Full Groom, Bath & Dry, " +
                    "Nail Trim, Puppy Introduction, and Deshedding treatments. " +
                    "Each appointment is a 30-minute slot. Larger dogs or complex grooms " +
                    "may need a double slot — please mention this when booking.",
                  services: ["Full Groom", "Bath & Dry", "Nail Trim", "Puppy Introduction", "Deshedding Treatment"],
                }),
              },
            ],
          };
        }

        case "pricing": {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  answer:
                    "Pricing depends on the dog's size, coat type, and the service requested. " +
                    "As a guide: Nail Trim from £10, Bath & Dry from £20, Full Groom from £35. " +
                    "Please contact the salon for an exact quote for your dog.",
                  guidance: [
                    { service: "Nail Trim", from: "£10" },
                    { service: "Bath & Dry", from: "£20" },
                    { service: "Full Groom", from: "£35" },
                    { service: "Puppy Introduction", from: "£15" },
                    { service: "Deshedding Treatment", from: "£30" },
                  ],
                  note: "Prices vary by breed and coat condition. These are starting prices.",
                }),
              },
            ],
          };
        }

        case "booking_lookup": {
          if (!date || !dogName || !time) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: "To look up a booking, please provide the date, time, and dog name.",
                  }),
                },
              ],
            };
          }

          const booking = await findBooking(date, time, dogName);
          if (!booking) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    answer:
                      `No booking found for "${dogName}" at ${time} on ${date}. ` +
                      "Please double-check the details or contact the salon.",
                  }),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  answer: `Found booking for ${booking.dogName} (owner: ${booking.ownerName}).`,
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
                }),
              },
            ],
          };
        }

        case "general":
        default: {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  answer:
                    "PetSpa is a dog grooming salon open Monday to Wednesday, 08:30–13:00. " +
                    "We offer Full Groom, Bath & Dry, Nail Trim, Puppy Introduction, and Deshedding. " +
                    "You can book, reschedule, or cancel appointments through this assistant.",
                  availableSlots: allSlotStartTimes(),
                  hint:
                    "Use get_bookings to check availability for a specific date, " +
                    "or create_booking to make a new appointment.",
                  customerQuestion: freeformQuestion ?? null,
                }),
              },
            ],
          };
        }
      }
    },
  );
}
