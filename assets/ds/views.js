// One page signal for the private panel (IsPanel). Only the path, referring origin and browser language are sent by
// this script. The Worker may separately retain Cloudflare network context when detailed traffic is enabled.
// No cookie, browser storage or persistent visitor identifier; Do Not Track and Global Privacy Control are respected.
// Only on the published site, once per document.
const HIT = 'https://isa-forms.ismaelantonio-professional.workers.dev/hit';
let counted = false;

export function countView() {
  try {
    if (counted || location.hostname !== 'ismael-sarmiento.github.io' || navigator.webdriver) return;
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
    let referrer = '';
    try {
      const source = document.referrer ? new URL(document.referrer) : null;
      if (source && ['http:', 'https:'].includes(source.protocol) && source.origin.length <= 260) referrer = source.origin;
    } catch { /* an unavailable referrer is an ordinary direct visit */ }
    const language = typeof navigator.language === 'string' && navigator.language.length <= 35
      && /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(navigator.language) ? navigator.language : '';
    counted = true;
    navigator.sendBeacon?.(HIT, JSON.stringify({ p: location.pathname, r: referrer, l: language }));
  } catch { /* never in the way of the page */ }
}
