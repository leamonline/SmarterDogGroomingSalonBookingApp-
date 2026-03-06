# PetSpa

PetSpa is a Vite + React frontend with an Express backend and a SQLite data store for salon operations.

## Requirements

- Node.js 18+
- npm

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`
3. Set a strong `JWT_SECRET` in `.env.local`
4. Optional on a fresh database: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` if you want custom seeded owner credentials
5. Run the app: `npm run dev`

The frontend runs on `http://localhost:3000` and proxies API requests to the Express server on `http://localhost:3001`.

SQLite data is stored in `petspa.db` in the repo root. On an empty database, the app seeds demo data automatically.

## Scripts

- `npm run dev` starts the Vite client and the Express server together
- `npm run typecheck` runs TypeScript without emitting files
- `npm run lint` aliases the typecheck step
- `npm test` runs the Vitest API suite
- `npm run build` runs typecheck and builds the Vite frontend into `dist/`
- `npm run preview` serves the built frontend locally
- `npm run clean` removes the `dist/` folder

## Build note

The current production build is frontend-only. `npm run build` creates the Vite bundle, but this repo does not yet emit a standalone server bundle for `dist/server`.

## Environment variables

See `.env.example` for the supported variables.

- `JWT_SECRET` is required
- `PORT` defaults to `3001`
- `CORS_ORIGIN` should match the frontend origin in non-local environments
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` customize the first seeded owner account on a fresh database
- SMTP variables are optional; without them, outgoing messages are simulated and logged
- `MAX_BACKUPS` controls retained SQLite backups
