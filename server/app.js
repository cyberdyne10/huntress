const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const { demoIntakeSchema, slotSchema, bookingSchema, sanitizeText } = require('./validation');
const { incidents, alerts } = require('./mock-data');
const { db, initDb, nowIso } = require('./db');
const { createJwt, verifyJwt, revokeSession, sendBookingNotification } = require('./services');

initDb();
const app = express();

const defaultThreatFeed = [
  { id: 'TI-1', threat: 'Lumma Stealer campaign', severity: 'high', source: 'Hunt Lab', status: 'active', mitre_tags: 'T1059,T1204', published_at: '2026-02-10T13:00:00Z' },
  { id: 'TI-2', threat: 'MFA fatigue resurgence', severity: 'medium', source: 'SOC Intel', status: 'monitoring', mitre_tags: 'T1110,T1621', published_at: '2026-02-11T06:00:00Z' },
  { id: 'TI-3', threat: 'Exposed RDP honeypot surge', severity: 'high', source: 'Global Sensor Net', status: 'active', mitre_tags: 'T1133,T1021', published_at: '2026-02-11T04:20:00Z' },
];

for (const item of defaultThreatFeed) {
  db.prepare('INSERT OR IGNORE INTO threat_feed_items(id,threat,severity,source,status,mitre_tags,published_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(item.id, item.threat, item.severity, item.source, item.status, item.mitre_tags, item.published_at, nowIso());
}

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
let appVersion = '0.0.0';
try { appVersion = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version || appVersion; } catch (_error) {}

function resolveStaticRoot() {
  const candidates = [process.env.STATIC_SITE_DIR, path.resolve(process.cwd()), path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')].filter(Boolean);
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || path.resolve(__dirname, '..');
}

const STATIC_ROOT = resolveStaticRoot();
const RELEASE_TAG = process.env.RENDER_GIT_COMMIT || process.env.RELEASE || `v${appVersion}`;
const THREAT_GEO_FEED_URL = process.env.THREAT_GEO_FEED_URL || '';
const THREAT_GEO_CACHE_MS = Number(process.env.THREAT_GEO_CACHE_MS || 45000);

const threatGeoCache = {
  data: null,
  meta: null,
  expiresAt: 0,
};

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PATCH'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(STATIC_ROOT, { index: false, extensions: ['html'] }));

function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-access-token'];
  if (!token) return res.status(401).json({ error: 'Auth required' });
  try {
    req.user = verifyJwt(token);
    req.token = token;
    return next();
  } catch (_e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  return next();
}

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

async function postToCrm(payload, leadId = null) {
  const url = process.env.CRM_WEBHOOK_URL;
  const ts = nowIso();
  if (!url) {
    db.prepare('INSERT INTO crm_events(lead_id,direction,event_type,status,payload_json,created_at) VALUES(?,?,?,?,?,?)').run(leadId, 'outbound', payload.type, 'log-fallback', JSON.stringify(payload), ts);
    return { delivered: false, mode: 'log-fallback' };
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(process.env.CRM_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.CRM_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify(payload),
    });
    const ok = response.ok;
    db.prepare('INSERT INTO crm_events(lead_id,direction,event_type,status,payload_json,created_at) VALUES(?,?,?,?,?,?)').run(leadId, 'outbound', payload.type, ok ? 'delivered' : `http-${response.status}`, JSON.stringify(payload), ts);
    return { delivered: ok, mode: ok ? 'webhook' : 'log-fallback' };
  } catch (error) {
    db.prepare('INSERT INTO crm_events(lead_id,direction,event_type,status,payload_json,created_at) VALUES(?,?,?,?,?,?)').run(leadId, 'outbound', payload.type, `failed:${error.message}`, JSON.stringify(payload), ts);
    return { delivered: false, mode: 'log-fallback' };
  }
}

function randomThreatGeoEvents() {
  const hubs = [
    { key: 'lagos', label: 'Lagos SOC', lat: 6.5244, lon: 3.3792 },
    { key: 'london', label: 'London DC', lat: 51.5074, lon: -0.1278 },
    { key: 'frankfurt', label: 'Frankfurt IX', lat: 50.1109, lon: 8.6821 },
    { key: 'new-york', label: 'New York POP', lat: 40.7128, lon: -74.006 },
    { key: 'sao-paulo', label: 'São Paulo Edge', lat: -23.5505, lon: -46.6333 },
    { key: 'johannesburg', label: 'Johannesburg SOC', lat: -26.2041, lon: 28.0473 },
    { key: 'dubai', label: 'Dubai Core', lat: 25.2048, lon: 55.2708 },
    { key: 'singapore', label: 'Singapore IX', lat: 1.3521, lon: 103.8198 },
    { key: 'tokyo', label: 'Tokyo Sensor', lat: 35.6762, lon: 139.6503 },
    { key: 'sydney', label: 'Sydney Sensor', lat: -33.8688, lon: 151.2093 },
  ];

  const labels = ['Credential stuffing burst', 'Phishing beacon callback', 'Command-and-control check-in', 'Suspicious RDP probing', 'Lateral movement attempt', 'Privilege escalation pattern'];
  const severities = ['critical', 'high', 'high', 'medium', 'medium', 'low'];
  const total = 16;
  return Array.from({ length: total }).map((_, idx) => {
    const origin = hubs[Math.floor(Math.random() * hubs.length)];
    let target = hubs[Math.floor(Math.random() * hubs.length)];
    while (target.key === origin.key) target = hubs[Math.floor(Math.random() * hubs.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const label = labels[Math.floor(Math.random() * labels.length)];
    return {
      id: `GEO-${Date.now()}-${idx}`,
      label,
      severity,
      feed: 'mock',
      observedAt: nowIso(),
      origin: { label: origin.label, lat: origin.lat, lon: origin.lon },
      target: { label: target.label, lat: target.lat, lon: target.lon },
    };
  });
}

function normalizeGeoEvent(item, index = 0) {
  if (!item || !item.origin || !item.target) return null;
  const severity = ['critical', 'high', 'medium', 'low'].includes(item.severity) ? item.severity : 'medium';
  return {
    id: String(item.id || `GEO-LIVE-${Date.now()}-${index}`),
    label: String(item.label || item.title || 'Threat flow observed'),
    severity,
    feed: String(item.feed || 'live'),
    observedAt: item.observedAt || nowIso(),
    origin: {
      label: String(item.origin.label || 'Unknown source'),
      lat: Number(item.origin.lat),
      lon: Number(item.origin.lon),
    },
    target: {
      label: String(item.target.label || 'Unknown target'),
      lat: Number(item.target.lat),
      lon: Number(item.target.lon),
    },
  };
}

async function getThreatGeoEvents() {
  const now = Date.now();
  if (threatGeoCache.data && threatGeoCache.expiresAt > now) {
    return { data: threatGeoCache.data, meta: threatGeoCache.meta };
  }

  let data = [];
  let source = 'mock';

  if (THREAT_GEO_FEED_URL) {
    try {
      const response = await fetch(THREAT_GEO_FEED_URL, { headers: { accept: 'application/json' } });
      if (response.ok) {
        const payload = await response.json();
        const input = Array.isArray(payload) ? payload : (payload.events || []);
        data = input.map((event, index) => normalizeGeoEvent(event, index)).filter(Boolean);
        if (data.length > 0) source = payload.source || 'live-feed';
      }
    } catch (_error) {
      source = 'mock-fallback';
    }
  }

  if (data.length === 0) {
    data = randomThreatGeoEvents();
    source = THREAT_GEO_FEED_URL ? 'mock-fallback' : 'mock';
  }

  const meta = {
    source,
    refreshMs: THREAT_GEO_CACHE_MS,
    lastUpdated: nowIso(),
    count: data.length,
  };
  threatGeoCache.data = data;
  threatGeoCache.meta = meta;
  threatGeoCache.expiresAt = Date.now() + THREAT_GEO_CACHE_MS;

  return { data, meta };
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'huntress-api', version: appVersion, release: RELEASE_TAG, nodeEnv: process.env.NODE_ENV || 'development', uptimeSec: Number(process.uptime().toFixed(1)) });
});

