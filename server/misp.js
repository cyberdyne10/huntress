const { nowIso } = require('./db');

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_LOOKBACK_HOURS = 24;

const mispState = {
  configured: false,
  connected: false,
  baseUrl: null,
  verifyTls: true,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  lookbackHours: DEFAULT_LOOKBACK_HOURS,
  lastSync: null,
  lastError: null,
  counts: {
    feedItems: 0,
    geoEvents: 0,
    rawEvents: 0,
    rawAttributes: 0,
  },
};

function parseBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() !== 'false';
}

function getConfig() {
  const baseUrl = String(process.env.MISP_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = String(process.env.MISP_API_KEY || '').trim();
  const timeoutMs = Number(process.env.MISP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const lookbackHours = Number(process.env.MISP_LOOKBACK_HOURS || DEFAULT_LOOKBACK_HOURS);
  const verifyTls = parseBool(process.env.MISP_VERIFY_TLS, true);

  return {
    configured: Boolean(baseUrl && apiKey),
    baseUrl,
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    lookbackHours: Number.isFinite(lookbackHours) && lookbackHours > 0 ? lookbackHours : DEFAULT_LOOKBACK_HOURS,
    verifyTls,
  };
}

function severityFromThreatLevel(level) {
  const map = { '1': 'critical', '2': 'high', '3': 'medium', '4': 'low' };
  return map[String(level || '3')] || 'medium';
}

function hashToCoord(seed, max, offset = 0) {
  const text = String(seed || 'seed');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash % 10000) / 10000;
  return (normalized * (max * 2)) - max + offset;
}

function extractMitre(tags = []) {
  const values = tags
    .map((tag) => (typeof tag === 'string' ? tag : tag?.name))
    .filter(Boolean)
    .map((tag) => tag.match(/T\d{4}(?:\.\d{3})?/i)?.[0]?.toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeEvent(raw) {
  if (!raw) return null;
  return raw.Event || raw;
}

function normalizeAttribute(raw) {
  if (!raw) return null;
  return raw.Attribute || raw;
}

async function mispRequest(endpoint, payload, cfg) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: cfg.apiKey,
  };

  const options = {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {}),
    signal: controller.signal,
  };

  if (cfg.verifyTls === false && process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  try {
    const response = await fetch(`${cfg.baseUrl}${endpoint}`, options);
    if (!response.ok) {
      const snippet = await response.text().catch(() => '');
      throw new Error(`MISP HTTP ${response.status}${snippet ? `: ${snippet.slice(0, 120)}` : ''}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildSearchPayload(cfg) {
  const now = Date.now();
  const from = new Date(now - (cfg.lookbackHours * 60 * 60 * 1000)).toISOString();
  return {
    returnFormat: 'json',
    limit: 100,
    page: 1,
    timestamp: from,
    published: true,
  };
}

function normalizeThreatFeed(events = []) {
  return events.map((event) => {
    const tags = asArray(event.Tag);
    const mitreTags = extractMitre(tags).join(',');
    return {
      id: `MISP-${event.uuid || event.id}`,
      threat: String(event.info || 'MISP Event'),
      severity: severityFromThreatLevel(event.threat_level_id),
      source: 'MISP',
      status: 'active',
      mitreTags,
      publishedAt: event.publish_timestamp ? new Date(Number(event.publish_timestamp) * 1000).toISOString() : (event.date ? new Date(event.date).toISOString() : nowIso()),
    };
  });
}

function normalizeGeoEvents(events = [], attributes = []) {
  const attrsByEvent = new Map();
  attributes.forEach((raw) => {
    const attr = normalizeAttribute(raw);
    if (!attr?.event_id) return;
    if (!attrsByEvent.has(String(attr.event_id))) attrsByEvent.set(String(attr.event_id), []);
    attrsByEvent.get(String(attr.event_id)).push(attr);
  });

  return events.map((event, index) => {
    const attrs = attrsByEvent.get(String(event.id)) || [];
    const lat = attrs.find((a) => String(a.type).toLowerCase() === 'latitude')?.value;
    const lon = attrs.find((a) => String(a.type).toLowerCase() === 'longitude')?.value;
    const srcAttr = attrs.find((a) => ['ip-src', 'domain', 'hostname'].includes(String(a.type).toLowerCase()));
    const dstAttr = attrs.find((a) => ['ip-dst', 'domain', 'hostname', 'url'].includes(String(a.type).toLowerCase()) && a.value !== srcAttr?.value);

    const originLat = Number.isFinite(Number(lat)) ? Number(lat) : hashToCoord(`${event.uuid || event.id}-o-lat`, 70);
    const originLon = Number.isFinite(Number(lon)) ? Number(lon) : hashToCoord(`${event.uuid || event.id}-o-lon`, 170);
    const targetLat = hashToCoord(`${event.uuid || event.id}-t-lat`, 70, 5);
    const targetLon = hashToCoord(`${event.uuid || event.id}-t-lon`, 170, -5);

    return {
      id: `MISP-GEO-${event.uuid || event.id || index}`,
      label: String(event.info || 'MISP threat event'),
      severity: severityFromThreatLevel(event.threat_level_id),
      feed: 'MISP',
      observedAt: event.timestamp ? new Date(Number(event.timestamp) * 1000).toISOString() : nowIso(),
      origin: {
        label: srcAttr?.value || event?.Orgc?.name || 'MISP Source',
        lat: originLat,
        lon: originLon,
      },
      target: {
        label: dstAttr?.value || event?.Org?.name || 'MISP Target',
        lat: targetLat,
        lon: targetLon,
      },
    };
  });
}

async function getMispIntel() {
  const cfg = getConfig();
  mispState.configured = cfg.configured;
  mispState.baseUrl = cfg.baseUrl || null;
  mispState.verifyTls = cfg.verifyTls;
  mispState.timeoutMs = cfg.timeoutMs;
  mispState.lookbackHours = cfg.lookbackHours;

  if (!cfg.configured) {
    mispState.connected = false;
    mispState.lastError = 'MISP not configured';
    mispState.counts = { feedItems: 0, geoEvents: 0, rawEvents: 0, rawAttributes: 0 };
    return { ok: false, reason: 'not-configured', feedItems: [], geoEvents: [] };
  }

  try {
    const searchPayload = buildSearchPayload(cfg);
    const eventsResponse = await mispRequest('/events/restSearch', searchPayload, cfg);
    const attributesResponse = await mispRequest('/attributes/restSearch', { ...searchPayload, limit: 300 }, cfg);

    const rawEvents = asArray(eventsResponse?.response).map((event) => normalizeEvent(event)).filter(Boolean);
    const rawAttributes = asArray(attributesResponse?.response).map((attribute) => normalizeAttribute(attribute)).filter(Boolean);

    const feedItems = normalizeThreatFeed(rawEvents);
    const geoEvents = normalizeGeoEvents(rawEvents, rawAttributes);

    mispState.connected = true;
    mispState.lastError = null;
    mispState.lastSync = nowIso();
    mispState.counts = { feedItems: feedItems.length, geoEvents: geoEvents.length, rawEvents: rawEvents.length, rawAttributes: rawAttributes.length };

    return { ok: true, feedItems, geoEvents };
  } catch (error) {
    mispState.connected = false;
    mispState.lastError = error.message;
    mispState.lastSync = nowIso();
    mispState.counts = { feedItems: 0, geoEvents: 0, rawEvents: 0, rawAttributes: 0 };
    return { ok: false, reason: 'unreachable', error: error.message, feedItems: [], geoEvents: [] };
  }
}

function getMispStatus() {
  return {
    configured: mispState.configured,
    connected: mispState.connected,
    baseUrl: mispState.baseUrl,
    verifyTls: mispState.verifyTls,
    timeoutMs: mispState.timeoutMs,
    lookbackHours: mispState.lookbackHours,
    lastSync: mispState.lastSync,
    counts: mispState.counts,
    lastError: mispState.lastError,
  };
}

module.exports = {
  getMispIntel,
  getMispStatus,
};
