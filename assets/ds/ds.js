// Ismael Sarmiento design system — behaviour shared by the portada and CV Online (same as IsAcademy).
// Theme (and the tab icon that follows it), reveal on scroll, top bar shadow + reading progress and the card spotlight.
import { syncFavicon } from './favicon.js';
import { escapeForeignFrame } from './frame-guard.js';
import { countView } from './views.js';

// The theme choice is shared by every site on this origin, IsAcademy included ('isa-theme' is its historical key).
const THEME_KEY = 'isa-theme';
const media = matchMedia('(prefers-color-scheme: dark)');
const themeListeners = [];
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function stored() { try { return localStorage.getItem(THEME_KEY); } catch { return null; } }
function store(v) { try { localStorage.setItem(THEME_KEY, v); } catch { /* storage unavailable */ } }

export function isDark() {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : media.matches;
}
export function onThemeChange(fn) { themeListeners.push(fn); }
const notify = () => { syncFavicon(); themeListeners.forEach(fn => fn(isDark())); };

export function initTheme() {
  const s = stored();
  if (s === 'light' || s === 'dark') document.documentElement.dataset.theme = s;
  syncFavicon();
  media.addEventListener('change', notify);
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-action="theme"]')) return;
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store(next);
    notify();
  });
}

// reveal on scroll (elements with .reveal get .in once)
let revealObserver;
export function observeReveals() {
  revealObserver ??= new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal:not(.in)').forEach(el => revealObserver.observe(el));
}

// top bar: soft shadow once the page scrolls and a thin reading-progress line
export function initTopbar() {
  const bar = document.querySelector('.topbar');
  if (!bar) return;
  const progress = bar.querySelector('.read-progress');
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.classList.toggle('scrolled', scrollY > 8);
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// cards: a faint light that follows the pointer (mouse only, never on touch or reduced motion)
export function initSpotlight() {
  if (reducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.addEventListener('pointermove', e => {
    const card = e.target.closest?.('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

export function initDesignSystem() {
  escapeForeignFrame();   // first of all: never inside another site's frame
  initTheme();
  initTopbar();
  initSpotlight();
  observeReveals();
  countView();       // one anonymous page view for IsPanel's map of cities
}
