# API Reference

Base URL: `/api`

## Authentication

All protected endpoints require a valid JWT cookie (set by the login endpoint). Role-based access is enforced by middleware:

| Guard          | Minimum Role     |
| -------------- | ---------------- |
| `requireStaff` | groomer (1)      |
| `requireAdmin` | receptionist (2) |
| `requireOwner` | owner (3)        |

---

## Auth (`/api/auth`, `/api/staff`)

| Method | Path                               | Auth          | Description                  |
| ------ | ---------------------------------- | ------------- | ---------------------------- |
| POST   | `/api/auth/login`                  | public        | Login with email/password    |
| POST   | `/api/auth/logout`                 | public        | Clear auth cookie            |
| GET    | `/api/auth/me`                     | authenticated | Get current user info        |
| POST   | `/api/auth/password`               | authenticated | Change password              |
| POST   | `/api/auth/password-reset/request` | public        | Request password reset email |
| POST   | `/api/auth/password-reset/confirm` | public        | Confirm reset with token     |
| GET    | `/api/staff`                       | requireAdmin  | List staff members           |
| POST   | `/api/staff`                       | requireAdmin  | Create staff member          |
| PUT    | `/api/staff/:id/role`              | requireOwner  | Update staff role            |

---

## Public (`/api/public`)

Rate-limited. No authentication required except for booking.

| Method | Path                          | Auth          | Description                |
| ------ | ----------------------------- | ------------- | -------------------------- |
| GET    | `/api/public/services`        | public        | List bookable services     |
| GET    | `/api/public/schedule`        | public        | Get shop hours and days    |
| GET    | `/api/public/available-slots` | public        | Available slots for a date |
| POST   | `/api/public/register`        | public        | Customer self-registration |
| POST   | `/api/public/login`           | public        | Customer login             |
| POST   | `/api/public/bookings`        | authenticated | Submit booking request     |

---

## Customers (`/api/customers`)

| Method | Path                                | Auth         | Description                    |
| ------ | ----------------------------------- | ------------ | ------------------------------ |
| GET    | `/api/customers`                    | requireStaff | List customers (paginated)     |
| GET    | `/api/customers/:id`                | requireStaff | Get customer with full details |
| POST   | `/api/customers`                    | requireStaff | Create customer                |
| PUT    | `/api/customers/:id`                | requireStaff | Update customer                |
| DELETE | `/api/customers/:id`                | requireAdmin | Delete customer                |
| GET    | `/api/customers/appointment-lookup` | requireStaff | Search by name/phone/breed     |
| GET    | `/api/customers/:id/tags`           | requireStaff | Get customer tags              |
| POST   | `/api/customers/:id/tags`           | requireStaff | Update customer tags           |

---

## Dogs (`/api/dogs`)

| Method | Path                 | Auth         | Description                         |
| ------ | -------------------- | ------------ | ----------------------------------- |
| GET    | `/api/dogs`          | requireStaff | List dogs (paginated, searchable)   |
| GET    | `/api/dogs/:id`      | requireStaff | Get dog with owner and appointments |
| GET    | `/api/dogs/:id/tags` | requireStaff | Get dog tags                        |
| POST   | `/api/dogs/:id/tags` | requireStaff | Update dog tags                     |

---

## Appointments (`/api/appointments`)

| Method | Path                               | Auth         | Description                   |
| ------ | ---------------------------------- | ------------ | ----------------------------- |
| GET    | `/api/appointments`                | requireStaff | List appointments (paginated) |
| GET    | `/api/appointments/next-available` | requireStaff | Next 5 available slots        |
| POST   | `/api/appointments`                | requireStaff | Create appointment            |
| PUT    | `/api/appointments/:id`            | requireStaff | Update appointment            |
| DELETE | `/api/appointments/:id`            | requireAdmin | Delete appointment            |

### Status Transitions

Appointments follow a state machine. Valid transitions:

