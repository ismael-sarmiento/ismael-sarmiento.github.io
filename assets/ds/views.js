// One page view for the private panel (IsPanel): a single anonymous beacon to the isa-forms Worker, which keeps only
// the site and the approximate city Cloudflare derives from the network. No cookie, no storage, no identifier; visitors
// who ask not to be tracked (Do Not Track, Global Privacy Control) are not counted. Only on the published site.
const HIT = 'https://isa-forms.ismaelantonio-professional.workers.dev/hit';

export function countView() {
  try {
    if (location.hostname !== 'ismael-sarmiento.github.io' || navigator.webdriver) return;
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
    navigator.sendBeacon?.(HIT, JSON.stringify({ p: location.pathname }));
  } catch { /* never in the way of the page */ }
}
