# Architecture

## Overview

PetSpa is a full-stack monolith: a React single-page application served by an Express API backed by SQLite.

```
┌─────────────────────────────────┐
│         Browser (React SPA)     │
│  React 19 · React Router · TW  │
└──────────────┬──────────────────┘
               │ HTTP (JSON)
               ▼
┌─────────────────────────────────┐
│       Express API Server        │
│  JWT auth · Zod validation      │
│  Role-based access control      │
└──────────────┬──────────────────┘
               │ better-sqlite3
               ▼
┌─────────────────────────────────┐
│       SQLite (WAL mode)         │
│  10 schema migrations           │
│  Automatic seeding on first run │
└─────────────────────────────────┘
```

In development, Vite serves the frontend on port 3000 and proxies `/api/*` to Express on port 3001. In production, Express serves both the static SPA and the API from a single process.

## Directory Structure

```
├── server/                  # Express backend
│   ├── index.ts             # App setup, middleware, route mounting
│   ├── db.ts                # SQLite connection, migrations, seeding
│   ├── env.ts               # Zod-validated environment variables
│   ├── schema.ts            # Zod request validation schemas
│   ├── middleware/
│   │   ├── auth.ts          # JWT verification, role guards
│   │   └── requestId.ts     # Request ID tracking
│   ├── routes/              # Express route handlers
│   │   ├── auth.ts          # Login, password, staff management
│   │   ├── public.ts        # Public booking, services, schedule
│   │   ├── appointments.ts  # CRUD, status transitions, availability
│   │   ├── customers.ts     # Customer management, tags, lookup
│   │   ├── dogs.ts          # Pet management, tags
│   │   ├── services.ts      # Service & add-on management
│   │   ├── payments.ts      # Payment recording
│   │   ├── forms.ts         # Form templates & submissions
│   │   ├── settings.ts      # Shop settings & schedule
│   │   ├── reports.ts       # Analytics, search, audit log
│   │   └── messaging.ts     # Email/SMS messaging
│   ├── helpers/
│   │   ├── appointments.ts  # Availability engine, slot calculation
│   │   └── statusMachine.ts # Appointment status transitions
│   └── lib/
│       └── logger.ts        # Structured logger (JSON in prod)
│
├── src/                     # React frontend
│   ├── main.tsx             # App entry point
│   ├── App.tsx              # Router setup, auth provider
│   ├── pages/               # Route-level page components
│   ├── components/          # Shared and feature components
│   │   └── appointment/     # Decomposed appointment modal tabs
│   ├── lib/                 # Shared utilities
│   │   ├── api.ts           # Fetch wrapper with cookie auth
│   │   ├── AuthContext.tsx   # JWT auth context provider
│   │   ├── appointmentUtils.ts  # Shared formatting helpers
│   │   └── statusTransitions.ts # Client-side status rules
│   └── test-setup.ts        # Vitest/jsdom test configuration
│
├── test/                    # Test suites
│   ├── api.test.ts          # API integration tests
│   ├── unit/                # Unit tests
│   └── smoke/               # Playwright E2E tests
│
├── docs/                    # Project documentation
├── .github/workflows/       # CI/CD pipeline
└── scripts/                 # Build scripts
```

## Key Architectural Decisions

### Single-Process Monolith

The API and SPA are served from one Node.js process. This simplifies deployment and avoids CORS issues in production. SQLite's single-writer model is a natural fit.

### SQLite with WAL Mode

Write-Ahead Logging enables concurrent reads during writes. The database is stored at `petspa.db` in the repo root with automatic 6-hour backups to `data/backups/`.

### Cookie-Based JWT Authentication

JWTs are stored in `httpOnly` cookies (not localStorage) to prevent XSS token theft. The `credentials: "include"` fetch option sends cookies automatically.

### Role Hierarchy

```
customer (0) < groomer (1) < receptionist (2) < owner (3)
```

Middleware guards: `requireStaff` (role >= 1), `requireAdmin` (role >= 2), `requireOwner` (role >= 3).

### Zod Validation

All API inputs are validated with Zod schemas in `server/schema.ts`. Environment variables are also validated at boot via `server/env.ts`.

### Status State Machine

Appointment lifecycle is enforced by a shared status machine (`server/helpers/statusMachine.ts`) used by both the server (validation) and client (UI). Server-side timestamps are set automatically on transitions.

### Database Migrations

Schema changes are tracked in a `schema_migrations` table. The `safeAddColumn` helper adds columns idempotently. Migrations run automatically on startup.

## Request Lifecycle

```
Request
  → Request ID middleware (UUID tracking)
  → CORS
  → Morgan (HTTP logging)
  → Cookie Parser
  → JSON Body Parser
  → Security Headers (nosniff, DENY, XSS, HSTS)
  → Rate Limiter (public routes only)
  → JWT Authentication (protected routes)
  → Role Guard (requireStaff / requireAdmin / requireOwner)
  → Route Handler
  → Zod Input Validation
  → Database Operation (with transactions for writes)
  → JSON Response
  → Global Error Handler (catches unhandled errors)
```

## Build & Deploy

- **Development**: `npm run dev` runs Vite + Express via `concurrently`
- **Production build**: `npm run build` creates `dist/` with Vite assets and bundled server
- **Docker**: Multi-stage build with `node:20-alpine` and `tini` for signal handling
- **CI/CD**: GitHub Actions runs lint → test (with coverage) → build → E2E on every push/PR to main
