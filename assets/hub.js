// Portada (Inicio): design-system behaviour, languages (?lang=en, as in IsAcademy), the intro shared with IsProfile and
// Alan, the assistant of every site, fed with the public story of this page (tools/build.py → #alan-data).
import { initDesignSystem } from '/assets/ds/ds.js';
import { createI18n } from '/assets/ds/i18n.js';
import { initIntro } from '/assets/ds/intro.js';

const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';
const i18n = createI18n({ base: 'https://isuniverse.dev/', dict: code => `/i18n/${code}.json?v=${VERSION}` });

// Alan speaks the language of the page; his buttons take the visitor to the CV, IsAcademy, GitHub or the mail
async function initAlan() {
  const node = document.getElementById('alan-data');
  if (!node) return;
  const { createAssistant, faqMatcher } = await import('/assets/ds/assistant.js');
  if (globalThis.isaStartup.isFailed()) return;
  const data = JSON.parse(node.textContent);
  const cfg = lang => ({ ...data[lang].assistant, match: faqMatcher(data[lang].faq) });
  // pages of the universe open here; WhatsApp, LinkedIn and GitHub open beside it
  const go = href => (/^https?:/.test(href) && !href.startsWith(location.origin) ? window.open(href, '_blank', 'noopener,noreferrer') : (location.href = href));
  const alan = createAssistant({ ...cfg(i18n.lang()), onAction: ({ href }) => { if (href) go(href); } });
  i18n.onChange(lang => alan.refresh(cfg(lang)));
  // never on top of the intro
  const intro = document.getElementById('intro');
  if (intro && !intro.hidden) {
    alan.tuck(true);
    new MutationObserver(() => { if (intro.hidden) alan.tuck(false); }).observe(intro, { attributes: true, attributeFilter: ['hidden'] });
  }
}

async function boot() {
  const startup = globalThis.isaStartup;
  if (!startup) {
    document.documentElement.classList.remove('js', 'i18n-wait');
    const intro = document.getElementById('intro');
    if (intro) intro.hidden = true;
    return;
  }
  if (startup.isFailed()) return;
  initDesignSystem();
  // the hero is the first screen: it rises on load (staggered), never waiting for a scroll that may not come; while the
  // intro is open it waits underneath and rises when the intro closes (/assets/ds/intro.css)
  document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('in'));
  // The privacy page shares the site's language controls, with its own document title.
  if (document.body.classList.contains('privacy-page')) {
    i18n.onChange(lang => {
      document.title = `${lang === 'en' ? 'Privacy' : 'Privacidad'} · Ismael Sarmiento`;
      document.querySelector('meta[name="description"]')?.setAttribute('content', lang === 'en'
        ? 'Data, retention, providers and rights across Ismael Sarmiento’s websites.'
        : 'Datos, conservación, proveedores y derechos de las webs de Ismael Sarmiento.');
    });
  }
  await i18n.start();
  if (startup.isFailed()) return;
  initIntro({ i18n });
  startup.ready();
  void initAlan().catch(() => console.warn('Alan is unavailable.'));
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
}

boot().catch(() => globalThis.isaStartup?.fail());
