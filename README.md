# Huntress Marketing Site + API

Static-first cybersecurity website with an Express API, real auth, durable SQLite storage, SOC demo data, CRM sync hooks, and admin/status modules.

## What changed (feature suite)

- Real portal authentication with JWT sessions, hashed passwords, role-aware access (`client`/`admin`)
- Durable DB persistence (SQLite via Node `node:sqlite`) for slots, bookings, leads, sessions, notifications, threat feed items, status incidents
- SMTP notification service for booking confirmations/reminders with graceful DB log fallback
- CRM two-way integration: outbound webhook + secured inbound status update webhook
- Public status module (`status.html`, `GET /api/status`) with current state + incident history
- SOC preview upgrade with richer filters (severity/source/status/MITRE), timeline, presets payload
- SEO upgrades: meta/OG tags, canonical, Organization structured data, sitemap, robots
- Admin console (`admin.html`) with secure admin-only overview endpoint

## Run locally

```bash
npm ci
npm run db:init
npm start
```

Base URL: `http://localhost:3001`

## Core API endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout` (auth)
- `GET /api/auth/me` (auth)
- `POST /api/auth/register` (admin)

### Existing + persisted
- `GET /api/demo-slots`
- `POST /api/demo-slots` (admin)
- `GET /api/demo-bookings` (admin)
- `POST /api/demo-bookings`
- `POST /api/demo-intake`
- `GET /api/threat-feed`
- `GET /api/threat-geo-events`
- `GET /api/soc-preview`

### New platform endpoints
- `POST /api/crm/webhook/status` (secured by `x-webhook-token`)
- `GET /api/status`
- `GET /api/admin/overview` (admin)

## Environment variables

See `.env.example` and `docs/AUTH.md` / `docs/OPERATIONS.md`.

Required for production hardening:
- `JWT_SECRET`
- `CRM_INBOUND_TOKEN`
- `DATABASE_URL` (optional; defaults to `./data/huntress.sqlite`)

Optional integrations:
- `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_TOKEN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `THREAT_GEO_FEED_URL` (optional JSON feed for live geo-threat events)
- `THREAT_GEO_CACHE_MS` (cache/refresh cadence for geo-threat map, default `45000`)

## Live threat map feed (SOC preview)

`/soc-preview.html` now includes a lightweight live threat map with animated origin→target flows and severity controls.

Backend endpoint:
- `GET /api/threat-geo-events`

Feed shape supported when using `THREAT_GEO_FEED_URL`:

```json
{
  "source": "provider-name",
  "events": [
    {
      "id": "evt-1",
      "label": "Credential stuffing burst",
      "severity": "high",
      "origin": { "label": "London", "lat": 51.5, "lon": -0.12 },
      "target": { "label": "Lagos", "lat": 6.52, "lon": 3.37 }
    }
  ]
}
```

If live feed retrieval fails or returns no usable events, the API gracefully falls back to realistic rotating mock telemetry.

## Migrations / DB init

- SQL migrations live in `server/migrations/`
- Bootstrap command: `npm run db:init`
- Seed behavior:
  - default demo slots inserted if empty
  - default admin seeded if users table empty (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`)

## Tests & checks

```bash
npm run lint
npm run test:smoke
```

## Docs

- `docs/AUTH.md` — authentication and authorization model
- `docs/OPERATIONS.md` — runbook, envs, backups, webhook/security ops
