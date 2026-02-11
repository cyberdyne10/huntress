# Huntress Marketing Site + API Bootstrap

A static-first cybersecurity website (multi-page HTML/CSS/JS) with an **optional Express backend scaffold** for demo intake and mock security telemetry.

## Overview
- Static frontend pages for platform, solutions, about, resources, pricing, and demo entrypoint.
- Shared UI composition via `js/components.js` (header/footer injection and nav behavior).
- Optional backend in `server/` for:
  - `POST /api/demo-intake` (validated/sanitized intake)
  - `GET /api/incidents` (mock incident feed)
  - `GET /api/alerts` (mock alert feed)
  - `GET /health`
- Security baseline with CSP and secure headers guidance for static + backend mode.

## Project Structure

```text
.
├─ about/                  # about/company pages
├─ css/
│  ├─ style.css            # shared global styles
│  ├─ home.css             # homepage-specific styles
│  └─ demo.css             # demo page-specific styles
├─ js/
│  ├─ components.js        # shared header/footer + nav logic
│  ├─ slider.js            # testimonial slider behavior
│  └─ rotator.js           # hero word rotator
├─ platform/               # platform pages
├─ resources/              # resources pages
├─ solutions/              # solutions pages
├─ server/                 # optional express api scaffold
├─ tests/                  # playwright smoke tests via pytest
└─ .github/workflows/      # CI + dependency scanning
```

## Local Run

### Frontend (static)
Use any static file server (VS Code Live Server, Python, etc.) from repo root.

```bash
# Python option
python -m http.server 5500
```

Then open `http://localhost:5500`.

### Optional Backend API
```bash
npm ci
npm run start
```
API base: `http://localhost:3001` (configurable by `.env`).

## Testing and Quality Checks

```bash
npm run lint        # htmlhint + stylelint + eslint
npm run test:smoke  # pytest playwright smoke tests
```

If Playwright browsers are missing locally:

```bash
python -m playwright install chromium
```

## Environment Configuration
Copy `.env.example` to `.env` when using backend mode:

```bash
cp .env.example .env
```

Key values:
- `PORT`: backend port (default `3001`)
- `CORS_ORIGIN`: allowed frontend origin for API calls
- future hook placeholders: `DEMO_WEBHOOK_URL`, `DEMO_WEBHOOK_TOKEN`

## Security Notes
- Static pages include a baseline CSP and security-related meta headers.
- Backend uses Helmet with CSP and secure defaults.
- Demo intake payload is schema-validated (`zod`) and text-sanitized before response.

See integration notes in `server/README.md`.

## Deployment Notes
- **Static-only deployment:** host HTML/CSS/JS on Netlify/Vercel/GitHub Pages/S3+CloudFront.
- **Static + API deployment:** deploy static assets and Express service separately (or behind a reverse proxy), then point frontend requests to API base URL.
- In production, tighten CORS and CSP directives to exact trusted origins.
