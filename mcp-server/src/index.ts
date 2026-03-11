#!/usr/bin/env node
/**
 * PetSpa MCP Server
 *
 * Exposes dog grooming salon booking tools to Claude via the
 * Model Context Protocol, backed by Google Calendar.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { register as registerGetBookings } from "./tools/get_bookings.js";
import { register as registerCreateBooking } from "./tools/create_booking.js";
import { register as registerModifyBooking } from "./tools/modify_booking.js";
import { register as registerAnswerCustomerQuery } from "./tools/answer_customer_query.js";
import { register as registerRunDailyCashup } from "./tools/run_daily_cashup.js";

const server = new McpServer({
  name: "petspa-booking",
  version: "1.0.0",
});

// Register all tools
registerGetBookings(server);
registerCreateBooking(server);
registerModifyBooking(server);
registerAnswerCustomerQuery(server);
registerRunDailyCashup(server);

// Start the server over stdio
const transport = new StdioServerTransport();
await server.connect(transport);
