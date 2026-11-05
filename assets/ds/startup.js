// Embedded before first paint by the three sites' generators. No imports: recovery must survive a broken module graph.
(() => {
  'use strict';
  if (globalThis.isaStartup) return;
  const root = document.documentElement;
  const cleanups = new Set();
  let state = 'pending';
  try {
    const theme = localStorage.getItem('isa-theme');
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  } catch { /* static content also works when browser storage is unavailable */ }
  root.classList.add('js');

  const stopWaiting = () => {
    clearTimeout(deadline);
    document.removeEventListener('error', entryError, true);
  };
  function fail() {
    if (state === 'failed') return;
    state = 'failed';
    stopWaiting();
    root.classList.remove('js', 'i18n-wait', 'sig-handoff');
    const intro = document.getElementById('intro');
    const heldFocus = intro?.contains(document.activeElement);
    // Release only the isolation registered by the intro, not unrelated inert content.
    for (const cleanup of cleanups) {
      try { cleanup(); } catch { /* one failed cleanup must not prevent the others */ }
    }
    cleanups.clear();
    document.body?.classList.remove('intro-open', 'entering');
    if (intro) intro.hidden = true;
    document.querySelectorAll('.intro-flyer').forEach(el => el.remove());
    if (heldFocus) {
      const title = document.querySelector('main h1');
      title?.setAttribute('tabindex', '-1');
      title?.focus({ preventScroll: true });
    }
  }
  function entryError(event) {
    if (event.target?.matches?.('script[data-startup-entry]')) fail();
  }
  const deadline = setTimeout(fail, 10000);
  document.addEventListener('error', entryError, true);
  globalThis.isaStartup = Object.freeze({
    isFailed: () => state === 'failed',
    ready() {
      if (state === 'failed') return false;
      state = 'ready';
      stopWaiting();
      return true;
    },
    fail,
    onFailure(cleanup) {
      if (state === 'failed') { cleanup(); return () => {}; }
      cleanups.add(cleanup);
      return () => cleanups.delete(cleanup);
    },
  });
})();
