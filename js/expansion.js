const API_BASE = window.location.origin.startsWith('http') ? '' : 'http://localhost:3001';

const SEVERITY_COLORS = {
  critical: '#ff4d6d',
  high: '#ff8a3d',
  medium: '#f7c948',
  low: '#3ddc97',
  info: '#4db8ff',
};

const MAP_REGION_VIEWS = {
  global: { center: [20, 0], zoom: 2 },
  americas: { center: [16, -86], zoom: 3 },
  emea: { center: [28, 18], zoom: 3 },
  apac: { center: [18, 112], zoom: 3 },
  africa: { center: [4, 20], zoom: 3 },
};

const threatMapState = {
  paused: false,
  severitySet: new Set(['critical', 'high', 'medium', 'low']),
  showArcs: true,
  playbackSpeed: 1,
  density: 0.75,
  region: 'global',
  refreshTimer: null,
  refreshMs: 30000,
  events: [],
  lastMeta: {},
  reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  map: null,
  layers: [],
  arcAnimationTimer: null,
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

function inRegion(event, region) {
  if (region === 'global') return true;
  const point = event?.target || event?.origin || {};
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return false;
  const bounds = {
    americas: { latMin: -56, latMax: 83, lonMin: -170, lonMax: -30 },
    emea: { latMin: -38, latMax: 72, lonMin: -20, lonMax: 60 },
    apac: { latMin: -48, latMax: 70, lonMin: 60, lonMax: 180 },
    africa: { latMin: -36, latMax: 38, lonMin: -20, lonMax: 56 },
  };
  const b = bounds[region];
  return !!b && lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax;
}

function filterThreatEvents(events) {
  return (events || []).filter((event) => {
    const severity = String(event.severity || 'medium').toLowerCase();
    return threatMapState.severitySet.has(severity) && inRegion(event, threatMapState.region);
  });
}

function clearThreatMapLayers() {
  if (threatMapState.arcAnimationTimer) {
    clearInterval(threatMapState.arcAnimationTimer);
    threatMapState.arcAnimationTimer = null;
  }
  threatMapState.layers.forEach((layer) => layer.remove());
  threatMapState.layers = [];
}

function ensureLeafletMap() {
  if (threatMapState.map) return threatMapState.map;
  const mapRoot = document.getElementById('threat-map');
  const status = document.getElementById('threat-map-status');
  if (!mapRoot || typeof window.L === 'undefined') {
    if (status) status.textContent = 'Map engine unavailable. Threat telemetry continues in feed.';
    return null;
  }

  const map = window.L.map(mapRoot, {
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 6,
  }).setView(MAP_REGION_VIEWS.global.center, MAP_REGION_VIEWS.global.zoom);

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
    className: 'threat-map-tiles',
  }).addTo(map);

  threatMapState.map = map;
  return map;
}

