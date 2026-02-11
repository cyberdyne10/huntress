const API_BASE = window.location.origin.startsWith('http') ? '' : 'http://localhost:3001';

async function fetchJson(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error('request failed');
    return await res.json();
  } catch (_err) {
    return null;
  }
}

async function initBooking() {
  const slotSelect = document.getElementById('slotId');
  const bookingForm = document.getElementById('booking-form');
  const bookingResult = document.getElementById('booking-result');
  if (!slotSelect || !bookingForm) return;

  const slots = await fetchJson('/api/demo-slots');
  (slots?.data || []).forEach((slot) => {
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

    try {
      const res = await fetch(`${API_BASE}/api/demo-bookings`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await res.json();
      bookingResult.textContent = res.ok
        ? `Booked! Confirmation ${body.data.id}. Reminder: ${body.integrations.notifications.reminderAt}`
        : `Booking failed: ${body.error || 'Invalid input'}`;
    } catch (_err) {
      bookingResult.textContent = 'Backend unavailable. Start API on port 3001 to enable booking.';
    }
  });
}

async function initSocPreview() {
  const socRoot = document.getElementById('soc-preview');
  if (!socRoot) return;
  const data = await fetchJson('/api/soc-preview');
  if (!data?.data) return;
  const { kpis, incidents, alerts, chart } = data.data;
  document.getElementById('kpi-open').textContent = kpis.openIncidents;
  document.getElementById('kpi-mttr').textContent = `${kpis.mttrMinutes}m`;
  document.getElementById('kpi-analysts').textContent = kpis.activeAnalysts;

  const bars = document.getElementById('soc-chart');
  chart.forEach((value) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.max(20, value * 4)}px`;
    bars.appendChild(bar);
  });

  const list = document.getElementById('soc-list');
  [...alerts, ...incidents].forEach((item) => {
    const li = document.createElement('div');
    li.className = 'list-item';
    li.dataset.severity = item.severity || item.level || 'low';
    li.innerHTML = `<strong>${item.id}</strong> - ${item.title || item.summary} <span class="badge">${li.dataset.severity}</span>`;
    list.appendChild(li);
  });

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.filter;
      document.querySelectorAll('#soc-list .list-item').forEach((item) => {
        item.style.display = key === 'all' || item.dataset.severity === key ? 'block' : 'none';
      });
    });
  });
}

async function initThreatFeed() {
  const feed = document.getElementById('threat-feed');
  if (!feed) return;
  const data = await fetchJson('/api/threat-feed');
  (data?.data || []).slice(0, 5).forEach((item) => {
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

  const recalc = () => {
    const endpoints = Number(document.getElementById('endpoints').value || 0);
    const users = Number(document.getElementById('users').value || 0);
    const services = [...document.querySelectorAll('input[name="service"]:checked')].length;
    const monthly = endpoints * 6 + users * 3 + services * 250 + 299;
    output.textContent = `Estimated monthly investment: $${monthly.toLocaleString()}`;
  };

  form.addEventListener('input', recalc);
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
  if (!form || !result) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    result.textContent = 'MVP mode: authentication is placeholder-only. Integrate SSO/IdP in production.';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBooking();
  initSocPreview();
  initThreatFeed();
  initPricingCalc();
  initFilterSearch('case-study-list', 'case-search');
  initFilterSearch('resource-list', 'resource-search');
  initPortalForm();
});