```
pending-approval → confirmed, cancelled-by-salon
confirmed → checked-in, cancelled-by-customer, cancelled-by-salon, no-show, rescheduled
scheduled → checked-in, cancelled-by-customer, cancelled-by-salon, no-show, rescheduled
deposit-pending → deposit-paid, cancelled-by-customer, cancelled-by-salon
deposit-paid → confirmed, checked-in
checked-in → in-progress, cancelled-by-salon
in-progress → ready-for-collection, completed, incomplete, incident-review
ready-for-collection → completed
rescheduled → confirmed, scheduled
incomplete → incident-review
incident-review → completed
```

Terminal statuses (no further transitions): `completed`, `cancelled-by-customer`, `cancelled-by-salon`, `no-show`

---

## Services (`/api/services`, `/api/add-ons`)

| Method | Path                        | Auth         | Description             |
| ------ | --------------------------- | ------------ | ----------------------- |
| GET    | `/api/services`             | public       | List services           |
| POST   | `/api/services`             | requireAdmin | Create service          |
| PUT    | `/api/services/:id`         | requireAdmin | Update service          |
| DELETE | `/api/services/:id`         | requireAdmin | Delete service          |
| GET    | `/api/services/:id/add-ons` | public       | Get linked add-ons      |
| POST   | `/api/services/:id/add-ons` | requireAdmin | Link add-ons to service |
| GET    | `/api/add-ons`              | public       | List active add-ons     |
| POST   | `/api/add-ons`              | requireAdmin | Create add-on           |
| PUT    | `/api/add-ons/:id`          | requireAdmin | Update add-on           |
| DELETE | `/api/add-ons/:id`          | requireAdmin | Archive add-on          |

---

## Payments (`/api/payments`)

| Method | Path            | Auth         | Description                             |
| ------ | --------------- | ------------ | --------------------------------------- |
| GET    | `/api/payments` | requireStaff | List payments (filter by appointmentId) |
| POST   | `/api/payments` | requireStaff | Record payment                          |

---

## Forms (`/api/forms`, `/api/form-submissions`)

| Method | Path                    | Auth         | Description                   |
| ------ | ----------------------- | ------------ | ----------------------------- |
| GET    | `/api/forms`            | public       | List active forms             |
| POST   | `/api/forms`            | requireAdmin | Create form template          |
| PUT    | `/api/forms/:id`        | requireAdmin | Update form template          |
| GET    | `/api/form-submissions` | requireStaff | List submissions (filterable) |
| POST   | `/api/form-submissions` | requireStaff | Submit form response          |

---

## Settings (`/api/settings`)

| Method | Path                          | Auth         | Description                    |
| ------ | ----------------------------- | ------------ | ------------------------------ |
| GET    | `/api/settings`               | public       | Get shop settings and schedule |
| POST   | `/api/settings`               | requireAdmin | Update settings                |
| GET    | `/api/settings/notifications` | public       | Get notification list          |

---

## Reports (`/api/search`, `/api/analytics`, `/api/reports`, `/api/audit-log`)

| Method | Path             | Auth         | Description                          |
| ------ | ---------------- | ------------ | ------------------------------------ |
| GET    | `/api/search`    | requireStaff | Search customers, pets, appointments |
| GET    | `/api/analytics` | requireAdmin | Dashboard statistics                 |
| GET    | `/api/reports`   | requireAdmin | Reports with date range filter       |
| GET    | `/api/audit-log` | requireOwner | Audit log (paginated)                |

---

## Messaging (`/api/messages`)

| Method | Path                 | Auth         | Description            |
| ------ | -------------------- | ------------ | ---------------------- |
| GET    | `/api/messages`      | requireStaff | List sent messages     |
| POST   | `/api/messages/send` | requireStaff | Send email/SMS message |

---

## Health

| Method | Path          | Auth   | Description                                 |
| ------ | ------------- | ------ | ------------------------------------------- |
| GET    | `/api/health` | public | Health check with DB status, uptime, memory |

Response:

```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-03-11T10:00:00.000Z",
  "database": "ok",
  "memory": { "rss": 45, "heapUsed": 22 },
  "version": "0.0.0"
}
```
