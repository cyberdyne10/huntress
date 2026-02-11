const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const {
  demoIntakeSchema,
  slotSchema,
  bookingSchema,
  sanitizeText,
} = require('./validation');
const { incidents, alerts } = require('./mock-data');

const app = express();

const demoSlots = [
  { id: 'SLOT-001', date: '2026-02-15', time: '10:00', timezone: 'Africa/Lagos', capacity: 3, booked: 1 },
  { id: 'SLOT-002', date: '2026-02-15', time: '14:00', timezone: 'Africa/Lagos', capacity: 2, booked: 0 },
  { id: 'SLOT-003', date: '2026-02-16', time: '11:30', timezone: 'Africa/Lagos', capacity: 4, booked: 2 },
];
const demoBookings = [];
let threatCache = { fetchedAt: 0, data: [] };

const defaultThreatFeed = [
  { id: 'TI-1', threat: 'Lumma Stealer campaign', severity: 'high', source: 'Hunt Lab', publishedAt: '2026-02-10T13:00:00Z' },
  { id: 'TI-2', threat: 'MFA fatigue resurgence', severity: 'medium', source: 'SOC Intel', publishedAt: '2026-02-11T06:00:00Z' },
  { id: 'TI-3', threat: 'Exposed RDP honeypot surge', severity: 'high', source: 'Global Sensor Net', publishedAt: '2026-02-11T04:20:00Z' },
];

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

const STATIC_ROOT = path.resolve(__dirname, '..');
app.use(express.static(STATIC_ROOT));

function scoreLead({ size, message = '', source = 'web' }) {
  let score = 10;
  if (size === '500+') score += 30;
  if (size === '101-500') score += 20;
  if (size === '26-100') score += 10;
  const text = message.toLowerCase();
  if (text.includes('urgent') || text.includes('breach')) score += 20;
  if (text.includes('compliance') || text.includes('soc')) score += 10;
  if (source === 'demo-booking') score += 15;

  const band = score >= 50 ? 'hot' : score >= 30 ? 'warm' : 'cold';
  return { score, band };
}

async function postToCrm(payload) {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) {
    console.log('[crm-fallback] no CRM_WEBHOOK_URL configured', payload.email);
    return { delivered: false, mode: 'log-fallback' };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.CRM_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.CRM_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.log('[crm-fallback] webhook non-2xx', response.status);
      return { delivered: false, mode: 'log-fallback' };
    }

    return { delivered: true, mode: 'webhook' };
  } catch (error) {
    console.log('[crm-fallback] webhook error', error.message);
    return { delivered: false, mode: 'log-fallback' };
  }
}

function simulateNotificationHooks(booking) {
  const reminderTime = new Date(Date.now() + 45 * 60 * 1000).toISOString();
  console.log('[booking-confirmation]', booking.email, booking.slotId);
  console.log('[booking-reminder-scheduled]', booking.email, reminderTime);
  return {
    confirmation: 'queued',
    reminder: 'queued',
    reminderAt: reminderTime,
    deliveryMode: process.env.DEMO_WEBHOOK_URL ? 'webhook-ready' : 'log-fallback',
  };
}

async function loadThreatFeed() {
  const maxAgeMs = Number(process.env.THREAT_FEED_CACHE_MS || 5 * 60 * 1000);
  if (Date.now() - threatCache.fetchedAt < maxAgeMs && threatCache.data.length) {
    return { source: 'cache', data: threatCache.data };
  }

  const liveUrl = process.env.THREAT_FEED_URL;
  if (!liveUrl) {
    threatCache = { fetchedAt: Date.now(), data: defaultThreatFeed };
    return { source: 'mock', data: defaultThreatFeed };
  }

  try {
    const response = await fetch(liveUrl, { method: 'GET' });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const payload = await response.json();
    const list = Array.isArray(payload) ? payload.slice(0, 12) : (payload.items || defaultThreatFeed);
    threatCache = { fetchedAt: Date.now(), data: list };
    return { source: 'live', data: list };
  } catch (error) {
    console.log('[threat-feed-fallback]', error.message);
    threatCache = { fetchedAt: Date.now(), data: defaultThreatFeed };
    return { source: 'mock-fallback', data: defaultThreatFeed };
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'huntress-api' });
});

app.get('/api/incidents', (_req, res) => {
  res.json({ data: incidents, count: incidents.length });
});

app.get('/api/alerts', (_req, res) => {
  res.json({ data: alerts, count: alerts.length });
});

app.get('/api/soc-preview', (_req, res) => {
  res.json({
    data: {
      incidents,
      alerts,
      kpis: {
        mttrMinutes: 19,
        openIncidents: incidents.filter((item) => item.status !== 'contained').length,
        activeAnalysts: 7,
      },
      chart: [12, 18, 15, 23, 19, 10, 14],
    },
  });
});

app.get('/api/threat-feed', async (_req, res) => {
  const feed = await loadThreatFeed();
  res.json({ ...feed, count: feed.data.length });
});

app.get('/api/demo-slots', (_req, res) => {
  const data = demoSlots.map((slot) => ({ ...slot, available: Math.max(0, slot.capacity - slot.booked) }));
  res.json({ data, count: data.length });
});

app.post('/api/demo-slots', (req, res) => {
  const result = slotSchema.safeParse(req.body || {});
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.issues });
  }

  const slot = {
    id: `SLOT-${String(demoSlots.length + 1).padStart(3, '0')}`,
    date: result.data.date,
    time: result.data.time,
    timezone: sanitizeText(result.data.timezone),
    capacity: result.data.capacity,
    booked: 0,
  };
  demoSlots.push(slot);
  return res.status(201).json({ message: 'Slot created', data: slot });
});

app.get('/api/demo-bookings', (_req, res) => {
  res.json({ data: demoBookings, count: demoBookings.length });
});

app.post('/api/demo-bookings', async (req, res) => {
  const result = bookingSchema.safeParse(req.body || {});
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.issues });
  }

  const slot = demoSlots.find((item) => item.id === result.data.slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });
  if (slot.booked >= slot.capacity) return res.status(409).json({ error: 'Slot is fully booked' });

  slot.booked += 1;
  const lead = scoreLead({ size: '26-100', message: result.data.notes, source: 'demo-booking' });

  const booking = {
    id: `BOOK-${String(demoBookings.length + 1).padStart(3, '0')}`,
    slotId: slot.id,
    fullName: sanitizeText(result.data.fullName),
    email: result.data.email.trim().toLowerCase(),
    company: sanitizeText(result.data.company),
    attendees: result.data.attendees,
    notes: sanitizeText(result.data.notes),
    createdAt: new Date().toISOString(),
    lead,
  };
  demoBookings.push(booking);

  const notifications = simulateNotificationHooks(booking);
  const crm = await postToCrm({ type: 'demo-booking', booking });

  return res.status(201).json({
    message: 'Booking confirmed',
    data: booking,
    integrations: { notifications, crm },
  });
});

app.post('/api/demo-intake', async (req, res) => {
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

  const lead = scoreLead({ size: payload.size, message: payload.message, source: 'demo-intake' });
  const crm = await postToCrm({ type: 'demo-intake', payload, lead });

  return res.status(201).json({
    message: 'Demo request received',
    data: payload,
    lead,
    integrations: { crm },
  });
});

app.get('/', (_req, res) => {
  return res.sendFile(path.join(STATIC_ROOT, 'index.html'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  return res.sendFile(path.join(STATIC_ROOT, 'index.html'));
});

module.exports = app;