app.post('/api/auth/register', authRequired, adminRequired, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const fullName = sanitizeText(req.body?.fullName || 'Client User');
  const role = req.body?.role === 'admin' ? 'admin' : 'client';
  if (!email || !password || password.length < 8) return res.status(400).json({ error: 'Invalid payload' });
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (exists) return res.status(409).json({ error: 'User already exists' });
  db.prepare('INSERT INTO users(email,password_hash,full_name,role,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run(email, bcrypt.hashSync(password, 12), fullName, role, nowIso(), nowIso());
  return res.status(201).json({ message: 'User created' });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email=? AND is_active=1').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = createJwt(user);
  return res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  const jti = req.user.jti;
  revokeSession(jti);
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id,email,full_name,role,created_at FROM users WHERE id=?').get(Number(req.user.sub));
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ data: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, createdAt: user.created_at } });
});

app.get('/api/demo-slots', (_req, res) => {
  const data = db.prepare('SELECT * FROM demo_slots ORDER BY date,time').all().map((s) => ({ ...s, available: Math.max(0, s.capacity - s.booked) }));
  res.json({ data, count: data.length });
});

app.post('/api/demo-slots', authRequired, adminRequired, (req, res) => {
  const result = slotSchema.safeParse(req.body || {});
  if (!result.success) return res.status(400).json({ error: 'Validation failed', details: result.error.issues });
  const count = db.prepare('SELECT COUNT(1) AS c FROM demo_slots').get().c;
  const slot = { id: `SLOT-${String(count + 1).padStart(3, '0')}`, date: result.data.date, time: result.data.time, timezone: sanitizeText(result.data.timezone), capacity: result.data.capacity, booked: 0, created_at: nowIso() };
  db.prepare('INSERT INTO demo_slots(id,date,time,timezone,capacity,booked,created_at) VALUES(?,?,?,?,?,?,?)').run(slot.id, slot.date, slot.time, slot.timezone, slot.capacity, slot.booked, slot.created_at);
  return res.status(201).json({ message: 'Slot created', data: slot });
});

