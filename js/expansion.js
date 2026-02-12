const API_BASE = window.location.origin.startsWith('http') ? '' : 'http://localhost:3001';

const SEVERITY_COLORS = {
  critical: '#ff4d6d',
  high: '#ff8a3d',
  medium: '#f7c948',
  low: '#3ddc97',
  info: '#4db8ff',
};

const LANDMASSES = [
  // North America
  [[72, -168], [65, -155], [58, -141], [52, -130], [45, -125], [35, -120], [28, -114], [18, -102], [16, -88], [24, -82], [30, -77], [41, -70], [52, -62], [61, -72], [69, -95], [72, -120], [72, -168]],
  // South America
  [[13, -81], [9, -74], [3, -69], [-7, -63], [-18, -58], [-28, -57], [-39, -63], [-52, -71], [-56, -75], [-46, -67], [-32, -57], [-19, -52], [-2, -49], [6, -54], [13, -64], [13, -81]],
  // Europe + Asia
  [[71, -10], [68, 18], [64, 45], [58, 67], [56, 92], [53, 122], [50, 142], [40, 152], [29, 136], [19, 121], [13, 101], [8, 82], [6, 66], [14, 52], [22, 43], [30, 35], [38, 27], [45, 13], [52, 2], [58, -8], [71, -10]],
  // Africa
  [[37, -17], [31, -7], [24, 4], [14, 12], [7, 17], [-6, 20], [-17, 23], [-28, 27], [-35, 19], [-34, 8], [-29, 1], [-17, -5], [-4, -11], [10, -15], [21, -14], [30, -11], [37, -17]],
  // Australia
  [[-11, 112], [-16, 127], [-19, 137], [-26, 146], [-35, 147], [-41, 136], [-39, 124], [-33, 116], [-25, 112], [-11, 112]],
  // Greenland
  [[83, -73], [78, -56], [73, -38], [66, -35], [60, -43], [61, -53], [66, -62], [74, -66], [83, -73]],
  // UK/Iceland blob
  [[64, -24], [60, -21], [56, -11], [52, -6], [50, 0], [53, 3], [58, -2], [63, -13], [64, -24]],
];

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
  const clampedLat = Math.max(-85, Math.min(85, Number(lat)));
  const lambda = (Number(lon) * Math.PI) / 180;
  const phi = (clampedLat * Math.PI) / 180;
  const x = ((lambda + Math.PI) / (2 * Math.PI)) * width;
  const mercN = Math.log(Math.tan((Math.PI / 4) + (phi / 2)));
  const y = (height / 2) - ((width * mercN) / (2 * Math.PI)) * 0.62;
  return { x: Math.max(0, Math.min(width, x)), y: Math.max(0, Math.min(height, y)) };
}

function geoPolygonPath(coords, width, height) {
  if (!Array.isArray(coords) || coords.length < 2) return '';
  const parts = coords.map(([lat, lon], idx) => {
    const p = plotPoint({ lat, lon, width, height });
    return `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  });
  return `${parts.join(' ')} Z`;
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

function flowPath(start, end, wave = 0) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const travel = Math.hypot(dx, dy);
  const baseCurve = Math.max(18, Math.min(120, travel * 0.22));
  const wobble = Math.sin(wave * 1.7) * 22;
  const northBias = ((start.y + end.y) / 2) > 220 ? -1 : 1;
  const c1x = start.x + dx * (0.22 + (Math.cos(wave) * 0.03));
  const c2x = start.x + dx * (0.78 - (Math.sin(wave) * 0.03));
  const c1y = start.y - ((baseCurve + wobble) * northBias);
  const c2y = end.y - ((baseCurve - wobble) * northBias);
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function mapSvg(events) {
  const width = 1000;
  const height = 500;
  const baseline = window.innerWidth < 768 ? 56 : 110;
  const maxFlows = Math.max(12, Math.floor(baseline * threatMapState.density));
  const filtered = filterThreatEvents(events).slice(0, maxFlows);

  const flows = filtered.map((event, index) => {
    const start = plotPoint({ ...event.origin, width, height });
    const end = plotPoint({ ...event.target, width, height });
    const severity = String(event.severity || 'medium').toLowerCase();
    const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
    const wave = ((index + 1) * 0.91) + (String(event.id || index).length * 0.13);
    const duration = Math.max(4.5, (11 - (threatMapState.playbackSpeed * 3.5)) + ((index % 5) * 0.35));
    const delay = (index % 9) * 0.22;
    return {
      id: event.id || `event-${index}`,
      label: event.label,
      severity,
      color,
      start,
      end,
      path: flowPath(start, end, wave),
      sourceLabel: event.origin.label,
      targetLabel: event.target.label,
      arcStyle: `--arc-duration:${duration.toFixed(2)}s;--arc-delay:${delay.toFixed(2)}s;`,
    };
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" role="presentation" focusable="false">
      <defs>
        <linearGradient id="oceanGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#020617" />
          <stop offset="45%" stop-color="#0b1430" />
          <stop offset="100%" stop-color="#030712" />
        </linearGradient>
        <radialGradient id="vignette" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stop-color="rgba(56,189,248,0.09)" />
          <stop offset="100%" stop-color="rgba(2,6,23,0.94)" />
        </radialGradient>
        <linearGradient id="landGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(30,64,175,0.44)" />
          <stop offset="100%" stop-color="rgba(15,118,110,0.24)" />
        </linearGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(148,163,184,0.1)" stroke-width="1" />
        </pattern>
        <filter id="landGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#oceanGradient)"></rect>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#grid)"></rect>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#vignette)"></rect>

      <g class="map-landmasses" filter="url(#landGlow)">
        ${LANDMASSES.map((coords) => `<path d="${geoPolygonPath(coords, width, height)}" class="map-land"></path>`).join('')}
      </g>

      ${threatMapState.showArcs ? flows.map((flow) => `<path class="map-flow${threatMapState.reducedMotion ? ' map-flow-static' : ''}" style="${flow.arcStyle}" d="${flow.path}" stroke="${flow.color}"><title>${flow.label} (${flow.sourceLabel} → ${flow.targetLabel})</title></path>`).join('') : ''}

      ${flows.map((flow) => `
        <g class="map-point" style="--map-accent:${flow.color}">
          <circle class="map-point-origin" cx="${flow.start.x}" cy="${flow.start.y}" r="3.2"></circle>
          ${threatMapState.reducedMotion ? '' : `<circle class="map-point-pulse" cx="${flow.start.x}" cy="${flow.start.y}" r="2.6"></circle>`}
          <circle class="map-point-target" cx="${flow.end.x}" cy="${flow.end.y}" r="3.8"></circle>
        </g>
      `).join('')}
    </svg>
  `;
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
  const mapRoot = document.getElementById('threat-map');
  const status = document.getElementById('threat-map-status');
  if (!mapRoot) return;
  mapRoot.innerHTML = mapSvg(threatMapState.events);

  if (status) {
    const visible = filterThreatEvents(threatMapState.events).length;
    status.textContent = `${visible} visible event${visible === 1 ? '' : 's'} · ${threatMapState.showArcs ? 'attack arcs on' : 'attack arcs off'} · ${threatMapState.region.toUpperCase()}`;
  }
  renderMapLiveMetrics(threatMapState.lastMeta || {});
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
