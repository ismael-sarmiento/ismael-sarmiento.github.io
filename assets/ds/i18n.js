// Languages for every site of Ismael Sarmiento, as in IsAcademy (js/i18n.js): Spanish by default (search engines
// included), English with ?lang=en or the visitor's own choice, one page per site and no /en/ folders.
// The page is written in Spanish with data-i18n keys; the dictionaries are { "key": "text" } (flat) or nested objects.
//
//   const i18n = createI18n({ base: 'https://ismael-sarmiento.github.io/cv/', dict: code => `/cv/i18n/${code}.json?v=…` });
//   await i18n.start();      // applies ?lang / the stored choice; [data-action="lang"] buttons switch and remember it
const SUPPORTED = ['es', 'en'];
const KEY = 'isa-lang';  // shared by every site on the origin (IsAcademy's historical key)

function stored() { try { return localStorage.getItem(KEY); } catch { return null; } }
function store(v) { try { localStorage.setItem(KEY, v); } catch { /* storage unavailable */ } }

export function detectLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (SUPPORTED.includes(q)) return q;
  const s = stored();
  return SUPPORTED.includes(s) ? s : 'es';
}

export function createI18n({ base, dict: dictUrl }) {
  const cache = {}, listeners = [];
  let lang = 'es', dict = {};
  const load = code => (cache[code] ??= fetch(dictUrl(code)).then(r => r.json()));
  const t = key => dict[key] ?? key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict) ?? key;

  // keep the address, the canonical link and og tags in line with the language shown, so every version is shareable
  function syncUrl() {
    const url = new URL(location.href);
    if (lang === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
    if (url.href !== location.href) history.replaceState(history.state, '', url);
    const canonical = lang === 'en' ? `${base}?lang=en` : base;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', lang === 'en' ? 'en_GB' : 'es_ES');
  }

  async function setLang(next, persist = false) {
    lang = SUPPORTED.includes(next) ? next : 'es';
    dict = await load(lang);
    if (persist) store(lang);   // only an explicit choice is remembered
    document.documentElement.lang = lang;
    syncUrl();
    if (dict['meta.title']) document.title = t('meta.title');
    if (dict['meta.description']) document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => { el.alt = t(el.dataset.i18nAlt); });
    document.querySelectorAll('[data-i18n-href]').forEach(el => { el.setAttribute('href', t(el.dataset.i18nHref)); });
    listeners.forEach(fn => fn(lang));
  }

  async function start() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-action="lang"]')) setLang(lang === 'es' ? 'en' : 'es', true);
    });
    const first = detectLang();
    if (first !== 'es') await setLang(first); else { dict = await load('es'); listeners.forEach(fn => fn('es')); }
  }

  return { start, setLang, t, lang: () => lang, onChange: fn => listeners.push(fn) };
}
