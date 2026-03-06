# PetSpa

PetSpa is a Vite + React frontend with an Express backend and a SQLite data store for salon operations.

## Requirements

- Node.js 22+
- npm

## Local setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`
3. Set a strong `JWT_SECRET` in `.env.local`
4. Run the app:
   `npm run dev`

The frontend runs on `http://localhost:3000` and proxies API requests to the Express server on `http://localhost:3001`.

## Scripts

- `npm run dev` starts the Vite client and the Express server together
- `npm run typecheck` runs TypeScript without emitting files
- `npm run lint` aliases the typecheck step
- `npm test` runs the Vitest API suite
- `npm run build` runs typecheck and then builds the frontend for production
- `npm run preview` serves the built frontend locally

## Environment variables

See `.env.example` for the supported variables.

- `JWT_SECRET` is required
- `PORT` defaults to `3001`
- `CORS_ORIGIN` should match the frontend origin in non-local environments
- SMTP variables are optional; without them, outgoing messages are simulated and logged
