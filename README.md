# PetSpa

PetSpa is a Vite + React frontend with an Express backend and a SQLite data store for salon operations.

## Documentation

- [Contributing Guide](docs/CONTRIBUTING.md) — branch naming, commit conventions, PR process
- [Architecture](docs/ARCHITECTURE.md) — system design, directory structure, key decisions
- [API Reference](docs/API.md) — all endpoints with auth requirements

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
- `npm run build` runs typecheck, builds the Vite frontend, and emits the production server bundle at `dist/server/index.js`
- `npm run test:smoke` builds the production app and runs the Playwright booking smoke suite
- `npm run preview` serves the built frontend locally
- `npm run clean` removes the `dist/` folder

## Production build

`npm run build` now creates a single deployable artifact:

- Vite frontend assets in `dist/`
- Bundled Express server entrypoint in `dist/server/index.js`

Start the built app with:

```bash
npm run build
JWT_SECRET=replace-me-with-a-long-random-secret npm start
```

The production server serves both the SPA and the `/api/*` routes from the same process.

## Environment variables

See `.env.example` for the supported variables.

- `JWT_SECRET` is required
- `PORT` defaults to `3001`
- `CORS_ORIGIN` should match the frontend origin in non-local environments
- `APP_URL` sets the public frontend URL used in password reset emails
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` customize the first seeded owner account on a fresh database
- SMTP variables are optional; without them, outgoing messages are simulated and logged
- `MAX_BACKUPS` controls retained SQLite backups

The server validates its required runtime configuration at boot and exits early if the values are missing or invalid. In production, do not use the placeholder `JWT_SECRET` from `.env.example`.

## Backup and restore

The app writes SQLite backups into `data/backups/` every 6 hours and keeps the newest `MAX_BACKUPS` files.

To restore from a backup:

1. Stop the running app.
2. Copy the chosen backup over `petspa.db`.
3. Remove any stale `petspa.db-shm` and `petspa.db-wal` files before restarting.

## Docker

Build and run with Docker Compose:

```bash
JWT_SECRET=your-secret-here docker compose up --build -d
```

The app will be available at `http://localhost:3001`. SQLite data is persisted in a named volume.

```bash
docker compose down       # stop
docker compose down -v    # stop and remove data volume
```

## Browser smoke tests

Install the Chromium browser once for Playwright:

```bash
npx playwright install chromium
```

Then run the production-mode booking smoke suite:

```bash
npm run test:smoke
```
