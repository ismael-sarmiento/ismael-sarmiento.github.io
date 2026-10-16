// The tab icon follows the theme of the page, on every site. In <head> each site lists the light and the dark icon
// with media queries (the system theme decides before any script runs); once the visitor picks a theme on the site,
// that one wins. Icons: tools/icons.py → /assets/brand/favicon-{light,dark}.svg and -32.png (Safari).
//
//   <link rel="icon" href="/assets/brand/favicon-light.svg" type="image/svg+xml" media="(prefers-color-scheme: light)" data-theme-icon="light">
export function syncFavicon() {
  const forced = document.documentElement.dataset.theme;
  document.querySelectorAll('link[data-theme-icon]').forEach(link => {
    const media = forced ? (forced === link.dataset.themeIcon ? 'all' : 'not all') : `(prefers-color-scheme: ${link.dataset.themeIcon})`;
    if (link.media === media) return;
    // a fresh element: browsers re-read the icon when a link is inserted, not always when its media changes
    const next = link.cloneNode();
    next.media = media;
    link.replaceWith(next);
  });
}
