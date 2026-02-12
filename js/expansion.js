const API_BASE = window.location.origin.startsWith('http') ? '' : 'http://localhost:3001';

const SEVERITY_COLORS = {
  critical: '#ff4d6d',
  high: '#ff8a3d',
  medium: '#f7c948',
  low: '#3ddc97',
  info: '#4db8ff',
};

const MAP_REGION_VIEWS = {
  global: { center: [18, 10], zoom: 1.6, bounds: [[-58, -180], [82, 180]] },
  americas: { center: [16, -86], zoom: 3, bounds: [[-56, -170], [83, -30]] },
  emea: { center: [28, 18], zoom: 3, bounds: [[-38, -20], [72, 60]] },
  apac: { center: [18, 112], zoom: 3, bounds: [[-48, 60], [70, 180]] },
  africa: { center: [4, 20], zoom: 3, bounds: [[-36, -20], [38, 56]] },
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

const socChartState = {
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
    minZoom: 1,
    maxZoom: 6,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    maxBoundsViscosity: 0.9,
  }).setView(MAP_REGION_VIEWS.global.center, MAP_REGION_VIEWS.global.zoom);

  map.setMaxBounds([[-85, -180], [85, 180]]);

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
    className: 'threat-map-tiles',
  }).addTo(map);

  threatMapState.map = map;
  return map;
}