app.get('/api/demo-bookings', authRequired, adminRequired, (_req, res) => {
  const data = db.prepare('SELECT * FROM demo_bookings ORDER BY created_at DESC').all();
  res.json({ data, count: data.length });
});

app.post('/api/demo-bookings', async (req, res) => {
  const result = bookingSchema.safeParse(req.body || {});
  if (!result.success) return res.status(400).json({ error: 'Validation failed', details: result.error.issues });
  const slot = db.prepare('SELECT * FROM demo_slots WHERE id=?').get(result.data.slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });
  if (slot.booked >= slot.capacity) return res.status(409).json({ error: 'Slot is fully booked' });

  const lead = scoreLead({ size: '26-100', message: result.data.notes, source: 'demo-booking' });
  const ts = nowIso();
  const leadRef = `LEAD-${Date.now()}`;
  const leadRow = db.prepare('INSERT INTO leads(lead_ref,type,full_name,email,company,size,message,score,band,status,source,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(leadRef, 'demo-booking', sanitizeText(result.data.fullName), result.data.email.trim().toLowerCase(), sanitizeText(result.data.company), '26-100', sanitizeText(result.data.notes), lead.score, lead.band, 'new', 'demo-booking', JSON.stringify(result.data), ts, ts);
  const bookingCount = db.prepare('SELECT COUNT(1) AS c FROM demo_bookings').get().c;
  const booking = {
    id: `BOOK-${String(bookingCount + 1).padStart(3, '0')}`,
    slotId: slot.id,
    fullName: sanitizeText(result.data.fullName),
    email: result.data.email.trim().toLowerCase(),
    company: sanitizeText(result.data.company),
    attendees: result.data.attendees,
    notes: sanitizeText(result.data.notes),
    createdAt: ts,
    lead,
  };
  db.prepare('UPDATE demo_slots SET booked = booked + 1 WHERE id=?').run(slot.id);
  db.prepare('INSERT INTO demo_bookings(id,slot_id,lead_id,full_name,email,company,attendees,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(booking.id, slot.id, leadRow.lastInsertRowid, booking.fullName, booking.email, booking.company, booking.attendees, booking.notes, ts);

  const confirmation = await sendBookingNotification(booking, 'confirmation');
  const reminder = await sendBookingNotification(booking, 'reminder');
  const crm = await postToCrm({ type: 'demo-booking', booking }, leadRow.lastInsertRowid);

  return res.status(201).json({ message: 'Booking confirmed', data: booking, integrations: { notifications: { confirmation, reminder }, crm } });
});

app.post('/api/demo-intake', async (req, res) => {
  const result = demoIntakeSchema.safeParse(req.body || {});
  if (!result.success) return res.status(400).json({ error: 'Validation failed', details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  const payload = { fullName: sanitizeText(result.data.fullName), email: result.data.email.trim().toLowerCase(), company: sanitizeText(result.data.company), message: sanitizeText(result.data.message), size: result.data.size, createdAt: nowIso() };
  const lead = scoreLead({ size: payload.size, message: payload.message, source: 'demo-intake' });
  const leadRef = `LEAD-${Date.now()}`;
  const row = db.prepare('INSERT INTO leads(lead_ref,type,full_name,email,company,size,message,score,band,status,source,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(leadRef, 'demo-intake', payload.fullName, payload.email, payload.company, payload.size, payload.message, lead.score, lead.band, 'new', 'demo-intake', JSON.stringify(payload), payload.createdAt, payload.createdAt);
  const crm = await postToCrm({ type: 'demo-intake', payload, lead }, row.lastInsertRowid);
  return res.status(201).json({ message: 'Demo request received', data: payload, lead, integrations: { crm } });
});

app.post('/api/crm/webhook/status', (req, res) => {
  const token = req.headers['x-webhook-token'];
  if (!token || token !== process.env.CRM_INBOUND_TOKEN) return res.status(401).json({ error: 'Unauthorized webhook' });
  const leadRef = String(req.body?.leadRef || '');
  const status = String(req.body?.status || '');
  const lead = db.prepare('SELECT id FROM leads WHERE lead_ref=?').get(leadRef);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  db.prepare('UPDATE leads SET status=?,updated_at=? WHERE id=?').run(status, nowIso(), lead.id);
  db.prepare('INSERT INTO crm_events(lead_id,direction,event_type,status,payload_json,created_at) VALUES(?,?,?,?,?,?)')
    .run(lead.id, 'inbound', 'status-update', 'accepted', JSON.stringify(req.body || {}), nowIso());
  return res.json({ message: 'Lead status updated' });
});

app.get('/api/status', (_req, res) => {
  const latest = db.prepare('SELECT component,status,message,created_at FROM status_snapshots ORDER BY created_at DESC LIMIT 10').all();
  const incidentsData = db.prepare('SELECT incident_ref,title,status,severity,started_at,resolved_at,summary FROM status_incidents ORDER BY started_at DESC LIMIT 20').all();
  const current = latest[0] || { component: 'platform', status: 'operational', message: 'All systems normal' };
  res.json({ current, history: latest, incidents: incidentsData });
});

app.get('/api/incidents', (_req, res) => res.json({ data: incidents, count: incidents.length }));
app.get('/api/alerts', (_req, res) => res.json({ data: alerts, count: alerts.length }));

app.get('/api/soc-preview', (req, res) => {
  const severity = req.query.severity;
  const source = req.query.source;
  const status = req.query.status;
  const mitre = req.query.mitre;
  let threatItems = db.prepare('SELECT * FROM threat_feed_items ORDER BY published_at DESC LIMIT 50').all();
  if (severity) threatItems = threatItems.filter((i) => i.severity === severity);
  if (source) threatItems = threatItems.filter((i) => i.source.toLowerCase().includes(String(source).toLowerCase()));
  if (status) threatItems = threatItems.filter((i) => i.status === status);
  if (mitre) threatItems = threatItems.filter((i) => (i.mitre_tags || '').includes(String(mitre)));
  const timeline = threatItems.map((i, idx) => ({ t: i.published_at, value: threatItems.length - idx, label: i.threat }));
  res.json({
    data: {
      incidents,
      alerts,
      threats: threatItems,
      kpis: { mttrMinutes: 19, openIncidents: incidents.filter((item) => item.status !== 'contained').length, activeAnalysts: 7 },
      chart: [12, 18, 15, 23, 19, 10, 14],
      timeline,
      presets: [
        { key: 'critical-only', severity: 'critical' },
        { key: 'identity-attacks', mitre: 'T1110' },
        { key: 'active-rdp', source: 'RDP' },
      ],
    },
  });
});

app.get('/api/threat-feed', (_req, res) => {
  const data = db.prepare('SELECT id,threat,severity,source,status,mitre_tags AS mitreTags,published_at AS publishedAt FROM threat_feed_items ORDER BY published_at DESC LIMIT 20').all();
  res.json({ source: 'db', data, count: data.length });
});

app.get('/api/threat-geo-events', async (_req, res) => {
  const payload = await getThreatGeoEvents();
  res.json(payload);
});

app.get('/api/admin/overview', authRequired, adminRequired, (_req, res) => {
  const slots = db.prepare('SELECT COUNT(1) AS c FROM demo_slots').get().c;
  const bookings = db.prepare('SELECT COUNT(1) AS c FROM demo_bookings').get().c;
  const leads = db.prepare('SELECT COUNT(1) AS c FROM leads').get().c;
  const incidentsCount = db.prepare('SELECT COUNT(1) AS c FROM status_incidents').get().c;
  const threatSources = db.prepare('SELECT source,COUNT(1) AS count FROM threat_feed_items GROUP BY source').all();
  res.json({ data: { slots, bookings, leads, incidents: incidentsCount, threatSources } });
});

app.get('/status.html', (_req, res) => res.sendFile(path.join(STATIC_ROOT, 'status.html')));
app.get('/admin.html', (_req, res) => res.sendFile(path.join(STATIC_ROOT, 'admin.html')));

app.get('/', (_req, res) => res.sendFile(path.join(STATIC_ROOT, 'index.html')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
app.get('*', (req, res, next) => {
  if (req.path === '/health') return next();
  if (path.extname(req.path) !== '') return res.status(404).send('Not found');
  return res.sendFile(path.join(STATIC_ROOT, 'index.html'));
});

module.exports = app;
