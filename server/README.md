# Server Integration Notes

This backend is optional and non-breaking for the static site.

## Start
```bash
npm ci
npm run start
```

## Endpoints
- `GET /health`
- `GET /api/incidents`
- `GET /api/alerts`
- `POST /api/demo-intake`

### Demo Intake Payload
```json
{
  "fullName": "Jane Doe",
  "email": "jane@company.com",
  "company": "Company Ltd",
  "size": "26-100",
  "message": "We need endpoint and identity threat coverage"
}
```

`size` must be one of: `1-25`, `26-100`, `101-500`, `500+`.

## Frontend Integration Example
```js
await fetch('http://localhost:3001/api/demo-intake', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

## Security
- Helmet secure headers + CSP.
- Zod payload validation.
- Basic text sanitization for free-text fields.
