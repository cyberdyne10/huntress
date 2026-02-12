# MISP Integration (MVP)

This project supports a practical MISP integration for SOC threat map + threat feed enrichment.

## Required environment variables

```bash
MISP_BASE_URL=https://misp.example.com
MISP_API_KEY=<automation-api-key>
```

## Optional environment variables

```bash
MISP_VERIFY_TLS=true          # default true
MISP_TIMEOUT_MS=8000          # request timeout
MISP_LOOKBACK_HOURS=24        # search window
```

## Minimum MISP-side setup

1. Create an automation user in MISP.
2. Generate an API key for that user.
3. Ensure the user can run:
   - `POST /events/restSearch`
   - `POST /attributes/restSearch`
4. Ensure recent events are published (for best visibility in this MVP).

## Endpoints using MISP

- `GET /api/threat-geo-events`
  - Prefers MISP-derived geo events.
  - Falls back to external geo feed (if configured), then mock data.

- `GET /api/threat-feed`
  - Merges MISP-derived threat items with local DB items.
  - Preserves existing response shape.

- `GET /api/admin/integrations/misp/status` (admin only)
  - Shows configured/connected state, last sync, item counts, and non-sensitive errors.

## Quick test steps

1. Start app with MISP env vars set.
2. Call `GET /api/threat-feed` and verify items with `source: "MISP"` are present.
3. Call `GET /api/threat-geo-events` and verify `meta.source` is `misp` when data is available.
4. Authenticate as admin and call `GET /api/admin/integrations/misp/status`.
5. Stop/revoke MISP access and verify endpoints gracefully fallback to mock/DB data.

## Notes / limitations (MVP)

- Geo coordinates may be synthesized if MISP events do not contain native latitude/longitude attributes.
- Current implementation is read-only and does not write back to MISP.
- Designed for resilience and frontend compatibility over deep MISP schema modeling.
