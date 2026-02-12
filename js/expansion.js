const API_BASE = window.location.origin.startsWith('http') ? '' : 'http://localhost:3001';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#38bdf8',
};

const threatMapState = {
  paused: false,
  severity: 'all',
  refreshTimer: null,
  refreshMs: 30000,
};

async function fetchJson(path, opts = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function authHeader() {
  const token = localStorage.getItem('portal_token');
  return token ? { authorization: `Bearer ${token}` } : {};
}

function severityBadgeClass(raw) {
  const level = String(raw || 'low').toLowerCase();
  return `badge badge-${SEVERITY_COLORS[level] ? level : 'low'}`;
}

function plotPoint({ lat, lon, width, height }) {
  const x = ((Number(lon) + 180) / 360) * width;
  const y = ((90 - Number(lat)) / 180) * height;
  return { x: Math.max(0, Math.min(width, x)), y: Math.max(0, Math.min(height, y)) };
}

function flowPath(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const curve = Math.max(35, Math.min(120, Math.abs(dx) * 0.22 + Math.abs(dy) * 0.15));
  const c1x = start.x + dx * 0.3;
  const c2x = start.x + dx * 0.7;
  const c1y = start.y - curve;
  const c2y = end.y - curve;
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function mapSvg(events) {
  const width = 1000;
  const height = 500;
  const continents = [
    'M80,195 L145,145 L220,145 L260,190 L220,235 L130,230 Z',
    'M245,250 L300,270 L318,355 L280,440 L245,405 Z',
    'M430,140 L545,120 L655,155 L670,225 L610,240 L520,220 L455,245 L405,210 Z',
    'M520,250 L600,272 L630,350 L585,425 L515,396 L490,318 Z',
    'M680,165 L760,140 L875,165 L940,215 L890,260 L790,250 L710,230 Z',
    'M805,300 L860,335 L845,380 L792,390 L760,352 Z',
  ];

  const filtered = events.filter((event) => threatMapState.severity === 'all' || event.severity === threatMapState.severity);

  const flows = filtered.map((event) => {
    const start = plotPoint({ ...event.origin, width, height });
    const end = plotPoint({ ...event.target, width, height });
    const color = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.info;
    return {
      id: event.id,
      label: event.label,
      severity: event.severity,
      color,
      start,
      end,
      path: flowPath(start, end),
      sourceLabel: event.origin.label,
      targetLabel: event.target.label,
    };
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0L0 0 0 50" fill="none" stroke="rgba(148,163,184,0.12)" stroke-width="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#grid)"></rect>
      ${continents.map((path) => `<path d="${path}" fill="rgba(148, 163, 184, 0.2)" stroke="rgba(148,163,184,0.3)" stroke-width="1"></path>`).join('')}
      ${flows.map((flow) => `<path class="map-flow" d="${flow.path}" stroke="${flow.color}"><title>${flow.label} (${flow.sourceLabel} → ${flow.targetLabel})</title></path>`).join('')}
      ${flows.map((flow) => `
        <g class="map-point">
          <circle cx="${flow.start.x}" cy="${flow.start.y}" r="3.4" fill="${flow.color}"></circle>
          <circle class="map-point-pulse" cx="${flow.start.x}" cy="${flow.start.y}" r="2" fill="none" stroke="${flow.color}" stroke-width="1.2"></circle>
          <circle cx="${flow.end.x}" cy="${flow.end.y}" r="3.8" fill="${flow.color}"></circle>
        </g>
      `).join('')}
    </svg>
  `;
}

function renderMapMeta(meta = {}) {
  const source = document.getElementById('threat-map-source');
  const updated = document.getElementById('threat-map-updated');
  if (source) source.textContent = `Source: ${meta.source || 'mock'}`;
  if (updated) {
    const stamp = meta.lastUpdated ? new Date(meta.lastUpdated).toLocaleTimeString() : '-';
    updated.textContent = `Last updated: ${stamp}`;
  }
}

async function refreshThreatMap() {
  const mapRoot = document.getElementById('threat-map');
  if (!mapRoot || threatMapState.paused) return;
  const response = await fetchJson('/api/threat-geo-events');
  if (!response.ok || !response.data?.data) return;
  const events = response.data.data;
  mapRoot.innerHTML = mapSvg(events);
  renderMapMeta(response.data.meta || {});

  const nextMs = Number(response.data.meta?.refreshMs || 30000);
  if (nextMs !== threatMapState.refreshMs) {
    threatMapState.refreshMs = nextMs;
    if (threatMapState.refreshTimer) {
      clearInterval(threatMapState.refreshTimer);
      threatMapState.refreshTimer = setInterval(refreshThreatMap, threatMapState.refreshMs);
    }
  }
}

async function initBooking() {
  const slotSelect = document.getElementById('slotId');
  const bookingForm = document.getElementById('booking-form');
  const bookingResult = document.getElementById('booking-result');
  if (!slotSelect || !bookingForm) return;

  const slots = await fetchJson('/api/demo-slots');
  (slots?.data?.data || []).forEach((slot) => {
    const option = document.createElement('option');
    option.value = slot.id;
    option.textContent = `${slot.date} ${slot.time} (${slot.available} left)`;
    slotSelect.appendChild(option);
  });

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);
    const payload = Object.fromEntries(formData.entries());
    payload.attendees = Number(payload.attendees || 1);

    const resp = await fetchJson('/api/demo-bookings', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    bookingResult.textContent = resp.ok ? `Booked! Confirmation ${resp.data.data.id}.` : `Booking failed: ${resp.data?.error || 'Invalid input'}`;
  });
}

async function renderSoc(filters = {}) {
  const query = new URLSearchParams(filters).toString();
  const data = await fetchJson(`/api/soc-preview${query ? `?${query}` : ''}`);
  if (!data?.ok || !data?.data?.data) return;
  const { kpis, incidents, alerts, chart, timeline, threats } = data.data.data;
  document.getElementById('kpi-open').textContent = kpis.openIncidents;
  document.getElementById('kpi-mttr').textContent = `${kpis.mttrMinutes}m`;
  document.getElementById('kpi-analysts').textContent = kpis.activeAnalysts;

  const bars = document.getElementById('soc-chart');
  bars.innerHTML = '';
  chart.forEach((value) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.max(20, value * 4)}px`;
    bars.appendChild(bar);
  });

  const list = document.getElementById('soc-list');
  list.innerHTML = '';
  [...alerts, ...incidents, ...threats].forEach((item) => {
    const severity = String(item.severity || item.level || 'low').toLowerCase();
    const li = document.createElement('article');
    li.className = 'list-item';
    li.dataset.severity = severity;
    li.innerHTML = `
      <div class="list-item-header">
        <strong>${item.id || item.incident_ref}</strong>
        <span class="${severityBadgeClass(severity)}">${severity}</span>
      </div>
      <div>${item.title || item.summary || item.threat}</div>
      <div class="small">${item.source || 'SOC'} ${item.status ? `· ${item.status}` : ''} ${(item.mitre_tags || item.mitre || '') ? `· ${(item.mitre_tags || item.mitre)}` : ''}</div>
    `;
    list.appendChild(li);
  });

  const timelineRoot = document.getElementById('soc-timeline');
  if (timelineRoot) {
    timelineRoot.innerHTML = '';
    timeline.forEach((point) => {
      const row = document.createElement('article');
      row.className = 'list-item';
      row.innerHTML = `
        <div class="list-item-header">
          <strong>${new Date(point.t).toLocaleString()}</strong>
          <span class="badge badge-medium">${point.value}</span>
        </div>
        <div>${point.label}</div>
      `;
      timelineRoot.appendChild(row);
    });
  }
}

async function initSocPreview() {
  const socRoot = document.getElementById('soc-preview');
  if (!socRoot) return;
  await renderSoc();

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('#soc-list .list-item').forEach((item) => {
        item.style.display = key === 'all' || item.dataset.severity === key ? 'grid' : 'none';
      });
    });
  });

  const apply = document.getElementById('soc-apply-filters');
  if (apply) {
    apply.addEventListener('click', () => {
      renderSoc({
        source: document.getElementById('soc-source-filter').value.trim(),
        status: document.getElementById('soc-status-filter').value.trim(),
        mitre: document.getElementById('soc-mitre-filter').value.trim(),
      });
    });
  }
}

