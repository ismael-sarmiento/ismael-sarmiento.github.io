// Portada (Inicio): design-system behaviour, languages (?lang=en, as in IsAcademy) and the intro shared with CV Online.
import { initDesignSystem } from '/assets/ds/ds.js';
import { createI18n } from '/assets/ds/i18n.js';
import { initIntro } from '/assets/ds/intro.js';

const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';
const i18n = createI18n({ base: 'https://ismael-sarmiento.github.io/', dict: code => `/i18n/${code}.json?v=${VERSION}` });

initDesignSystem();
// the hero is the first screen: it rises on load (staggered), never waiting for a scroll that may not come; while the
// intro is open it waits underneath and rises when the intro closes (/assets/ds/intro.css)
document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('in'));
i18n.start();
initIntro({ i18n });
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
