// Portada: design-system behaviour, languages (?lang=en, as in IsAcademy) and the animated signature.
import { initDesignSystem } from '/assets/ds/ds.js';
import { createI18n } from '/assets/ds/i18n.js';
import { playSignature } from '/assets/ds/signature.js';

const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';
const i18n = createI18n({ base: 'https://ismael-sarmiento.github.io/', dict: code => `/i18n/${code}.json?v=${VERSION}` });

initDesignSystem();
i18n.start();
document.querySelectorAll('.hero-name .sig').forEach(svg => playSignature(svg));
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
