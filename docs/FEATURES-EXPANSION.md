# Features Expansion (MVP)

## Delivered Additions

1. **Live demo booking system**
   - Frontend booking UI on `demo.html` with slot picker.
   - API endpoints: `GET/POST /api/demo-slots`, `GET/POST /api/demo-bookings`.
   - Confirmation and reminder simulation hooks with log fallback + webhook-ready mode.

2. **Interactive SOC dashboard preview**
   - Public page: `soc-preview.html`.
   - Mock KPI cards, trend chart bars, and severity filters.
   - API endpoint: `GET /api/soc-preview`.

3. **Threat intel feed widget**
   - Widget rendered on homepage (`index.html`).
   - API endpoint: `GET /api/threat-feed` with curated mock feed.
   - Optional live fetch via `THREAT_FEED_URL` and cache with safe fallback.

4. **Pricing calculator**
   - Updated `pricing.html` with configurable estimator by endpoints/users/services.

5. **Industry landing pages**
   - Tailored pages: `solutions/finance.html`, `solutions/healthcare.html`, `solutions/education.html`, `solutions/smb.html`.

6. **Case studies module**
   - `about/case-studies.html` upgraded with search/filter and detail content blocks.

7. **Resource center upgrade**
   - New searchable listing page: `resources/resource-center.html`.
   - Includes optional gated download form section.

8. **Client portal login entry**
   - New page: `portal.html` (MVP placeholder auth).
   - Added portal CTA in navigation.

9. **Security trust center**
   - New page: `trust-center.html` with compliance/uptime/incident response sections.
   - Linked globally via header/footer.

10. **Lead scoring + CRM integration**
    - Lead scoring added to `POST /api/demo-intake` and booking submissions.
    - CRM webhook integration via `CRM_WEBHOOK_URL` and `CRM_WEBHOOK_TOKEN`.
    - Graceful fallback logging if webhook unavailable.

## Environment Variables

- `PORT` (default `3001`)
- `CORS_ORIGIN`
- `CRM_WEBHOOK_URL`
- `CRM_WEBHOOK_TOKEN`
- `THREAT_FEED_URL`
- `THREAT_FEED_CACHE_MS`
- `DEMO_WEBHOOK_URL` (notification mode switch)

## Notes

- Static-site-first architecture is preserved.
- Backend additions are optional and degrade gracefully when API is offline.
- Data storage is in-memory (MVP only).