function renderLeafletThreatMap() {
  const map = ensureLeafletMap();
  const status = document.getElementById('threat-map-status');
  if (!map) return;

  const baseline = window.innerWidth < 768 ? 40 : 80;
  const maxFlows = Math.max(10, Math.floor(baseline * threatMapState.density));
  const filtered = filterThreatEvents(threatMapState.events).slice(0, maxFlows);

  clearThreatMapLayers();

  const animatingArcs = [];

  filtered.forEach((event, index) => {
    const severity = String(event.severity || 'medium').toLowerCase();
    const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
    const origin = [Number(event.origin?.lat), Number(event.origin?.lon)];
    const target = [Number(event.target?.lat), Number(event.target?.lon)];
    if (origin.some(Number.isNaN) || target.some(Number.isNaN)) return;

    const originMarker = window.L.circleMarker(origin, {
      radius: 4,
      color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.95,
      className: threatMapState.reducedMotion ? 'map-origin-static' : 'map-origin-pulse',
    }).bindTooltip(`${event.origin?.label || 'Source'} (${severity.toUpperCase()})`, { direction: 'top' }).addTo(map);

    const targetMarker = window.L.circleMarker(target, {
      radius: 5,
      color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.8,
      className: 'map-target-point',
    }).bindTooltip(`${event.target?.label || 'Target'} • ${event.label || 'Threat flow'}`, { direction: 'top' }).addTo(map);

    threatMapState.layers.push(originMarker, targetMarker);

    if (threatMapState.showArcs) {
      const line = window.L.polyline([origin, target], {
        color,
        weight: 2,
        opacity: threatMapState.reducedMotion ? 0.45 : 0.72,
        dashArray: '8 10',
        className: 'map-flow-line',
      }).addTo(map);
      line.bindTooltip(`${event.label || 'Threat flow'} (${event.origin?.label || 'Source'} → ${event.target?.label || 'Target'})`);
      threatMapState.layers.push(line);
      if (!threatMapState.reducedMotion) {
        animatingArcs.push({
          line,
          offset: index * 6,
          step: Math.max(1.5, threatMapState.playbackSpeed * 2.2),
        });
      }
    }
  });

  if (animatingArcs.length) {
    threatMapState.arcAnimationTimer = setInterval(() => {
      animatingArcs.forEach((arc) => {
        arc.offset -= arc.step;
        const node = arc.line.getElement();
        if (node) node.style.strokeDashoffset = `${arc.offset}`;
      });
    }, 80);
  }

  const nextView = MAP_REGION_VIEWS[threatMapState.region] || MAP_REGION_VIEWS.global;
  map.flyTo(nextView.center, nextView.zoom, { animate: !threatMapState.reducedMotion, duration: 0.6 });

  if (status) {
    status.textContent = `${filtered.length} visible event${filtered.length === 1 ? '' : 's'} · ${threatMapState.showArcs ? 'attack arcs on' : 'attack arcs off'} · ${threatMapState.region.toUpperCase()}`;
  }
  renderMapLiveMetrics(threatMapState.lastMeta || {});
}

function renderMapMeta(meta = {}) {
  const source = document.getElementById('threat-map-source');
  const updated = document.getElementById('threat-map-updated');
  const badge = document.getElementById('threat-map-source-badge');
  const sourceValue = String(meta.source || 'mock');
  if (source) source.textContent = `Source: ${sourceValue}`;
  if (badge) {
    const isMisp = sourceValue.toLowerCase().includes('misp');
    badge.style.display = isMisp ? 'inline-block' : 'none';
    badge.textContent = 'MISP';
  }
  if (updated) {
    const stamp = meta.lastUpdated ? new Date(meta.lastUpdated).toLocaleTimeString() : '-';
    updated.textContent = `Last updated: ${stamp}`;
  }
}

