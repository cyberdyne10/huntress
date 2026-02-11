const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { demoIntakeSchema, sanitizeText } = require('./validation');
const { incidents, alerts } = require('./mock-data');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https://cyberlogicnetwork.com'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'huntress-api' });
});

app.get('/api/incidents', (_req, res) => {
  res.json({ data: incidents, count: incidents.length });
});

app.get('/api/alerts', (_req, res) => {
  res.json({ data: alerts, count: alerts.length });
});

app.post('/api/demo-intake', (req, res) => {
  const result = demoIntakeSchema.safeParse(req.body || {});

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const payload = {
    fullName: sanitizeText(result.data.fullName),
    email: result.data.email.trim().toLowerCase(),
    company: sanitizeText(result.data.company),
    message: sanitizeText(result.data.message),
    size: result.data.size,
    createdAt: new Date().toISOString(),
  };

  return res.status(201).json({
    message: 'Demo request received',
    data: payload,
  });
});

module.exports = app;
