# OPERATIONS.md

## Bootstrapping

1. `npm ci`
2. Copy `.env.example` to `.env`
3. Set production secrets (`JWT_SECRET`, `CRM_INBOUND_TOKEN`)
4. `npm run db:init`
5. `npm start`

## Key environment variables

- `PORT` (default 3001)
- `DATABASE_URL` (default `./data/huntress.sqlite`)
- `JWT_SECRET`, `JWT_EXPIRY`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
- `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_TOKEN`, `CRM_INBOUND_TOKEN`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## Notifications

Booking notifications attempt SMTP delivery.
If SMTP is not configured/fails, entries are recorded in `notification_logs` with status.

## CRM sync

Outbound events are recorded in `crm_events`.
Inbound updates hit `POST /api/crm/webhook/status` with header:

- `x-webhook-token: <CRM_INBOUND_TOKEN>`

Payload example:

```json
{ "leadRef": "LEAD-1739262000000", "status": "qualified" }
```

## Status page model

- `status_snapshots`: current component status snapshots
- `status_incidents`: incident history for public feed

## Backup and restore (SQLite)

- Backup: copy `data/huntress.sqlite` while service stopped, or use SQLite backup tooling
- Restore: replace DB file and restart service

## Smoke checks

- `GET /health`
- Portal login with seeded admin
- Book demo and verify `notification_logs` and `demo_bookings`
- Inbound CRM webhook status update for known `lead_ref`
