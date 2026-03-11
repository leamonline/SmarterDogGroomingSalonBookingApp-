# Contributing to PetSpa

## Getting Started

1. Fork the repo and clone locally
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and set a strong `JWT_SECRET`
4. Start the dev server: `npm run dev`

## Branch Naming

Use a prefix that describes the type of change:

- `feat/` — new feature
- `fix/` — bug fix
- `docs/` — documentation only
- `chore/` — tooling, deps, CI changes
- `test/` — adding or updating tests

Examples: `feat/online-payment-integration`, `fix/booking-race-condition`

## Commit Messages

Follow conventional commits:

```
feat: add deposit payment flow
fix: prevent past-date bookings
docs: add API endpoint reference
test: add status transition coverage
chore: upgrade vitest to v4
```

Keep the subject line under 72 characters. Use the body for additional context when needed.

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- All CI checks must pass (lint, typecheck, tests, build)
- Include a brief description of **what** and **why**
- Link related issues if applicable

## Coding Standards

- **Formatting**: ESLint and Prettier are enforced via pre-commit hooks. Run `npm run lint:fix` to auto-fix.
- **TypeScript**: Use strict types. Avoid `any` where possible.
- **Validation**: Use Zod schemas for all API input validation (`server/schema.ts`).
- **Auth**: Use the role-based middleware (`requireStaff`, `requireAdmin`, `requireOwner`) on all protected routes.
- **Database**: Use transactions for multi-step writes. Use `safeAddColumn` for migrations.

## Testing

| Type             | Location                         | Command                   |
| ---------------- | -------------------------------- | ------------------------- |
| API / unit tests | `test/api.test.ts`, `test/unit/` | `npm test`                |
| Component tests  | `src/**/*.test.tsx`              | `npm run test:components` |
| E2E smoke tests  | `test/smoke/`                    | `npm run test:smoke`      |
| Coverage report  | `coverage/`                      | `npm run test:coverage`   |

**Expectations:**

- New API routes should have corresponding tests in `test/api.test.ts`
- New utility functions should have unit tests in `test/unit/`
- React components should have co-located `.test.tsx` files
- User-facing flows should be covered by Playwright smoke tests

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed overview.

## API Reference

See [API.md](./API.md) for the full endpoint reference.
