(() => {
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function fetchJson(path) {
    try {
      const response = await fetch(path, { headers: { accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, data };
    } catch {
      return { ok: false, data: null };
    }
  }

  function animateValue(node, nextValue, formatter = (value) => String(value)) {
    if (!node) return;
    const currentRaw = Number(node.dataset.value || node.textContent.replace(/[^\d.]/g, '') || 0);
    const target = Number(nextValue);
    if (Number.isNaN(target)) return;

    node.dataset.value = String(target);
    if (prefersReducedMotion) {
      node.textContent = formatter(target);
      return;
    }

    const start = performance.now();
    const duration = 500;
    const delta = target - currentRaw;
    node.classList.add('is-updating');

    const frame = (timestamp) => {
      const progress = Math.min(1, (timestamp - start) / duration);
      const value = currentRaw + (delta * progress);
      node.textContent = formatter(Math.round(value));
      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        node.classList.remove('is-updating');
      }
    };

    window.requestAnimationFrame(frame);
  }

  function initCommandStrip() {
    const metrics = [...document.querySelectorAll('.command-metric')];
    if (!metrics.length) return;

    const incidentsNode = document.getElementById('cmd-incidents');
    const blockedNode = document.getElementById('cmd-blocked');
    const mttrNode = document.getElementById('cmd-mttr');
    const analystNode = document.getElementById('cmd-analyst');

    const fallback = {
      incidents: Number(incidentsNode?.dataset.fallback || 5),
      blocked: Number(blockedNode?.dataset.fallback || 184),
      mttr: Number(mttrNode?.dataset.fallback || 19),
      analysts: Number(analystNode?.dataset.fallback || 7),
    };

    let rotateIndex = 0;
    setInterval(() => {
      metrics.forEach((item, index) => item.classList.toggle('is-active', index === rotateIndex));
      rotateIndex = (rotateIndex + 1) % metrics.length;
    }, 2600);

    const applyData = (next) => {
      animateValue(incidentsNode, next.incidents);
      animateValue(blockedNode, next.blocked);
      animateValue(mttrNode, next.mttr, (value) => `${value}m`);
      animateValue(analystNode, next.analysts);
    };

    const refresh = async () => {
      const [socRes, geoRes] = await Promise.all([
        fetchJson('/api/soc-preview'),
        fetchJson('/api/threat-geo-events'),
      ]);

      const incidents = socRes?.data?.data?.kpis?.openIncidents;
      const mttr = socRes?.data?.data?.kpis?.mttrMinutes;
      const analysts = socRes?.data?.data?.kpis?.activeAnalysts;
      const blocked = geoRes?.data?.data?.length;

      applyData({
        incidents: Number.isFinite(incidents) ? incidents : fallback.incidents,
        blocked: Number.isFinite(blocked) ? blocked * 12 : fallback.blocked,
        mttr: Number.isFinite(mttr) ? mttr : fallback.mttr,
        analysts: Number.isFinite(analysts) ? analysts : fallback.analysts,
      });
    };

    refresh();
    setInterval(refresh, 30000);
  }

  function pulseClass(severity) {
    const level = String(severity || 'medium').toLowerCase();
    return `severity-pulse severity-pulse-${['critical', 'high', 'medium', 'low'].includes(level) ? level : 'medium'}`;
  }

  function initAttackTicker() {
    const listNode = document.getElementById('attack-ticker-list');
    if (!listNode) return;
    const statusNode = document.getElementById('attack-ticker-status');
    const pauseBtn = document.getElementById('attack-ticker-pause');
    const prevBtn = document.getElementById('attack-ticker-prev');
    const nextBtn = document.getElementById('attack-ticker-next');

    let allEvents = [];
    let startIndex = 0;
    let paused = false;

    const render = () => {
      const windowSize = window.innerWidth < 768 ? 3 : 5;
      if (!allEvents.length) {
        listNode.innerHTML = '<div class="threat-feed-state">No flow telemetry available yet.</div>';
        if (statusNode) statusNode.textContent = 'Ticker idle; waiting for feed.';
        return;
      }

      const events = Array.from({ length: Math.min(windowSize, allEvents.length) }).map((_, offset) => {
        const index = (startIndex + offset) % allEvents.length;
        return allEvents[index];
      });

      listNode.innerHTML = '';
      events.forEach((event) => {
        const row = document.createElement('article');
        const severity = String(event.severity || 'medium').toLowerCase();
        row.className = 'attack-ticker-item';
        row.innerHTML = `
          <div>
            <p class="attack-ticker-flow"><span class="${pulseClass(severity)}" aria-hidden="true"></span>${event.origin?.label || 'Unknown'} → ${event.target?.label || 'Unknown'}</p>
            <p class="attack-ticker-meta">${event.label || 'Threat flow'} · ${severity.toUpperCase()}</p>
          </div>
          <span class="badge badge-${severity}">${severity}</span>
        `;
        listNode.appendChild(row);
      });

      if (statusNode) statusNode.textContent = `Showing ${events.length} of ${allEvents.length} recent threat flows.`;
    };

    const advance = (step = 1) => {
      if (!allEvents.length) return;
      startIndex = (startIndex + step + allEvents.length) % allEvents.length;
      render();
    };

    const refresh = async () => {
      const response = await fetchJson('/api/threat-geo-events');
      if (!response.ok || !Array.isArray(response?.data?.data)) {
        allEvents = [
          { origin: { label: 'London' }, target: { label: 'Lagos' }, severity: 'high', label: 'Credential stuffing burst' },
          { origin: { label: 'Frankfurt' }, target: { label: 'Abuja' }, severity: 'critical', label: 'C2 callback blocked' },
          { origin: { label: 'Singapore' }, target: { label: 'Nairobi' }, severity: 'medium', label: 'Suspicious reconnaissance' },
        ];
      } else {
        allEvents = response.data.data;
      }
      render();
    };

    let timer = setInterval(() => {
      if (!paused) advance(1);
    }, prefersReducedMotion ? 4500 : 2800);

    pauseBtn?.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', String(paused));
    });
    prevBtn?.addEventListener('click', () => advance(-1));
    nextBtn?.addEventListener('click', () => advance(1));

    refresh();
    setInterval(refresh, 45000);

    window.addEventListener('beforeunload', () => clearInterval(timer));
  }

  function initConversionRail() {
    const rail = document.querySelector('.conversion-rail');
    if (!rail) return;

    const dismiss = document.getElementById('conversion-rail-dismiss');
    const key = 'conversion_rail_dismissed';
    if (sessionStorage.getItem(key) === '1') rail.classList.add('is-hidden');

    dismiss?.addEventListener('click', () => {
      rail.classList.add('is-hidden');
      sessionStorage.setItem(key, '1');
    });

    const footer = document.getElementById('footer-placeholder');
    if (footer && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) rail.classList.add('is-hidden');
          else if (sessionStorage.getItem(key) !== '1') rail.classList.remove('is-hidden');
        });
      }, { threshold: 0.12 });
      observer.observe(footer);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCommandStrip();
    initAttackTicker();
    initConversionRail();
  });
})();
