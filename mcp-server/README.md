# PetSpa MCP Server

Model Context Protocol server that connects the PetSpa dog grooming salon booking system to Claude via Google Calendar.

## Tools

| Tool | Description |
|------|-------------|
| `get_bookings` | Retrieve bookings and slot availability for a date |
| `create_booking` | Book a grooming appointment (validates day, time, capacity) |
| `modify_booking` | Reschedule, update, or cancel an existing booking |
| `answer_customer_query` | Answer questions about hours, services, pricing, or look up a booking |
| `run_daily_cashup` | Generate end-of-day summary with revenue estimates and utilisation |

## Salon Business Rules

- **Operating days:** Monday, Tuesday, Wednesday
- **Hours:** 08:30–13:00
- **Slot duration:** 30 minutes
- **Max dogs per slot:** 2
- **Timezone:** Europe/London

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Google Calendar auth

The server supports two authentication modes:

**Option A — Service Account (recommended for server-to-server):**

```bash
export GOOGLE_SERVICE_ACCOUNT_KEY='{ ... }'   # JSON key contents
# or
export GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/path/to/key.json
```

**Option B — OAuth2:**

```bash
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret
export GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### 3. Set the Calendar ID (optional)

Defaults to the PetSpa calendar. Override with:

```bash
export GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
```

### 4. Build & run

```bash
npm run build     # compile TypeScript
npm start         # run via stdio (for MCP client connection)
npm run dev       # run directly with tsx (development)
```

## Claude Desktop / Cowork Configuration

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "petspa-booking": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY_FILE": "/path/to/service-account-key.json"
      }
    }
  }
}
```

## Testing

```bash
npm test          # run all tests (32 tests across config + tools)
npm run typecheck # TypeScript type checking
```

## Calendar Event Convention

Events are stored in Google Calendar with this format:

- **Summary:** `Dog Name — Owner Name`
- **Description:** (optional, line-separated fields)
  ```
  Service: Full Groom
  Phone: 07123456789
  Notes: Nervous dog, handle gently
  ```

## Project Structure

```
mcp-server/
├── src/
│   ├── index.ts              # Entry point — wires tools to MCP server
│   ├── config.ts             # Business rules and time helpers
│   ├── helpers/
│   │   └── calendar.ts       # Google Calendar API wrapper
│   └── tools/
│       ├── get_bookings.ts
│       ├── create_booking.ts
│       ├── modify_booking.ts
│       ├── answer_customer_query.ts
│       └── run_daily_cashup.ts
├── test/
│   ├── config.test.ts        # Unit tests for business logic
│   └── tools.test.ts         # Tool handler tests (mocked calendar)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```