function renderMapLiveMetrics(meta = {}) {
  const filtered = filterThreatEvents(threatMapState.events);
  const uniqueSources = new Set(filtered.map((item) => String(item.origin?.label || item.origin?.key || item.origin?.lat || 'src')));
  const targetCounts = filtered.reduce((acc, item) => {
    const key = String(item.target?.label || 'Unknown');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topTargets = Object.entries(targetCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ') || '-';

  const attacksMinEl = document.getElementById('threat-map-attacks-minute');
  const sourcesEl = document.getElementById('threat-map-active-sources');
  const targetsEl = document.getElementById('threat-map-top-targets');
  const updatedEl = document.getElementById('threat-map-last-updated');
  if (attacksMinEl) attacksMinEl.textContent = String(filtered.length);
  if (sourcesEl) sourcesEl.textContent = String(uniqueSources.size);
  if (targetsEl) targetsEl.textContent = topTargets;
  if (updatedEl) updatedEl.textContent = meta.lastUpdated ? new Date(meta.lastUpdated).toLocaleTimeString() : '-';
}

function renderThreatMapFromState() {
  renderLeafletThreatMap();
}

function restartThreatMapTimer() {
  if (threatMapState.refreshTimer) clearInterval(threatMapState.refreshTimer);
  const cadence = Math.max(7000, Math.floor(threatMapState.refreshMs / Math.max(0.5, threatMapState.playbackSpeed)));
  threatMapState.refreshTimer = setInterval(refreshThreatMap, cadence);
}

async function refreshThreatMap() {
  if (threatMapState.paused) return;
  const response = await fetchJson('/api/threat-geo-events');
  if (!response.ok || !response.data?.data) return;

  threatMapState.events = response.data.data;
  threatMapState.lastMeta = response.data.meta || {};
  renderThreatMapFromState();
  renderMapMeta(threatMapState.lastMeta);

  const nextMs = Number(response.data.meta?.refreshMs || 30000);
  if (nextMs !== threatMapState.refreshMs) {
    threatMapState.refreshMs = nextMs;
    restartThreatMapTimer();
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

  ensureLeafletMap();
  window.addEventListener('resize', () => {
    if (threatMapState.map) threatMapState.map.invalidateSize(false);
  });

  const toggle = document.getElementById('threat-map-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      threatMapState.paused = !threatMapState.paused;
      toggle.textContent = threatMapState.paused ? 'Resume' : 'Pause';
      toggle.setAttribute('aria-pressed', String(threatMapState.paused));
      if (!threatMapState.paused) refreshThreatMap();
    });
  }

  const severityButtons = [...document.querySelectorAll('[data-map-severity]')];
  severityButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.mapSeverity;
      if (value === 'all') {
        threatMapState.severitySet = new Set(['critical', 'high', 'medium', 'low']);
        severityButtons.forEach((item) => item.classList.add('active'));
      } else {
        if (threatMapState.severitySet.has(value)) {
          threatMapState.severitySet.delete(value);
        } else {
          threatMapState.severitySet.add(value);
        }
        const allEnabled = ['critical', 'high', 'medium', 'low'].every((level) => threatMapState.severitySet.has(level));
        severityButtons.forEach((item) => {
          const level = item.dataset.mapSeverity;
          if (level === 'all') item.classList.toggle('active', allEnabled);
          else item.classList.toggle('active', threatMapState.severitySet.has(level));
        });
        if (threatMapState.severitySet.size === 0) {
          threatMapState.severitySet = new Set(['critical', 'high', 'medium', 'low']);
          severityButtons.forEach((item) => item.classList.add('active'));
        }
      }
      renderThreatMapFromState();
    });
  });

  const speed = document.getElementById('threat-map-speed');
  if (speed) {
    speed.addEventListener('change', () => {
      threatMapState.playbackSpeed = Number(speed.value || 1);
      restartThreatMapTimer();
      renderThreatMapFromState();
    });
  }

  const density = document.getElementById('threat-map-density');
  if (density) {
    density.addEventListener('input', () => {
      threatMapState.density = Math.max(0.2, Math.min(1, Number(density.value || 75) / 100));
      renderThreatMapFromState();
    });
  }

  const region = document.getElementById('threat-map-region');
  if (region) {
    region.addEventListener('change', () => {
      threatMapState.region = region.value || 'global';
      renderThreatMapFromState();
    });
  }

  const arcsToggle = document.getElementById('threat-map-arcs');
  if (arcsToggle) {
    arcsToggle.setAttribute('aria-pressed', String(threatMapState.showArcs));
    arcsToggle.addEventListener('click', () => {
      threatMapState.showArcs = !threatMapState.showArcs;
      arcsToggle.textContent = threatMapState.showArcs ? 'Hide Arcs' : 'Show Arcs';
      arcsToggle.setAttribute('aria-pressed', String(threatMapState.showArcs));
      renderThreatMapFromState();
    });
  }

  refreshThreatMap();
  restartThreatMapTimer();
}

async function initThreatFeed() {
  const feed = document.getElementById('threat-feed');
  if (!feed) return;
  const data = await fetchJson('/api/threat-feed');
  (data?.data?.data || []).slice(0, 5).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    const source = String(item.source || 'SOC');
    const mispBadge = source.toLowerCase().includes('misp') ? ' <span class="badge badge-medium">MISP</span>' : '';
    div.innerHTML = `<strong>${item.threat || item.title}</strong><div class="small">${source}${mispBadge} · ${item.severity || 'info'}</div>`;
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
