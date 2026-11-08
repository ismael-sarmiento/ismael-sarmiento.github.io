// Anti-clickjacking for every site (IsAcademy keeps its own copy in js/core/frame-guard.js): GitHub Pages cannot send
// frame-ancestors, so a page refuses to live inside another site's frame. Same-origin frames (the owner's own pages,
// device previews, QA harnesses) are allowed.
export function escapeForeignFrame() {
  if (window.top === window.self) return false;
  let sameOrigin = false;
  try { sameOrigin = window.top.location.origin === window.location.origin; } catch { /* cross-origin frame */ }
  if (sameOrigin) return false;
  try { window.top.location.replace(window.location.href); } catch { document.body.hidden = true; }
  return true;
}