function initThreatMap() {
  const mapRoot = document.getElementById('threat-map');
  if (!mapRoot) return;

  const toggle = document.getElementById('threat-map-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      threatMapState.paused = !threatMapState.paused;
      toggle.textContent = threatMapState.paused ? 'Resume' : 'Pause';
      toggle.setAttribute('aria-pressed', String(threatMapState.paused));
      if (!threatMapState.paused) refreshThreatMap();
    });
  }

  document.querySelectorAll('[data-map-severity]').forEach((button) => {
    button.addEventListener('click', () => {
      threatMapState.severity = button.dataset.mapSeverity;
      document.querySelectorAll('[data-map-severity]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      refreshThreatMap();
    });
  });

  refreshThreatMap();
  threatMapState.refreshTimer = setInterval(refreshThreatMap, threatMapState.refreshMs);
}

async function initThreatFeed() {
  const feed = document.getElementById('threat-feed');
  if (!feed) return;
  const data = await fetchJson('/api/threat-feed');
  (data?.data?.data || []).slice(0, 5).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<strong>${item.threat || item.title}</strong><div class="small">${item.source} · ${item.severity || 'info'}</div>`;
    feed.appendChild(div);
  });
}

function initPricingCalc() {
  const form = document.getElementById('pricing-calc');
  const output = document.getElementById('pricing-result');
  if (!form || !output) return;

  const endpointsCost = document.getElementById('endpoints-cost');
  const usersCost = document.getElementById('users-cost');
  const servicesCost = document.getElementById('services-cost');
  const baseCost = document.getElementById('base-cost');

  const BASE_PRICE = 299;
  const recalc = () => {
    const endpoints = Math.max(0, Number(document.getElementById('endpoints').value || 0));
    const users = Math.max(0, Number(document.getElementById('users').value || 0));
    const services = [...document.querySelectorAll('input[name="service"]:checked, input[name="service[]"]:checked')].length;

    const endpointSubtotal = endpoints * 6;
    const userSubtotal = users * 3;
    const serviceSubtotal = services * 250;
    const total = endpointSubtotal + userSubtotal + serviceSubtotal + BASE_PRICE;

    output.textContent = `Estimated monthly investment: $${total.toLocaleString()}`;

    if (endpointsCost) endpointsCost.textContent = `$${endpointSubtotal.toLocaleString()}`;
    if (usersCost) usersCost.textContent = `$${userSubtotal.toLocaleString()}`;
    if (servicesCost) servicesCost.textContent = `$${serviceSubtotal.toLocaleString()}`;
    if (baseCost) baseCost.textContent = `$${BASE_PRICE.toLocaleString()}`;
  };

  form.addEventListener('input', recalc);
  form.addEventListener('submit', (event) => event.preventDefault());
  recalc();
}

function initFilterSearch(containerId, queryId) {
  const root = document.getElementById(containerId);
  const query = document.getElementById(queryId);
  if (!root || !query) return;
  query.addEventListener('input', () => {
    const q = query.value.toLowerCase().trim();
    root.querySelectorAll('[data-tags]').forEach((item) => {
      item.style.display = item.dataset.tags.toLowerCase().includes(q) ? 'block' : 'none';
    });
  });
}

function initPortalForm() {
  const form = document.getElementById('portal-login');
  const result = document.getElementById('portal-result');
  const userBox = document.getElementById('portal-user');
  if (!form || !result) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const login = await fetchJson('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!login.ok) {
      result.textContent = `Login failed: ${login.data?.error || 'invalid credentials'}`;
      return;
    }
    localStorage.setItem('portal_token', login.data.token);
    result.textContent = 'Signed in successfully.';
    userBox.textContent = `Role: ${login.data.user.role} | ${login.data.user.email}`;
  });
}

async function initStatusPage() {
  if (!document.getElementById('status-current')) return;
  const status = await fetchJson('/api/status');
  if (!status.ok) return;
  document.getElementById('status-current').textContent = `${status.data.current.status}: ${status.data.current.message || 'No issues reported'}`;
  const incidents = document.getElementById('status-incidents');
  incidents.innerHTML = '';
  status.data.incidents.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.textContent = `${item.incident_ref} - ${item.title} (${item.status})`;
    incidents.appendChild(row);
  });
}

function initAdmin() {
  const form = document.getElementById('admin-login');
  if (!form) return;
  const authResult = document.getElementById('admin-auth-result');
  const overview = document.getElementById('admin-overview');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const login = await fetchJson('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!login.ok) {
      authResult.textContent = `Login failed: ${login.data?.error || 'unauthorized'}`;
      return;
    }
    localStorage.setItem('portal_token', login.data.token);
    authResult.textContent = 'Authenticated.';
    const data = await fetchJson('/api/admin/overview', { headers: { ...authHeader() } });
    if (!data.ok) return;
    const d = data.data.data;
    overview.innerHTML = `<div class="kpi"><div class="small">Slots</div><strong>${d.slots}</strong></div><div class="kpi"><div class="small">Bookings</div><strong>${d.bookings}</strong></div><div class="kpi"><div class="small">Leads</div><strong>${d.leads}</strong></div><div class="kpi"><div class="small">Incidents</div><strong>${d.incidents}</strong></div>`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBooking();
  initSocPreview();
  initThreatMap();
  initThreatFeed();
  initPricingCalc();
  initFilterSearch('case-study-list', 'case-search');
  initFilterSearch('resource-list', 'resource-search');
  initPortalForm();
  initStatusPage();
  initAdmin();
});
