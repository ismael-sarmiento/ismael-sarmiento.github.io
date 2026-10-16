// Portada (Inicio): design-system behaviour, languages (?lang=en, as in IsAcademy), the intro shared with CV Online and
// Alan, the assistant of every site, fed with the public story of this page (tools/build.py → #alan-data).
import { initDesignSystem } from '/assets/ds/ds.js';
import { createI18n } from '/assets/ds/i18n.js';
import { initIntro } from '/assets/ds/intro.js';
import { createAssistant, faqMatcher } from '/assets/ds/assistant.js';

const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';
const i18n = createI18n({ base: 'https://ismael-sarmiento.github.io/', dict: code => `/i18n/${code}.json?v=${VERSION}` });

// Alan speaks the language of the page; his buttons take the visitor to the CV, IsAcademy, GitHub or the mail
function initAlan() {
  const node = document.getElementById('alan-data');
  if (!node) return;
  const data = JSON.parse(node.textContent);
  const cfg = lang => ({ ...data[lang].assistant, match: faqMatcher(data[lang].faq) });
  const alan = createAssistant({ ...cfg('es'), onAction: ({ href }) => { if (href) location.href = href; } });
  i18n.onChange(lang => alan.refresh(cfg(lang)));
  // never on top of the intro
  const intro = document.getElementById('intro');
  if (intro && !intro.hidden) {
    alan.tuck(true);
    new MutationObserver(() => { if (intro.hidden) alan.tuck(false); }).observe(intro, { attributes: true, attributeFilter: ['hidden'] });
  }
}

initDesignSystem();
// the hero is the first screen: it rises on load (staggered), never waiting for a scroll that may not come; while the
// intro is open it waits underneath and rises when the intro closes (/assets/ds/intro.css)
document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('in'));
initAlan();
i18n.start();
initIntro({ i18n });
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