function createMapNode(latlng, color, nodeClass, tooltipText) {
  const marker = window.L.marker(latlng, {
    icon: window.L.divIcon({
      className: '',
      html: `<span class="map-node ${nodeClass}" style="color:${color}; background:${color};"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    keyboard: true,
  });
  marker.bindTooltip(tooltipText, { direction: 'top' });
  return marker;
}

function buildArcPath(origin, target) {
  const [lat1, lon1] = origin;
  const [lat2, lon2] = target;
  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;
  const curvature = Math.min(20, 4 + (Math.abs(lon2 - lon1) + Math.abs(lat2 - lat1)) * 0.09);
  const ctrlLat = midLat + curvature;
  const ctrlLon = midLon;

  const points = [];
  const steps = 26;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const omt = 1 - t;
    const lat = (omt * omt * lat1) + (2 * omt * t * ctrlLat) + (t * t * lat2);
    const lon = (omt * omt * lon1) + (2 * omt * t * ctrlLon) + (t * t * lon2);
    points.push([lat, lon]);
  }
  return points;
}

function renderLeafletThreatMap() {
  const map = ensureLeafletMap();
  const status = document.getElementById('threat-map-status');
  if (!map) return;

  const baseline = window.innerWidth < 768 ? 34 : 72;
  const maxFlows = Math.max(8, Math.floor(baseline * threatMapState.density));
  const filtered = filterThreatEvents(threatMapState.events).slice(0, maxFlows);

  clearThreatMapLayers();

  const animatingArcs = [];

  filtered.forEach((event, index) => {
    const severity = String(event.severity || 'medium').toLowerCase();
    const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
    const origin = [Number(event.origin?.lat), Number(event.origin?.lon)];
    const target = [Number(event.target?.lat), Number(event.target?.lon)];
    if (origin.some(Number.isNaN) || target.some(Number.isNaN)) return;

    const originMarker = createMapNode(
      origin,
      color,
      threatMapState.reducedMotion ? 'map-node-target' : 'map-node-origin',
      `${event.origin?.label || 'Source'} (${severity.toUpperCase()})`,
    ).addTo(map);

    const targetMarker = createMapNode(
      target,
      color,
      'map-node-target',
      `${event.target?.label || 'Target'} • ${event.label || 'Threat flow'}`,
    ).addTo(map);

    threatMapState.layers.push(originMarker, targetMarker);

    if (threatMapState.showArcs) {
      const arcPath = buildArcPath(origin, target);
      const glowLine = window.L.polyline(arcPath, {
        color,
        weight: 5,
        opacity: threatMapState.reducedMotion ? 0.2 : 0.34,
        className: 'map-flow-line-glow',
      }).addTo(map);
      const coreLine = window.L.polyline(arcPath, {
        color,
        weight: 2,
        opacity: threatMapState.reducedMotion ? 0.38 : 0.72,
        dashArray: threatMapState.reducedMotion ? '' : '7 10',
        className: 'map-flow-line',
      }).addTo(map);
      coreLine.bindTooltip(`${event.label || 'Threat flow'} (${event.origin?.label || 'Source'} → ${event.target?.label || 'Target'})`);

      threatMapState.layers.push(glowLine, coreLine);

      if (!threatMapState.reducedMotion) {
        const tracer = window.L.marker(origin, {
          icon: window.L.divIcon({
            className: '',
            html: `<span class="map-tracer" style="color:${color}; background:${color};"></span>`,
            iconSize: [8, 8],
            iconAnchor: [4, 4],
          }),
        }).addTo(map);

        threatMapState.layers.push(tracer);
        animatingArcs.push({
          coreLine,
          tracer,
          path: arcPath,
          offset: index * 8,
          step: Math.max(1.4, threatMapState.playbackSpeed * 2.3),
          progress: (index * 0.09) % 1,
        });
      }
    }
  });

  if (animatingArcs.length) {
    threatMapState.arcAnimationTimer = setInterval(() => {
      animatingArcs.forEach((arc) => {
        arc.offset -= arc.step;
        arc.progress = (arc.progress + (0.009 * threatMapState.playbackSpeed)) % 1;

        const node = arc.coreLine.getElement();
        if (node) node.style.strokeDashoffset = `${arc.offset}`;

        const idx = Math.min(arc.path.length - 1, Math.floor(arc.progress * (arc.path.length - 1)));
        const point = arc.path[idx];
        if (point) arc.tracer.setLatLng(point);
      });
    }, 70);
  }

  const nextView = MAP_REGION_VIEWS[threatMapState.region] || MAP_REGION_VIEWS.global;
  if (nextView.bounds) {
    map.flyToBounds(nextView.bounds, {
      animate: !threatMapState.reducedMotion,
      duration: 0.7,
      padding: [16, 16],
      maxZoom: nextView.zoom,
    });
  } else {
    map.flyTo(nextView.center, nextView.zoom, { animate: !threatMapState.reducedMotion, duration: 0.7 });
  }

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

    setResultState(bookingResult, 'loading', 'Submitting booking…');
    const resp = await fetchJson('/api/demo-bookings', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (resp.ok) setResultState(bookingResult, 'success', `Booked! Confirmation ${resp.data.data.id}.`);
    else setResultState(bookingResult, 'error', `Booking failed: ${resp.data?.error || 'Invalid input'}`);
  });
}

function buildSocChartSeries(rawChart) {
  const toValue = (item) => {
    if (typeof item === 'number') return item;
    if (item && typeof item === 'object') return Number(item.value ?? item.count ?? item.y ?? 0);
    return Number(item || 0);
  };

  const points = (Array.isArray(rawChart) ? rawChart : []).map((item, index) => ({
    value: Math.max(0, toValue(item)),
    label: typeof item === 'object' ? String(item.day || item.label || '') : '',
    change: typeof item === 'object' ? Number(item.change ?? 0) : null,
    index,
  }));

  const fallback = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, points.length - 1));

  return points.map((point, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      ...point,
      label: point.label || fallback[day.getDay()],
    };
  });
}

function renderSocTrendChart(rawChart) {
  const chartRoot = document.getElementById('soc-chart');
  if (!chartRoot) return;

  const series = buildSocChartSeries(rawChart);
  chartRoot.innerHTML = '';
  if (series.length === 0) return;

  chartRoot.classList.remove('loading-skeleton');
  chartRoot.classList.toggle('reduced-motion', socChartState.reducedMotion);

  const width = 640;
  const height = 210;
  const padding = { top: 20, right: 20, bottom: 44, left: 18 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(...series.map((point) => point.value), 1);
  const min = Math.min(...series.map((point) => point.value), 0);
  const range = Math.max(1, max - min);
  const average = series.reduce((sum, point) => sum + point.value, 0) / series.length;

  const toX = (index) => padding.left + (innerWidth * index) / Math.max(1, series.length - 1);
  const toY = (value) => padding.top + innerHeight - ((value - min) / range) * innerHeight;
  const baselineY = toY(average);

  const linePoints = series.map((point, index) => `${toX(index)},${toY(point.value)}`).join(' ');
  const areaPath = `M ${toX(0)} ${height - padding.bottom} L ${linePoints} L ${toX(series.length - 1)} ${height - padding.bottom} Z`;

  const last = series[series.length - 1].value;
  const prev = series[Math.max(0, series.length - 2)].value;
  const delta = last - prev;
  const deltaLabel = `${delta >= 0 ? '+' : ''}${delta}`;

  const html = `
    <div class="soc-chart-headline">
      <span class="small">7-day delta</span>
      <strong class="${delta >= 0 ? 'up' : 'down'}">${deltaLabel}</strong>
    </div>
    <svg class="soc-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="socAreaGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(77,224,255,0.45)"></stop>
          <stop offset="100%" stop-color="rgba(77,224,255,0)"></stop>
        </linearGradient>
      </defs>
      <line class="soc-chart-baseline" x1="${padding.left}" y1="${baselineY}" x2="${width - padding.right}" y2="${baselineY}"></line>
      ${series.map((point, index) => {
    const barWidth = Math.max(12, innerWidth / Math.max(7, series.length * 1.7));
    const x = toX(index) - barWidth / 2;
    const y = toY(point.value);
    const h = Math.max(4, height - padding.bottom - y);
    return `<rect class="soc-chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4"></rect>`;
  }).join('')}
      <path class="soc-chart-area" d="${areaPath}"></path>
      <polyline class="soc-chart-line" points="${linePoints}"></polyline>
      ${series.map((point, index) => `<circle class="soc-chart-dot" data-point="${index}" cx="${toX(index)}" cy="${toY(point.value)}" r="4"></circle>`).join('')}
    </svg>
    <div class="soc-chart-labels">${series.map((point) => `<span>${point.label}</span>`).join('')}</div>
    <div class="soc-chart-tooltip" role="status" aria-live="polite" hidden></div>
  `;

  chartRoot.innerHTML = html;
  chartRoot.setAttribute('aria-label', `Threat trend chart, latest ${last} events, delta ${deltaLabel}`);

  const tooltip = chartRoot.querySelector('.soc-chart-tooltip');
  const dots = [...chartRoot.querySelectorAll('.soc-chart-dot')];

  const showPoint = (index) => {
    const point = series[index];
    const previous = series[index - 1]?.value ?? point.value;
    const localDelta = point.change ?? (point.value - previous);
    const changeLabel = `${localDelta >= 0 ? '+' : ''}${localDelta}`;
    const dot = dots[index];
    if (!dot || !tooltip) return;
    dots.forEach((item) => item.classList.remove('active'));
    dot.classList.add('active');

    const x = Number(dot.getAttribute('cx'));
    const y = Number(dot.getAttribute('cy'));
    tooltip.hidden = false;
    tooltip.innerHTML = `<strong>${point.label}</strong><span>${point.value} events</span><span>Δ ${changeLabel}</span>`;
    tooltip.style.left = `${(x / width) * 100}%`;
    tooltip.style.top = `${(y / height) * 100}%`;
  };

  dots.forEach((dot, index) => {
    dot.tabIndex = 0;
    dot.addEventListener('mouseenter', () => showPoint(index));
    dot.addEventListener('focus', () => showPoint(index));
  });

  chartRoot.addEventListener('mouseleave', () => {
    if (tooltip) tooltip.hidden = true;
    dots.forEach((item) => item.classList.remove('active'));
  });

  if (!socChartState.reducedMotion) {
    requestAnimationFrame(() => chartRoot.classList.add('is-ready'));
  } else {
    chartRoot.classList.add('is-ready');
  }
}

function setSocLoadingState(isLoading) {
  ['soc-chart', 'soc-list', 'soc-timeline'].forEach((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.classList.toggle('loading-skeleton', isLoading);
  });
}

async function renderSoc(filters = {}) {
  setSocLoadingState(true);
  const query = new URLSearchParams(filters).toString();
  const data = await fetchJson(`/api/soc-preview${query ? `?${query}` : ''}`);
  if (!data?.ok || !data?.data?.data) {
    setSocLoadingState(false);
    return;
  }

  const { kpis, incidents, alerts, chart, timeline, threats } = data.data.data;
  document.getElementById('kpi-open').textContent = kpis.openIncidents;
  document.getElementById('kpi-mttr').textContent = `${kpis.mttrMinutes}m`;
  document.getElementById('kpi-analysts').textContent = kpis.activeAnalysts;

  renderSocTrendChart(chart);

  const list = document.getElementById('soc-list');
  list.innerHTML = '';
  [...alerts, ...incidents, ...threats].forEach((item) => {
    const severity = String(item.severity || item.level || 'low').toLowerCase();
    const li = document.createElement('article');
    li.className = 'list-item';
    li.dataset.severity = severity;
    li.tabIndex = 0;
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
      row.tabIndex = 0;
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
  setSocLoadingState(false);
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

function toReadableTime(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function sourceTag(source) {
  const normalized = String(source || 'SOC').toLowerCase();
  if (normalized.includes('misp')) return 'MISP';
  if (normalized.includes('endpoint')) return 'Endpoint';
  if (normalized.includes('identity')) return 'Identity';
  if (normalized.includes('email')) return 'Email';
  return 'Intel';
}

function threatIconBySeverity(raw) {
  const severity = String(raw || 'info').toLowerCase();
  if (severity === 'critical') return '⛔';
  if (severity === 'high') return '⚠';
  if (severity === 'medium') return '◉';
  if (severity === 'low') return '✓';
  return '•';
}

function renderThreatFeedSkeleton(feed, count = 4) {
  feed.innerHTML = '';
  for (let index = 0; index < count; index += 1) {
    const skeleton = document.createElement('div');
    skeleton.className = 'threat-feed-skeleton loading-skeleton';
    skeleton.innerHTML = '<div class="line"></div><div class="line"></div>';
    feed.appendChild(skeleton);
  }
}

function renderThreatFeedEmpty(feed, statusNode, message) {
  feed.innerHTML = `<div class="threat-feed-state">${message}</div>`;
  if (statusNode) statusNode.textContent = 'No matching intelligence right now.';
}

function renderThreatFeedItems(feed, statusNode, items) {
  if (!items.length) {
    renderThreatFeedEmpty(feed, statusNode, 'No intel items match the current filters. Try widening severity/source.');
    return;
  }

  feed.innerHTML = '';
  items.forEach((item, index) => {
    const article = document.createElement('article');
    const severity = String(item.severity || 'info').toLowerCase();
    const source = String(item.source || 'SOC');
    const mitre = item.mitreTags ? `<span class="threat-meta-chip">${item.mitreTags}</span>` : '';
    const statusChip = item.status ? `<span class="threat-meta-chip">${item.status}</span>` : '';
    article.className = 'threat-feed-item';
    article.style.animationDelay = `${Math.min(index, 7) * 45}ms`;
    article.innerHTML = `
      <div class="threat-feed-top">
        <div class="threat-feed-icon" aria-hidden="true">${threatIconBySeverity(severity)}</div>
        <span class="${severityBadgeClass(severity)}">${severity}</span>
      </div>
      <h3 class="threat-feed-title">${item.threat || item.title || 'Unlabeled threat signal'}</h3>
      <div class="threat-feed-meta">
        <span class="threat-meta-chip">${sourceTag(source)}</span>
        <span class="threat-meta-chip">${source}</span>
        ${statusChip}
        ${mitre}
        <span class="threat-meta-chip threat-meta-time">${toReadableTime(item.publishedAt || item.updatedAt)}</span>
      </div>
    `;
    feed.appendChild(article);
  });

  if (statusNode) statusNode.textContent = `Displaying ${items.length} curated intelligence signal${items.length === 1 ? '' : 's'}.`;
}

async function initThreatFeed() {
  const feed = document.getElementById('threat-feed');
  if (!feed) return;

  const sourceLabel = document.getElementById('threat-feed-source');
  const refreshedLabel = document.getElementById('threat-feed-refreshed');
  const severityFilter = document.getElementById('threat-filter-severity');
  const sourceFilter = document.getElementById('threat-filter-source');
  const statusNode = document.getElementById('threat-feed-status');
  const sectionCard = feed.closest('.threat-intel-card');

  const fallbackItems = [
    { threat: 'Suspicious PowerShell beaconing on finance endpoint', severity: 'high', source: 'SOC Sensor', status: 'investigating' },
    { threat: 'Credential stuffing burst blocked at identity gateway', severity: 'critical', source: 'Identity Defense', status: 'contained' },
    { threat: 'Known phishing lure observed in inbox telemetry', severity: 'medium', source: 'Email Shield', status: 'monitoring' },
  ];

  if (statusNode) statusNode.textContent = 'Loading latest intelligence…';
  renderThreatFeedSkeleton(feed);

  const response = await fetchJson('/api/threat-feed');
  let allItems = Array.isArray(response?.data?.data) ? response.data.data : [];

  if (!response.ok && allItems.length === 0) {
    allItems = fallbackItems;
    if (statusNode) statusNode.textContent = 'Live feed unavailable. Showing resilient fallback intel.';
  }

  if (sourceLabel) sourceLabel.textContent = `Source: ${response?.data?.source || (response.ok ? 'db' : 'fallback')}`;
  if (refreshedLabel) refreshedLabel.textContent = `Refreshed: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const sources = [...new Set(allItems.map((item) => String(item.source || 'SOC')))].sort((a, b) => a.localeCompare(b));
  if (sourceFilter) {
    sourceFilter.innerHTML = '<option value="all">All sources</option>';
    sources.forEach((source) => {
      const option = document.createElement('option');
      option.value = source;
      option.textContent = source;
      sourceFilter.appendChild(option);
    });
  }

  const applyFilters = () => {
    const severityValue = severityFilter?.value || 'all';
    const sourceValue = sourceFilter?.value || 'all';
    const filtered = allItems
      .filter((item) => (severityValue === 'all' ? true : String(item.severity || 'info').toLowerCase() === severityValue))
      .filter((item) => (sourceValue === 'all' ? true : String(item.source || 'SOC') === sourceValue))
      .slice(0, 8);

    renderThreatFeedItems(feed, statusNode, filtered);
  };

  if (allItems.length === 0) {
    renderThreatFeedEmpty(feed, statusNode, 'No threat intel available yet. Feed will repopulate automatically on next refresh.');
  } else {
    applyFilters();
  }

  if (severityFilter) severityFilter.addEventListener('change', applyFilters);
  if (sourceFilter) sourceFilter.addEventListener('change', applyFilters);
  if (sectionCard) sectionCard.setAttribute('aria-busy', 'false');
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

function setResultState(node, state, message) {
  if (!node) return;
  node.dataset.state = state || '';
  node.textContent = message || '';
}

function initPortalForm() {
  const form = document.getElementById('portal-login');
  const result = document.getElementById('portal-result');
  const userBox = document.getElementById('portal-user');
  const submit = document.getElementById('portal-submit');
  if (!form || !result) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const oldLabel = submit?.textContent;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Signing in…';
      submit.setAttribute('aria-busy', 'true');
    }
    setResultState(result, 'loading', 'Validating credentials…');

    const login = await fetchJson('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });

    if (!login.ok) {
      setResultState(result, 'error', `Login failed: ${login.data?.error || 'invalid credentials'}`);
      if (userBox) userBox.textContent = '';
    } else {
      localStorage.setItem('portal_token', login.data.token);
      setResultState(result, 'success', 'Signed in successfully.');
      if (userBox) userBox.textContent = `Role: ${login.data.user.role} | ${login.data.user.email}`;
    }

    if (submit) {
      submit.disabled = false;
      submit.textContent = oldLabel || 'Sign in';
      submit.removeAttribute('aria-busy');
    }
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
    setResultState(authResult, 'loading', 'Authenticating…');
    const login = await fetchJson('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!login.ok) {
      setResultState(authResult, 'error', `Login failed: ${login.data?.error || 'unauthorized'}`);
      return;
    }
    localStorage.setItem('portal_token', login.data.token);
    setResultState(authResult, 'success', 'Authenticated. Loading overview…');
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