# Huntress Marketing Site + API Bootstrap

Static-first cybersecurity website with optional Express backend for interactive modules.

## New MVP Feature Expansion

- Live demo booking flow (`demo.html`) with API-managed slots/bookings
- Interactive SOC preview (`soc-preview.html`)
- Threat intel feed widget on homepage (`/api/threat-feed`)
- Pricing calculator (`pricing.html`)
- Industry landing pages (finance/healthcare/education/SMB)
- Filterable case studies module (`about/case-studies.html`)
- Searchable resource center (`resources/resource-center.html`)
- Client portal entry (`portal.html`)
- Security trust center (`trust-center.html`)
- Lead scoring + CRM webhook integration on demo/booking submissions

See full details in `docs/FEATURES-EXPANSION.md`.

## Backend API (optional)

Run:

```bash
npm ci
npm run start
```

Base URL: `http://localhost:3001`

### Endpoints

- `GET /health`
- `GET /api/incidents`
- `GET /api/alerts`
- `GET /api/soc-preview`
- `GET /api/threat-feed`
- `GET /api/demo-slots`
- `POST /api/demo-slots`
- `GET /api/demo-bookings`
- `POST /api/demo-bookings`
- `POST /api/demo-intake`

## Environment Variables

Copy `.env.example` to `.env`.

- `PORT=3001`
- `CORS_ORIGIN=*`
- `CRM_WEBHOOK_URL=`
- `CRM_WEBHOOK_TOKEN=`
- `THREAT_FEED_URL=`
- `THREAT_FEED_CACHE_MS=300000`
- `DEMO_WEBHOOK_URL=`

## Quality checks

```bash
npm run lint
npm run test:smoke
```

## Limitations (MVP)

- Booking, slots, and feed cache are in-memory only (no database persistence).
- Portal login is placeholder UI only (no real auth/SSO yet).
- Threat feed live source expects JSON list; mapper is intentionally generic.
