(() => {
  const module = document.querySelector('[data-soc-module]');
  if (!module) return;

  const tabs = Array.from(module.querySelectorAll('[role="tab"]'));
  const panels = Array.from(module.querySelectorAll('[data-soc-panel]'));
  const detailPane = module.querySelector('.soc-detail-pane');

  const setActive = (tab, { focus = false } = {}) => {
    const targetId = tab.dataset.socTarget;

    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel.id === targetId;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });

    if (focus) {
      const panel = module.querySelector(`#${targetId}`);
      if (panel) panel.focus();
    }
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActive(tab));

    tab.addEventListener('keydown', (event) => {
      const currentIndex = tabs.indexOf(tab);
      let nextIndex = currentIndex;

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabs.length - 1;
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setActive(tab, { focus: true });
        return;
      } else {
        return;
      }

      event.preventDefault();
      tabs[nextIndex].focus();
      setActive(tabs[nextIndex]);
    });
  });

  let startX = 0;
  let endX = 0;

  const onTouchStart = (event) => {
    startX = event.changedTouches[0].clientX;
  };

  const onTouchEnd = (event) => {
    endX = event.changedTouches[0].clientX;
    const delta = startX - endX;
    if (Math.abs(delta) < 50) return;

    const activeIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    if (activeIndex < 0) return;

    const nextIndex = delta > 0
      ? (activeIndex + 1) % tabs.length
      : (activeIndex - 1 + tabs.length) % tabs.length;

    setActive(tabs[nextIndex]);
    tabs[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  detailPane?.addEventListener('touchstart', onTouchStart, { passive: true });
  detailPane?.addEventListener('touchend', onTouchEnd, { passive: true });
})();
