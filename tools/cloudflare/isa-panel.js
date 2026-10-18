// isa-panel · IsPanel, the Cloudflare Worker with the private panel of Ismael Sarmiento's sites (Inicio, CV Online, IsAcademy).
// One page, only for him, in the look of the sites (it loads the shared design system /assets/ds/ of the portada):
// visits by site, day, country (interactive world map), source, page and device (Cloudflare Web Analytics through the
// GraphQL API, no cookies on the sites), the outcome of the contact forms (written by isa-forms to Workers Analytics
// Engine), the approximate cities of the page views (isa-forms /hit, also in Analytics Engine, no IP stored) and a
// security corner (last accesses to the panel, blocked requests, probes of pages that do not exist).
// Nothing about visitors is stored or shown beyond aggregated counts.
//
// Access: «Envíame el enlace» (checked by Turnstile) mails a one-use link valid for 15 minutes to PANEL_EMAIL only; the
// link leaves a signed, HttpOnly __Host- cookie for 30 days. «Cerrar todas las sesiones» (or rotating PANEL_SECRET)
// closes every open session.
//
// Deployed by hand in the Cloudflare dashboard (Workers & Pages → isa-panel → Edit code), URL:
//   https://isa-panel.ismaelantonio-professional.workers.dev
// Settings → Variables and Secrets:
//   ACCOUNT_ID        text    Cloudflare account id
//   SITE_TAG          text    Web Analytics site tag of ismael-sarmiento.github.io
//   PANEL_EMAIL       text    the only inbox that receives access links (Resend's free sender only delivers there)
//   CF_API_TOKEN      secret  API token «isa-panel» with Account Analytics: Read only
//   RESEND_API_KEY    secret  Resend API key «isa-panel» (sending access only)
//   TURNSTILE_SECRET  secret  secret key of the Turnstile widget «Universo Ismael - formularios»
//   PANEL_SECRET      secret  random signing key for links and sessions
// Bindings: PANEL_KV (Workers KV «isa-panel»): 2-minute cache of the data, the one-link-per-minute lock, used links,
// the session epoch and the last accesses (the Cache API does nothing on workers.dev).
const SITE = 'https://ismael-sarmiento.github.io';
const SITE_KEY = '0x4AAAAAAFZ7JbJ5yVIvt3uH';
const COOKIE = '__Host-isa_panel';
const SESSION_MS = 30 * 86400000, LINK_MS = 15 * 60000, CACHE_S = 120, MAX_DAYS = 180;
const SITES = { all: ['Todas las webs', ''], inicio: ['Inicio', `${SITE}/`], cv: ['CV Online', `${SITE}/cv/`], isacademy: ['IsAcademy', `${SITE}/isacademy/`] };
// world map: Natural Earth 1:110m (world-atlas), checked with Subresource Integrity in the browser
const MAP_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const MAP_SRI = 'sha384-yOCJ+8ShBm8UDqtAVtAvxTDDf4gXo5edxl/YG0FmVC5OTmqVLl7utuVGBDEeZWHf';
// ISO 3166 numeric (3 digits) + alpha-2, for every country: the map speaks numeric, Cloudflare speaks alpha-2
const ISO = '004AF008AL012DZ016AS020AD024AO660AI010AQ028AG032AR051AM533AW036AU040AT031AZ044BS048BH050BD052BB112BY056BE084BZ204BJ060BM064BT068BO070BA072BW074BV076BR086IO096BN100BG854BF108BI116KH120CM124CA132CV136KY140CF148TD152CL156CN162CX166CC170CO174KM178CG180CD184CK188CR384CI191HR192CU196CY203CZ208DK262DJ212DM214DO218EC818EG222SV226GQ232ER233EE231ET238FK234FO242FJ246FI250FR254GF258PF260TF266GA270GM268GE276DE288GH292GI300GR304GL308GD312GP316GU320GT324GN624GW328GY332HT334HM336VA340HN344HK348HU352IS356IN360ID364IR368IQ372IE376IL380IT388JM392JP400JO398KZ404KE296KI408KP410KR414KW417KG418LA428LV422LB426LS430LR434LY438LI440LT442LU446MO450MG454MW458MY462MV466ML470MT584MH474MQ478MR480MU175YT484MX583FM498MD492MC496MN500MS504MA508MZ104MM516NA520NR524NP528NL540NC554NZ558NI562NE566NG570NU574NF580MP807MK578NO512OM586PK585PW275PS591PA598PG600PY604PE608PH612PN616PL620PT630PR634QA638RE642RO643RU646RW654SH659KN662LC666PM670VC882WS674SM678ST682SA686SN690SC694SL702SG703SK705SI090SB706SO710ZA239GS724ES144LK729SD740SR744SJ748SZ752SE756CH760SY158TW762TJ834TZ764TH626TL768TG772TK776TO780TT788TN792TR795TM796TC798TV800UG804UA784AE826GB840US581UM858UY860UZ548VU862VE704VN092VG850VI876WF732EH887YE894ZM716ZW248AX535BQ531CW831GG833IM832JE499ME652BL663MF688RS534SX728SS983XK';
const enc = new TextEncoder();

// ---------- signed links and sessions ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function mac(env, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.PANEL_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const epoch = async env => (await env.PANEL_KV?.get('session-epoch')) || '1';
// link: exp.sig · session: epoch.exp.sig (raising the epoch closes every session at once)
async function signLink(env) { const exp = Date.now() + LINK_MS; return `${exp}.${await mac(env, `link.${exp}`)}`; }
async function signSession(env) { const e = await epoch(env), exp = Date.now() + SESSION_MS; return `${e}.${exp}.${await mac(env, `session.${e}.${exp}`)}`; }
async function validLink(env, token) {
  const [exp, sig] = String(token || '').split('.');
  if (!env.PANEL_SECRET || !exp || !sig || !(Number(exp) > Date.now())) return false;
  if (!same(sig, await mac(env, `link.${exp}`))) return false;
  if (await env.PANEL_KV?.get(`used:${sig}`)) return false;              // one use only
  await env.PANEL_KV?.put(`used:${sig}`, '1', { expirationTtl: 1200 });
  return true;
}
async function validSession(env, token) {
  const [e, exp, sig] = String(token || '').split('.');
  if (!env.PANEL_SECRET || !e || !exp || !sig || !(Number(exp) > Date.now()) || e !== await epoch(env)) return false;
  return same(sig, await mac(env, `session.${e}.${exp}`));
}
const cookies = req => Object.fromEntries((req.headers.get('Cookie') || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]));
const authed = (req, env) => validSession(env, cookies(req)[COOKIE]);
const where = req => [req.cf?.city, req.cf?.country].filter(Boolean).join(', ') || 'lugar desconocido';
const browserOf = ua => { ua = ua || ''; const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Otro';
  const o = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''; return o ? `${b} · ${o}` : b; };
async function remember(env, req, kind) {
  const list = (await env.PANEL_KV?.get('access-log', 'json')) || [];
  list.unshift({ t: Date.now(), kind, where: where(req), browser: browserOf(req.headers.get('User-Agent')) });
  await env.PANEL_KV?.put('access-log', JSON.stringify(list.slice(0, 12)));
}

// ---------- responses with strict headers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function secure(headers, nonce) {
  headers.set('Content-Security-Policy', [
    "default-src 'none'", `script-src 'nonce-${nonce}' https://challenges.cloudflare.com`, `style-src 'nonce-${nonce}' ${SITE}`,
    `font-src ${SITE}`, `img-src data: ${SITE}`, "connect-src 'self' https://cdn.jsdelivr.net", 'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'"].join('; '));
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Cache-Control', 'no-store');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  return headers;
}
const html = (body, status = 200, extra = {}) => {
  const nonce = b64u(crypto.getRandomValues(new Uint8Array(16)));
  return new Response(body(nonce), { status, headers: secure(new Headers({ 'Content-Type': 'text/html; charset=utf-8', ...extra }), nonce) });
};
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: secure(new Headers({ 'Content-Type': 'application/json', ...extra }), 'x') });
const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: secure(new Headers({ Location: to, ...extra }), 'x') });

// ---------- data: Cloudflare Web Analytics (GraphQL) ----------
// filters are written into the query from controlled values only (dates, the site tag, a fixed list of sites)
const lit = v => Array.isArray(v) ? `[${v.map(lit).join(', ')}]`
  : v && typeof v === 'object' ? `{${Object.entries(v).map(([k, x]) => `${k}: ${lit(x)}`).join(', ')}}` : JSON.stringify(v);
const pathFilter = site => site === 'cv' ? { requestPath_like: '/cv/%' } : site === 'isacademy' ? { requestPath_like: '/isacademy/%' }
  : site === 'inicio' ? { AND: [{ requestPath_notlike: '/cv/%' }, { requestPath_notlike: '/isacademy/%' }] } : {};
const day = d => d.toISOString().slice(0, 10);

// Cloudflare keeps every page load for the last 7 days and only a 1-in-10 sample of older ones, so the last week is
// always asked on its own (exact) and anything older in one more query (Cloudflare's estimate, flagged in the page).
const DAY = 86400000;
async function gql(env, parts) {
  const query = `query { viewer { accounts(filter: { accountTag: ${lit(env.ACCOUNT_ID)} }) { ${parts.join('\n')} } } }`;
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  const out = await res.json().catch(() => ({ errors: [{ message: `HTTP ${res.status}` }] }));
  if (out.errors?.length) throw new Error(out.errors.map(e => e.message).join('; '));
  return out.data.viewer.accounts[0] || {};
}
const DIMS = { daily: ['date', 200, 'date_ASC'], countries: ['countryName', 60, 'sum_visits_DESC'], sources: ['refererHost', 25, 'sum_visits_DESC'],
  pages: ['requestPath', 25, 'count_DESC'], devices: ['deviceType', 6, 'sum_visits_DESC'], browsers: ['userAgentBrowser', 12, 'sum_visits_DESC'],
  systems: ['userAgentOS', 12, 'sum_visits_DESC'] };

async function visits(env, days, site) {
  const since = new Date(Date.now() - (days - 1) * DAY), from = new Date(since.getTime() - days * DAY);
  const base = { siteTag: env.SITE_TAG, bot: 0 };
  const group = (alias, filter, dim, limit, order) =>
    `${alias}: rumPageloadEventsAdaptiveGroups(filter: ${lit(filter)}, limit: ${limit}${order ? `, orderBy: [${order}]` : ''}) { count sum { visits }${dim ? ` dimensions { ${dim} }` : ''} }`;
  const today = new Date(), weekAgo = new Date(today.getTime() - 6 * DAY);
  // one query may not span more than 13 weeks, so longer stretches go in slices of 90 days
  const split = (a, b) => { const out = []; for (let s = a; s <= b; s = new Date(s.getTime() + 90 * DAY)) out.push([day(s), day(new Date(Math.min(b.getTime(), s.getTime() + 89 * DAY)))]); return out; };
  const ranges = days > 7 ? [[day(weekAgo), day(today)], ...split(since, new Date(weekAgo.getTime() - DAY))] : [[day(since), day(today)]];
  const current = await Promise.all(ranges.map(([a, b]) => {
    const f = { ...base, date_geq: a, date_leq: b, ...pathFilter(site) };
    return gql(env, [group('total', f, '', 1), ...Object.entries(DIMS).map(([k, [dim, limit, order]]) => group(k, f, dim, limit, order)),
      ...['inicio', 'cv', 'isacademy'].map(s => group(`site_${s}`, { ...base, date_geq: a, date_leq: b, ...pathFilter(s) }, '', 1)),
      ...['inicio', 'cv', 'isacademy'].map(s => group(`daily_${s}`, { ...base, date_geq: a, date_leq: b, ...pathFilter(s) }, 'date', 200, 'date_ASC'))]);
  }));
  // the previous period is only compared when Cloudflare still keeps all of it (about six months); a failure there
  // never breaks the panel, it just shows «sin datos antes»
  const oldest = new Date(Date.now() - (MAX_DAYS - 1) * DAY);
  const previous = from < oldest ? [] : await Promise.all(split(from, new Date(since.getTime() - DAY)).map(([a, b]) =>
    gql(env, [group('total', { ...base, date_geq: a, date_leq: b, ...pathFilter(site) }, '', 1)]).catch(e => { console.error('previous period', e.message); return {}; })));
  const num = parts => parts.reduce((t, g) => ({ visits: t.visits + (g?.[0]?.sum?.visits || 0), views: t.views + (g?.[0]?.count || 0) }), { visits: 0, views: 0 });
  const merge = key => {
    const dim = DIMS[key][0], acc = new Map();
    for (const w of current) for (const r of w[key] || []) {
      const k = r.dimensions[dim] ?? '', o = acc.get(k) || { key: k, visits: 0, views: 0 };
      o.visits += r.sum.visits; o.views += r.count; acc.set(k, o);
    }
    const rows = [...acc.values()];
    return key === 'daily' || key === 'countries' ? rows : rows.sort((a, b) => (key === 'pages' ? b.views - a.views : b.visits - a.visits) || b.views - a.views).slice(0, 12);
  };
  const byDay = Object.fromEntries(merge('daily').map(r => [r.key, r]));
  const daily = Array.from({ length: days }, (_, i) => day(new Date(since.getTime() + i * DAY)))
    .map(d => ({ key: d, visits: byDay[d]?.visits || 0, views: byDay[d]?.views || 0 }));
  return {
    range: { since: day(since), until: day(new Date()), days, exactSince: days > 7 ? day(weekAgo) : day(since) }, total: num(current.map(w => w.total)), previous: num(previous.map(w => w.total)), daily,
    sites: Object.fromEntries(['inicio', 'cv', 'isacademy'].map(s => [s, num(current.map(w => w[`site_${s}`]))])),
    siteDaily: Object.fromEntries(['inicio', 'cv', 'isacademy'].map(s => {
      const per = {}; for (const w of current) for (const r of w[`daily_${s}`] || []) per[r.dimensions.date] = (per[r.dimensions.date] || 0) + r.sum.visits;
      return [s, daily.map(d => per[d.key] || 0)];
    })),
    countries: merge('countries').sort((a, b) => b.visits - a.visits), sources: merge('sources'), pages: merge('pages'), devices: merge('devices'), browsers: merge('browsers'), systems: merge('systems'),
  };
}

// ---------- data: contact forms (Workers Analytics Engine, written by isa-forms) ----------
// a dataset that has never received an event answers 400/422: that is «no data yet», not an error
async function aeSql(env, sql) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` }, body: sql,
  });
  if (!res.ok) return { data: [], note: res.status === 422 || res.status === 400 ? 'empty' : `HTTP ${res.status}` };
  return res.json().catch(() => ({ data: [], note: 'json' }));
}
async function forms(env, days) {
  const out = await aeSql(env, `SELECT blob1 AS site, blob2 AS outcome, SUM(_sample_interval) AS n FROM isa_forms_events
    WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY site, outcome FORMAT JSON`);
  return { rows: (out.data || []).map(r => ({ site: r.site, outcome: r.outcome, n: Number(r.n) || 0 })), note: out.note };
}
// page views by approximate city (written by isa-forms /hit since 18 October 2026); the site is one of a fixed list
async function cities(env, days, site) {
  const only = ['inicio', 'cv', 'isacademy'].includes(site) ? ` AND blob1 = '${site}'` : '';
  const out = await aeSql(env, `SELECT blob2 AS country, blob3 AS region, blob4 AS city, AVG(double1) AS lat, AVG(double2) AS lon,
    SUM(_sample_interval) AS n FROM isa_site_views WHERE timestamp > NOW() - INTERVAL '${days}' DAY${only}
    GROUP BY country, region, city ORDER BY n DESC LIMIT 300 FORMAT JSON`);
  return { rows: (out.data || []).map(r => ({ country: r.country, region: r.region, city: r.city, lat: Number(r.lat) || 0, lon: Number(r.lon) || 0, n: Number(r.n) || 0 })), note: out.note };
}

async function data(req, env, url) {
  const asked = Math.round(Number(url.searchParams.get('days')));
  const days = Number.isFinite(asked) && asked >= 1 && asked <= MAX_DAYS ? asked : 30;
  const site = Object.hasOwn(SITES, url.searchParams.get('site')) ? url.searchParams.get('site') : 'all';
  const security = { accesses: (await env.PANEL_KV?.get('access-log', 'json')) || [] };
  // cached for 2 minutes per period and site (the cache is only read after the session check); «Actualizar» skips it
  const key = `data:${days}:${site}`;
  const hit = url.searchParams.get('fresh') === '1' ? null : await env.PANEL_KV?.get(key, 'json');
  if (hit) return json({ ...hit, security, cached: true });
  try {
    const [v, f, c] = await Promise.all([visits(env, days, site), forms(env, days), cities(env, days, site)]);
    const body = { ...v, site, forms: f, cities: c, generated: new Date().toISOString() };
    await env.PANEL_KV?.put(key, JSON.stringify(body), { expirationTtl: Math.max(60, CACHE_S) });
    return json({ ...body, security });
  } catch (e) {
    console.error('data', days, site, e.message);
    return json({ error: String(e.message || e).slice(0, 300) }, 502);
  }
}

// ---------- login by link ----------
async function sendLink(req, env, url) {
  if (req.headers.get('Origin') !== url.origin) return json({ ok: false, message: 'origin' }, 403);
  const { token } = await req.json().catch(() => ({}));
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET || '');
  form.append('response', String(token || ''));
  form.append('remoteip', req.headers.get('CF-Connecting-IP') || '');
  const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }).then(r => r.json()).catch(() => ({}));
  if (!check.success || check.hostname !== url.hostname) return json({ ok: false, message: 'turnstile' }, 403);
  // one link per minute at most
  if (await env.PANEL_KV?.get('login-lock')) return json({ ok: false, message: 'wait' }, 429);
  await env.PANEL_KV?.put('login-lock', '1', { expirationTtl: 60 });
  await remember(env, req, 'link');
  const link = `${url.origin}/auth?t=${await signLink(env)}`;
  const from = where(req), browser = browserOf(req.headers.get('User-Agent'));
  const when = new Date().toLocaleString('es-ES', { timeZone: 'Atlantic/Canary', dateStyle: 'long', timeStyle: 'short' });
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY || ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'IsPanel <onboarding@resend.dev>', to: [env.PANEL_EMAIL], subject: 'Tu enlace a IsPanel',
      text: `Entra en IsPanel con este enlace (un solo uso, caduca en 15 minutos):\n${link}\n\nPedido desde ${from} (${browser}) el ${when}. Si no lo has pedido tú, ignora este correo.`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4ecdd;padding:32px 14px"><div style="max-width:520px;margin:0 auto;background:#fbf7ef;border-radius:18px;overflow:hidden">
<div style="background:#1c2547;padding:24px 28px;color:#f6f1e7"><div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#e2b25c;font-weight:700">IsPanel</div><div style="font-size:20px;font-weight:700;margin-top:4px">Tu enlace de acceso</div></div>
<div style="height:4px;background:#c8953f"></div><div style="padding:26px 28px;color:#3a4170;font-size:15px;line-height:1.6">
<p style="margin:0 0 18px">Pulsa el botón para entrar en IsPanel, tu panel privado. El enlace sirve una sola vez y caduca en 15 minutos.</p>
<a href="${esc(link)}" style="display:inline-block;background:#c8953f;color:#1c1407;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:999px">Entrar en IsPanel</a>
<p style="margin:22px 0 0;font-size:13px;color:#6d7499">Pedido desde ${esc(from)} (${esc(browser)}) el ${esc(when)}. Si no lo has pedido tú, ignora este correo: nadie puede entrar sin este enlace.</p></div></div></div>`,
    }),
  });
  return sent.ok ? json({ ok: true }) : json({ ok: false, message: 'mail' }, 502);
}

// ---------- shared look: the sites' design system plus what only the panel needs ----------
// the tab icon of the sites («Is» in gold), light or dark like the page (see /assets/ds/favicon.js)
const ICONS = ['light', 'dark'].map(t => `<link rel="icon" href="${SITE}/assets/brand/favicon-${t}.svg" type="image/svg+xml" media="(prefers-color-scheme: ${t})" data-theme-icon="${t}">
<link rel="icon" href="${SITE}/assets/brand/favicon-${t}-32.png" sizes="32x32" type="image/png" media="(prefers-color-scheme: ${t})" data-theme-icon="${t}">`).join('')
  + `<link rel="apple-touch-icon" href="${SITE}/assets/brand/apple-touch-icon.png">`;
const SYNC_ICON = `function syncIcon(){const f=document.documentElement.dataset.theme;document.querySelectorAll('link[data-theme-icon]').forEach(l=>{const m=f?(f===l.dataset.themeIcon?'all':'not all'):'(prefers-color-scheme: '+l.dataset.themeIcon+')';if(l.media===m)return;const n=l.cloneNode();n.media=m;l.replaceWith(n)})}`;
const HEAD = nonce => `<link rel="stylesheet" href="${SITE}/assets/ds/tokens.css"><link rel="stylesheet" href="${SITE}/assets/ds/base.css">${ICONS}
<script nonce="${nonce}">${SYNC_ICON};try{const t=localStorage.getItem('ispanel-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}syncIcon()</script>`;
const PANEL_TOKENS = `:root{--accent:#2e3c74;--teal:#2f8f86;--soft:var(--bg-alt);--ok:#2f8a55;--bad:#b4473b;--ink:var(--text)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--accent:#9fb0ff;--teal:#5cc8bd;--ok:#5fbf7a;--bad:#ef8a7d}}
:root[data-theme="dark"]{--accent:#9fb0ff;--teal:#5cc8bd;--ok:#5fbf7a;--bad:#ef8a7d}
@keyframes ink{to{clip-path:inset(0 0 0 0)}}@keyframes up{from{opacity:0;transform:translateY(16px)}}@keyframes rise{to{opacity:1;transform:none}}@keyframes fade{to{opacity:1}}
@keyframes grow{to{transform:scaleX(1)}}@keyframes draw{to{stroke-dashoffset:0}}@keyframes pulse{0%{transform:scale(.6);opacity:.45}100%{transform:scale(2.2);opacity:0}}`;
const page = (nonce, title, body, script) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark"><title>${esc(title)}</title>${HEAD(nonce)}
<style nonce="${nonce}">${PANEL_TOKENS}${body.css}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}</style></head>
<body>${body.html}<script nonce="${nonce}">${script}</script></body></html>`;

// ---------- login page ----------
function loginClient(SITE_KEY) {
  const status = document.getElementById('status'), btn = document.getElementById('send');
  const say = (t, cls) => { status.textContent = t; status.className = cls || ''; };
  let api = null, widget = null, waiting = null;
  const load = () => api ??= new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = () => ok(window.turnstile); s.onerror = () => { api = null; ko(new Error('turnstile')); }; document.head.append(s);
  });
  const token = async () => {
    const ts = await load();
    widget ??= ts.render('#ts', { sitekey: SITE_KEY, execution: 'execute', retry: 'never',
      callback: t => waiting?.ok(t), 'error-callback': () => { waiting?.ko(new Error('turnstile')); return true; } });
    return new Promise((ok, ko) => { const mine = waiting = { ok, ko }; ts.reset(widget); ts.execute(widget); setTimeout(() => { if (waiting === mine) ko(new Error('timeout')); }, 30000); });
  };
  btn.addEventListener('click', async () => {
    btn.disabled = true; say('Comprobando que eres tú…');
    try {
      const res = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await token() }) });
      const out = await res.json().catch(() => ({}));
      if (res.ok) say('Enviado. Revisa tu correo y pulsa «Entrar en IsPanel». El enlace sirve una vez y caduca en 15 minutos.', 'ok');
      else say(out.message === 'wait' ? 'Ya te envié un enlace hace menos de un minuto: revisa tu correo.' : 'No se ha podido enviar el enlace. Inténtalo de nuevo en un momento.', 'bad');
    } catch { say('No se ha podido hacer la comprobación antibots. Recarga la página e inténtalo de nuevo.', 'bad'); }
    finally { btn.disabled = false; }
  });
}
const loginPage = message => html(nonce => page(nonce, 'IsPanel · acceso', {
  css: `main{min-height:100vh;display:grid;place-items:center;padding:24px}.login{width:100%;max-width:440px;text-align:center;padding:36px 30px;animation:up .7s cubic-bezier(.2,.7,.2,1) both}
.logo{display:flex;align-items:baseline;justify-content:center;font-size:40px;font-weight:600;letter-spacing:-.02em;color:var(--text);margin:0 0 12px}.logo .brand-is{font-size:66px;clip-path:inset(0 100% 0 0);animation:ink 1s .1s cubic-bezier(.6,0,.2,1) forwards}
.login p{color:var(--text-2);margin:0 0 22px}#status{min-height:24px;margin:18px 0 0;font-size:14px}#status.ok{color:var(--ok)}#status.bad{color:var(--bad)}#ts{position:absolute}.foot{margin-top:22px;font-size:12px;color:var(--text-2)}`,
  html: `<main><div class="card login"><h1 class="logo"><span class="brand-is">Is</span>Panel</h1><p class="eyebrow">Tu universo en datos</p>
<p>Visitas, formularios y seguridad de Inicio, CV Online e IsAcademy. Te envío un enlace de acceso a tu correo.</p>
<button class="btn btn-primary btn-lg btn-arrow" id="send" type="button">Envíame el enlace</button><div id="ts"></div><p id="status" role="status" aria-live="polite" class="${message ? 'bad' : ''}">${esc(message || '')}</p>
<p class="foot">Privado · enlace de un solo uso · protegido con Cloudflare Turnstile</p></div></main>`,
}, `(${loginClient})(${JSON.stringify(SITE_KEY)})`));

// ---------- panel page ----------
function panelClient(SITES, MAP_URL, MAP_SRI, ISO) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const fmt = n => new Intl.NumberFormat('es-ES').format(Math.round(n || 0));
  const text = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  let days = Math.round(Number(store.get('panel-days'))) || 30, site = store.get('panel-site') || 'all';
  if (!(days >= 1 && days <= 180)) days = 30;
  if (!(site in SITES)) site = 'all';

  // ---------- labels ----------
  const regions = (() => { try { return new Intl.DisplayNames(['es'], { type: 'region' }); } catch { return null; } })();
  const flag = c => /^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...[...c].map(x => 127397 + x.charCodeAt(0))) + ' ' : '';
  const countryName = c => !c || c === 'XX' ? 'Desconocido' : c === 'T1' ? 'Red Tor' : (/^[A-Z]{2}$/.test(c) && regions?.of(c)) || c;
  const country = c => (c && c !== 'XX' && c !== 'T1' ? flag(c) : '') + countryName(c);
  const BROWSER = { ChromeMobile: 'Chrome (móvil)', MobileSafari: 'Safari (móvil)', FirefoxMobile: 'Firefox (móvil)', EdgeMobile: 'Edge (móvil)',
    SamsungBrowser: 'Samsung Internet', ChromeDerivative: 'Otro basado en Chrome', MacOSX: 'macOS', iOS: 'iOS', Android: 'Android', Windows: 'Windows', Linux: 'Linux', ChromeOS: 'ChromeOS' };
  const tech = k => BROWSER[k] || k || 'Otro';
  const source = h => {
    if (!h) return 'Directo o enlace guardado';
    if (/linkedin|lnkd\.in/.test(h)) return 'LinkedIn';
    if (/(^|\.)google\./.test(h) || h.includes('googlequicksearch')) return 'Google';
    if (/bing\./.test(h)) return 'Bing'; if (/duckduckgo/.test(h)) return 'DuckDuckGo';
    if (/github/.test(h)) return 'GitHub'; if (/tusclasesparticulares/.test(h)) return 'Tus Clases Particulares';
    if (/whatsapp/.test(h)) return 'WhatsApp'; if (/ismael-sarmiento\.github\.io/.test(h)) return 'Entre tus webs';
    if (/t\.co$|twitter|x\.com/.test(h)) return 'X (Twitter)'; if (/facebook|fb\./.test(h)) return 'Facebook';
    return h;
  };
  const KNOWN = { '/': 'Inicio', '/cv/': 'CV Online', '/isacademy/': 'IsAcademy', '/index_en.html': 'Inicio (enlace antiguo en inglés)' };
  const probe = p => !(p in KNOWN) && (/no-existe/.test(p) || /\.(php|env|asp|aspx|jsp|cgi|ini|git|bak|sql)(\/|$)|wp-|admin|login|xmlrpc/i.test(p));
  const pageName = p => KNOWN[p] || (probe(p) ? `${p} (no existe)` : p);
  const device = d => ({ desktop: 'Escritorio', mobile: 'Móvil', tablet: 'Tableta' })[String(d).toLowerCase()] || d || 'Otro';
  const OUT = { sent: ['Mensajes recibidos', 'ok'], turnstile: ['Frenados por Turnstile', 'bad'], honeypot: ['Bots en la trampa', 'bad'],
    origin: ['Desde otra web', 'bad'], invalid: ['Peticiones no válidas', 'bad'], mail_error: ['Error al enviar el correo', 'bad'] };
  const delta = (now, before) => {
    if (before < 5) return now ? '<span class="d up">sin datos antes</span>' : '<span class="d">—</span>';
    const p = Math.round((now - before) / before * 100);
    if (p > 300) return `<span class="d up">▲ ×${(now / before).toFixed(1).replace('.', ',')}</span>`;
    return `<span class="d ${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? '▲' : p < 0 ? '▼' : '='} ${Math.abs(p)} %</span>`;
  };
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };
  const when = t => new Date(t).toLocaleString('es-ES', { timeZone: 'Atlantic/Canary', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // ---------- bars, rings and counters (lengths go through the CSSOM: the CSP blocks inline style attributes) ----------
  const bars = (rows, label, value = r => r.visits) => {
    const merged = new Map();
    for (const r of rows) { const l = label(r); merged.set(l, (merged.get(l) || 0) + (value(r) || 0)); }
    const list = [...merged].map(([l, v]) => ({ l, v })).filter(r => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
    if (!list.length) return '<p class="empty">Sin datos en este periodo.</p>';
    const max = list[0].v;
    return `<ul class="bars">${list.map(r => `<li><span class="bl">${text(r.l)}</span><span class="bn">${fmt(r.v)}</span><span class="bt"><i data-w="${(r.v / max * 100).toFixed(1)}"></i></span></li>`).join('')}</ul>`;
  };
  const sizeBars = () => $$('.bt i[data-w]').forEach((i, n) => {
    i.style.transitionDelay = `${(n % 10) * 45}ms`;
    requestAnimationFrame(() => requestAnimationFrame(() => i.style.setProperty('--w', `${i.dataset.w}%`)));
  });
  const donut = (rows, label, unit = 'visitas') => {
    const merged = new Map();
    for (const r of rows) { const l = label(r); merged.set(l, (merged.get(l) || 0) + (r.visits || 0)); }
    const list = [...merged].map(([l, v]) => ({ l, v })).filter(r => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
    const total = list.reduce((t, r) => t + r.v, 0);
    if (!total) return '<p class="empty">Sin datos en este periodo.</p>';
    const R = 52, C = 2 * Math.PI * R; let at = 0;
    const arcs = list.map((r, i) => { const len = r.v / total * C; const o = `<circle class="arc c${i}" cx="70" cy="70" r="${R}" data-len="${len.toFixed(2)}" data-at="${at.toFixed(2)}" data-c="${C.toFixed(2)}"/>`; at += len; return o; }).join('');
    return `<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="${text(list.map(r => `${r.l}: ${r.v}`).join(', '))}"><circle class="track" cx="70" cy="70" r="${R}"/>${arcs}
<text x="70" y="70" class="dt" text-anchor="middle">${fmt(total)}</text><text x="70" y="88" class="ds" text-anchor="middle">${unit}</text></svg>
<ul class="legend2">${list.map((r, i) => `<li><i class="c${i}"></i><span>${text(r.l)}</span><b>${Math.round(r.v / total * 100)} %</b></li>`).join('')}</ul></div>`;
  };
  const drawDonuts = () => $$('.arc').forEach((c, n) => {
    const len = +c.dataset.len, C = +c.dataset.c;
    c.style.strokeDashoffset = `${-c.dataset.at}`;
    c.style.strokeDasharray = reduce ? `${len} ${C - len}` : `0 ${C}`;
    c.style.transitionDelay = `${n * 120}ms`;
    if (!reduce) requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDasharray = `${len} ${C - len}`; }));
  });
  const countUp = () => $$('[data-count]').forEach(el => {
    const end = Number(el.dataset.count), dec = Number(el.dataset.dec || 0);
    const show = v => { el.textContent = dec ? v.toFixed(dec).replace('.', ',') : fmt(v); };
    if (reduce || !end) return show(end);
    const t0 = performance.now(), dur = 950;
    const step = now => { const p = Math.min(1, (now - t0) / dur); show(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });

  // ---------- visits per day: a smooth line that draws itself, with a tooltip that follows the pointer ----------
  let series = [];
  const chart = daily => {
    series = daily;
    const W = Math.max(300, Math.min(1100, $('#chart').clientWidth || 760)), H = W < 500 ? 210 : 250, P = 30, max = Math.max(4, ...daily.map(d => d.views));
    const x = i => P + i * (W - 2 * P) / Math.max(1, daily.length - 1), y = v => H - P - v / max * (H - 2 * P - 8);
    const curve = k => daily.map((d, i) => [x(i), y(d[k])]).reduce((acc, [px, py], i, pts) => {
      if (!i) return `M${px.toFixed(1)},${py.toFixed(1)}`;
      const [x0, y0] = pts[i - 2] || pts[i - 1], [x1, y1] = pts[i - 1], [x3, y3] = pts[i + 1] || [px, py];
      const c1 = [x1 + (px - x0) / 6, y1 + (py - y0) / 6], c2 = [px - (x3 - x1) / 6, py - (y3 - y1) / 6];
      return `${acc} C${c1[0].toFixed(1)},${Math.min(H - P, c1[1]).toFixed(1)} ${c2[0].toFixed(1)},${Math.min(H - P, c2[1]).toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
    }, '');
    const area = `${curve('visits')} L${x(daily.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
    const ticks = [0, .5, 1].map(t => Math.round(max * t));
    const every = Math.ceil(daily.length / (W < 500 ? 4 : 7));
    const labels = daily.map((d, i) => ({ d, i })).filter(({ i }) => i % every === 0 && daily.length - 1 - i >= every / 2 || i === daily.length - 1);
    const dm = s => new Date(s + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const last = daily.length - 1;
    chart.geom = { W, P, x, y, dm };
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Visitas y páginas vistas por día"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="s0"/><stop offset=".6" class="sm"/><stop offset="1" class="s1"/></linearGradient>
<linearGradient id="gl" x1="0" x2="1" y1="0" y2="0"><stop offset="0" class="l0"/><stop offset="1" class="l1"/></linearGradient></defs>
${ticks.map(t => `<line x1="${P}" x2="${W - P}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${P - 8}" y="${y(t) + 4}" class="ax" text-anchor="end">${t}</text>`).join('')}
<path d="${area}" class="area" fill="url(#g)"/><path d="${curve('views')}" class="lv" pathLength="1"/><path d="${curve('visits')}" class="li" stroke="url(#gl)" pathLength="1"/>
${daily.map((d, i) => d.visits ? `<circle cx="${x(i)}" cy="${y(d.visits)}" r="${daily.length > 40 ? 2 : 3.2}" class="pt"/>` : '').join('')}
<circle cx="${x(last)}" cy="${y(daily[last].visits)}" r="9" class="pulse"/><circle cx="${x(last)}" cy="${y(daily[last].visits)}" r="4.5" class="now"/>
<line id="guide" x1="0" x2="0" y1="${P - 6}" y2="${H - P}" class="guide"/><circle id="hot" r="6" class="hot" cx="-20" cy="-20"/>
${labels.map(({ d, i }) => `<text x="${x(i)}" y="${H - 8}" class="ax" text-anchor="middle">${dm(d.key)}</text>`).join('')}
<rect x="${P}" y="0" width="${W - 2 * P}" height="${H}" class="hit" id="hit"/></svg><div class="tip" id="tip" hidden></div>`;
  };
  const wireChart = () => {
    const svg = $('#chart svg'), hit = $('#hit'), tip = $('#tip'), guide = $('#guide'), hot = $('#hot'); if (!hit) return;
    const show = ev => {
      const { W, P, x, y, dm } = chart.geom, box = svg.getBoundingClientRect();
      const px = (ev.clientX - box.left) / box.width * W;
      const i = Math.max(0, Math.min(series.length - 1, Math.round((px - P) / ((W - 2 * P) / Math.max(1, series.length - 1)))));
      const d = series[i], gx = x(i);
      guide.setAttribute('x1', gx); guide.setAttribute('x2', gx); guide.classList.add('on');
      hot.setAttribute('cx', gx); hot.setAttribute('cy', y(d.visits));
      tip.hidden = false;
      tip.innerHTML = `<b>${dm(d.key)}</b><span><i class="tv"></i>${fmt(d.visits)} visitas</span><span><i class="tp"></i>${fmt(d.views)} páginas vistas</span>`;
      tip.style.setProperty('--x', `${Math.max(80, Math.min(box.width - 80, gx / W * box.width))}px`);
    };
    const hide = () => { tip.hidden = true; guide.classList.remove('on'); hot.setAttribute('cx', -20); };
    hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', hide);
  };

  // ---------- world map: Natural Earth countries, Equal Earth projection, drag to move, wheel or buttons to zoom ----------
  const num2a = {}; for (let i = 0; i < ISO.length; i += 5) num2a[ISO.slice(i, i + 3)] = ISO.slice(i + 3, i + 5);
  const WORLD = { x: -272, y: -134, w: 544, h: 242 };   // from Greenland to Tierra del Fuego
  let world = null, mapVisits = {}, mapCities = [], view = { ...WORLD };
  let mapMode = store.get('panel-map') === 'cities' ? 'cities' : 'countries';
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  const project = ([lon, lat]) => {
    const l = lon * Math.PI / 180, t = Math.asin(M * Math.sin(lat * Math.PI / 180)), t2 = t * t, t6 = t2 * t2 * t2;
    return [100 * l * Math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), -100 * t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
  };
  const loadWorld = async () => {
    if (world) return world;
    const topo = await (await fetch(MAP_URL, { integrity: MAP_SRI, mode: 'cors', credentials: 'omit' })).json();
    const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
    const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
    const arc = i => i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
    const ring = idx => idx.flatMap((i, k) => k ? arc(i).slice(1) : arc(i));
    // Russia and Fiji cross the 180th meridian: their western pieces are moved past the right edge instead of being drawn across the map
    const path = polys => {
      const rings = polys.map(p => p.map(ring)), lons = rings.flat(3).filter((_, i) => i % 2 === 0);
      const wrap = Math.max(...lons) > 170 && Math.min(...lons) < -170;
      return rings.map(p => p.map(r => `M${r.map(([lon, lat]) => project([wrap && lon < 0 ? lon + 360 : lon, lat]).map(v => v.toFixed(1)).join(',')).join('L')}Z`).join('')).join('');
    };
    world = topo.objects.countries.geometries.filter(g => g.id !== '010').map(g => ({
      code: num2a[g.id] || '', name: g.properties?.name || '', d: path(g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []),
    }));
    return world;
  };
  // the dots keep their size on screen while zooming
  const dotSize = () => $$('#dots circle').forEach(c => c.setAttribute('r', (c.dataset.r * view.w / WORLD.w).toFixed(2)));
  const setView = () => { $('#map svg')?.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); dotSize(); };
  const zoom = (k, cx = view.x + view.w / 2, cy = view.y + view.h / 2) => {
    const w = Math.max(60, Math.min(WORLD.w, view.w / k)), h = w * WORLD.h / WORLD.w;
    view = { x: cx - (cx - view.x) * w / view.w, y: cy - (cy - view.y) * h / view.h, w, h }; setView();
  };
  const placeName = c => c.city || c.region || 'Lugar sin determinar';
  const paintMap = () => {
    const max = Math.max(1, ...Object.values(mapVisits)), soft = mapMode === 'cities';
    $$('#map path[data-c]').forEach(p => {
      const v = mapVisits[p.dataset.c] || 0;
      p.classList.toggle('has', v > 0);
      p.setAttribute('fill-opacity', v ? (soft ? 0.22 : 0.45 + 0.55 * Math.sqrt(v / max)).toFixed(2) : '1');
    });
    const dots = $('#dots'); if (!dots) return;
    const places = soft ? mapCities.filter(c => c.lat || c.lon) : [], top = Math.max(1, ...places.map(c => c.n));
    // the biggest are drawn first, so the small ones stay on top and can be hovered
    dots.innerHTML = places.slice().sort((a, b) => b.n - a.n).map((c, i) => {
      const [x, y] = project([c.lon, c.lat]), r = 1.6 + 4.4 * Math.sqrt(c.n / top);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" data-r="${r.toFixed(2)}" class="city${i < 3 ? ' big' : ''}" data-city="${text(placeName(c))}" data-where="${text([c.region && c.region !== c.city ? c.region : '', countryName(c.country)].filter(Boolean).join(', '))}" data-cc="${text(c.country)}" data-n="${c.n}"/>`;
    }).join('');
    dotSize();
    $$('[data-mapmode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapmode === mapMode)));
    const n = soft ? places.length : Object.keys(mapVisits).length;
    $('#map-count').textContent = soft ? (n === 1 ? '1 ciudad' : `${n} ciudades`) : (n === 1 ? '1 país' : `${n} países`);
    $('#map-note').textContent = soft
      ? 'Ciudad aproximada según la red del visitante (la de su operador, no su casa). No se guarda ninguna IP; no cuenta a quien pide no ser rastreado. Se cuentan desde el 18 de octubre de 2026.'
      : 'Pasa por encima de un país para ver sus visitas. Arrastra para moverte; zoom con + y − (o Ctrl + rueda).';
  };
  // «Ciudades» frames the dots (never closer than a region), «Países» goes back to the whole world
  const fitCities = () => {
    const pts = mapMode === 'cities' ? mapCities.filter(c => c.lat || c.lon).map(c => project([c.lon, c.lat])) : [];
    if (!pts.length) { view = { ...WORLD }; return setView(); }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const w = Math.min(WORLD.w, Math.max(70, (Math.max(...xs) - Math.min(...xs)) * 1.5, (Math.max(...ys) - Math.min(...ys)) * 1.5 * WORLD.w / WORLD.h)), h = w * WORLD.h / WORLD.w;
    view = { x: cx - w / 2, y: cy - h / 2, w, h }; setView();
  };
  const placesCard = () => {
    $('#places-title').textContent = mapMode === 'cities' ? 'Ciudades' : 'Países';
    $('#places-hint').textContent = mapMode === 'cities' ? 'Páginas vistas por ciudad aproximada. Vuelve a «Países» en el mapa para verlas por país.'
      : 'Ordenados por visitas. Cambia a «Ciudades» en el mapa para verlas por ciudad.';
    $('#countries').innerHTML = mapMode === 'cities'
      ? (mapCities.length ? bars(mapCities.map(c => ({ ...c, visits: c.n })), c => `${flag(c.country)}${placeName(c)}${c.region && c.region !== c.city ? ` · ${c.region}` : ''}`)
        : '<p class="empty">Aún no hay visitas con ciudad en este periodo: se cuentan desde el 18 de octubre de 2026.</p>')
      : bars(last.countries, r => country(r.key));
    sizeBars();
  };
  const renderMap = async (rows, places) => {
    mapVisits = Object.fromEntries(rows.filter(r => r.key && r.key !== 'XX').map(r => [r.key, r.visits]));
    mapCities = places || [];
    if (!$('#map svg')) {
      try {
        const countries = await loadWorld();
        $('#map').innerHTML = `<svg viewBox="${view.x} ${view.y} ${view.w} ${view.h}" role="img" aria-label="Mapa del mundo con las visitas por país">
${countries.map(c => `<path d="${c.d}" data-c="${c.code}" data-n="${text(c.name)}"/>`).join('')}<g id="dots"></g></svg><div class="tip" id="maptip" hidden></div>
<div class="mapctl"><button class="btn btn-sm btn-icon" type="button" data-zoom="1.6" aria-label="Acercar">+</button><button class="btn btn-sm btn-icon" type="button" data-zoom="0.625" aria-label="Alejar">−</button><button class="btn btn-sm btn-icon" type="button" data-zoom="0" aria-label="Ver el mundo entero">⟲</button></div>`;
        wireMap();
      } catch { $('#map').innerHTML = '<p class="empty">No se ha podido cargar el mapa ahora mismo; tienes la lista de países al lado.</p>'; return; }
    }
    paintMap();
  };
  const wireMap = () => {
    const svg = $('#map svg'), tip = $('#maptip');
    const toMap = ev => { const b = svg.getBoundingClientRect(); return [view.x + (ev.clientX - b.left) / b.width * view.w, view.y + (ev.clientY - b.top) / b.height * view.h]; };
    let drag = null;
    svg.addEventListener('pointermove', ev => {
      if (drag) { const b = svg.getBoundingClientRect(); view.x = drag.vx - (ev.clientX - drag.x) / b.width * view.w; view.y = drag.vy - (ev.clientY - drag.y) / b.height * view.h; setView(); tip.hidden = true; return; }
      const dot = ev.target.closest('circle[data-city]'), p = dot ? null : ev.target.closest('path[data-c]');
      $$('#map .on').forEach(x => x !== p && x !== dot && x.classList.remove('on'));
      if (!p && !dot) { tip.hidden = true; return; }
      (p || dot).classList.add('on');
      const b = $('#map').getBoundingClientRect();
      if (dot) { const v = Number(dot.dataset.n); tip.innerHTML = `<b>${flag(dot.dataset.cc)}${dot.dataset.city}</b><span>${dot.dataset.where}</span><span>${fmt(v)} página${v === 1 ? '' : 's'} vista${v === 1 ? '' : 's'}</span>`; }
      else { const v = mapVisits[p.dataset.c] || 0; tip.innerHTML = `<b>${flag(p.dataset.c)}${text(countryName(p.dataset.c) || p.dataset.n)}</b><span>${v ? `${fmt(v)} visita${v === 1 ? '' : 's'}` : 'Sin visitas'}</span>`; }
      tip.hidden = false; tip.style.setProperty('--x', `${ev.clientX - b.left}px`); tip.style.setProperty('--y', `${ev.clientY - b.top}px`);
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; $$('#map .on').forEach(x => x.classList.remove('on')); });
    svg.addEventListener('pointerdown', ev => { if (ev.pointerType === 'mouse' && ev.button !== 0) return; drag = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y }; svg.setPointerCapture(ev.pointerId); svg.classList.add('dragging'); });
    const stop = () => { drag = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', stop); svg.addEventListener('pointercancel', stop);
    svg.addEventListener('wheel', ev => { if (!ev.ctrlKey && !ev.metaKey) return; ev.preventDefault(); const [cx, cy] = toMap(ev); zoom(ev.deltaY < 0 ? 1.25 : 0.8, cx, cy); }, { passive: false });
  };

  // ---------- forms and security ----------
  const formsCard = f => {
    const rows = f.rows || [];
    const total = o => rows.filter(r => r.outcome === o).reduce((s, r) => s + r.n, 0);
    const by = (s, o) => rows.filter(r => r.site === s && r.outcome === o).reduce((a, r) => a + r.n, 0);
    const used = Object.keys(OUT).filter(o => total(o));
    if (!rows.length) return `<p class="empty">${f.note && f.note !== 'empty' ? 'No se han podido leer los formularios ahora mismo.' : 'Aún no hay envíos en este periodo (se cuentan desde el 18 de octubre de 2026).'}</p>`;
    return `<table><thead><tr><th>Resultado</th><th>CV Online</th><th>IsAcademy</th><th>Total</th></tr></thead><tbody>${used.map(o =>
      `<tr><td><span class="dot ${OUT[o][1]}"></span>${OUT[o][0]}</td><td>${fmt(by('cv', o))}</td><td>${fmt(by('isacademy', o))}</td><td><b>${fmt(total(o))}</b></td></tr>`).join('')}</tbody></table>`;
  };
  const securityCard = d => {
    const blocked = (d.forms.rows || []).filter(r => !['sent', 'mail_error'].includes(r.outcome)).reduce((s, r) => s + r.n, 0);
    const probes = d.pages.filter(p => probe(p.key));
    const acc = (d.security?.accesses || []).slice(0, 6);
    const lastIn = acc.find(a => a.kind === 'access');
    return `<div class="sec-kpis"><div><span class="k">Último acceso</span><b>${lastIn ? ago(lastIn.t) : '—'}</b><small>${lastIn ? text(lastIn.where) : ''}</small></div>
<div><span class="k">Bloqueos en formularios</span><b>${fmt(blocked)}</b><small>Turnstile, origen y trampa</small></div>
<div><span class="k">Rastreos de páginas</span><b>${fmt(probes.reduce((s, p) => s + p.views, 0))}</b><small>${probes.length ? text(probes.slice(0, 2).map(p => p.key).join(' · ')) : 'ninguno'}</small></div></div>
<h3 class="sub">Accesos a IsPanel</h3>${acc.length ? `<ul class="log">${acc.map(a => `<li><span class="dot ${a.kind === 'access' ? 'ok' : 'gold'}"></span><span>${a.kind === 'access' ? 'Entrada' : 'Enlace pedido'}</span><span class="m">${when(a.t)} · ${text(a.where)} · ${text(a.browser)}</span></li>`).join('')}</ul>` : '<p class="empty">Aún no hay accesos registrados.</p>'}
<p class="note">Si ves una entrada que no es tuya, cierra todas las sesiones: el enlace solo llega a tu correo y sirve una vez.</p>
<div class="sec-actions"><button class="btn btn-sm" type="button" data-action="logout-all">Cerrar todas las sesiones</button>
<a class="btn btn-sm btn-arrow" href="https://dash.cloudflare.com/profile/authentication" target="_blank" rel="noopener">Verificación en dos pasos de Cloudflare</a>
<a class="btn btn-sm btn-arrow" href="https://github.com/settings/security" target="_blank" rel="noopener">Seguridad de GitHub</a></div>`;
  };

  // ---------- highlights: a few sentences that read the figures for you ----------
  const KPI_HELP = ['Llegadas a tus webs desde fuera (Cloudflare cuenta una visita cada vez que alguien llega desde otra web, un buscador o un enlace)',
    'Todas las páginas abiertas, también las que se ven dentro de una misma visita', 'Cuántas páginas abre de media cada visita',
    'Mensajes que llegaron a tu correo desde los formularios; los bloqueados son bots o envíos sin la comprobación antibots'];
  const longDay = s => new Date(s + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const share = (part, all) => all ? Math.round(part / all * 100) : 0;
  const insights = (d, sent, blocked) => {
    const out = [], total = d.total.visits;
    const best = d.daily.reduce((a, b) => (b.visits > a.visits ? b : a), d.daily[0] || { visits: 0 });
    if (best.visits) out.push(['★', `Tu mejor día fue el <b>${longDay(best.key)}</b>, con <b>${fmt(best.visits)}</b> visitas.`]);
    const today = d.daily.at(-1), before = d.daily.at(-2);
    if (today) out.push(['◷', `Hoy llevas <b>${fmt(today.visits)}</b> visita${today.visits === 1 ? '' : 's'}${before ? ` (ayer, ${fmt(before.visits)})` : ''}.`]);
    const from = new Map(); for (const r of d.sources) { const l = source(r.key); if (r.key && l !== 'Entre tus webs') from.set(l, (from.get(l) || 0) + r.visits); }
    const topFrom = [...from].sort((a, b) => b[1] - a[1])[0];
    if (topFrom && total) out.push(['↗', `<b>${text(topFrom[0])}</b> es lo que más visitas te trae desde fuera: el <b>${share(topFrom[1], total)} %</b>.`]);
    const known = d.countries.filter(r => r.key && r.key !== 'XX'), topC = known[0];
    if (topC && total) out.push(['◍', `El <b>${share(topC.visits, total)} %</b> llega desde ${text(country(topC.key))}; en total, <b>${known.length}</b> ${known.length === 1 ? 'país' : 'países'}.`]);
    const city = d.cities?.rows?.find(c => c.city);
    if (city) out.push(['⌖', `La ciudad que más te visita es <b>${text(city.city)}</b> (${fmt(city.n)} páginas vistas).`]);
    const phone = d.devices.filter(r => String(r.key).toLowerCase() === 'mobile').reduce((a, r) => a + r.visits, 0);
    if (total) out.push(['▯', `El <b>${share(phone, total)} %</b> te visita desde el móvil.`]);
    const page = d.pages.find(p => !probe(p.key));
    if (page) out.push(['❐', `La página más vista es <b>${text(pageName(page.key))}</b>, con ${fmt(page.views)} vistas.`]);
    if (sent || blocked) out.push(['✉', `<b>${fmt(sent)}</b> mensaje${sent === 1 ? '' : 's'} recibido${sent === 1 ? '' : 's'} y <b>${fmt(blocked)}</b> intento${blocked === 1 ? '' : 's'} de bots frenado${blocked === 1 ? '' : 's'}.`]);
    return out.slice(0, 8);
  };
  // trend per site: a small line for each web that draws itself, with a link to open it
  const spark = (vals, i) => {
    const W = 160, H = 40, max = Math.max(1, ...vals), x = k => 2 + k * (W - 4) / Math.max(1, vals.length - 1), y = v => H - 4 - v / max * (H - 8);
    const line = vals.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('');
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${line} L${x(vals.length - 1).toFixed(1)},${H} L2,${H} Z" class="sa c${i}f"/><path d="${line}" class="sl c${i}"/></svg>`;
  };
  const trends = d => ['inicio', 'cv', 'isacademy'].map((k, i) => {
    const vals = d.siteDaily?.[k] || [], week = vals.slice(-7).reduce((a, v) => a + v, 0);
    return `<li><a class="tw" href="${SITES[k][1]}" target="_blank" rel="noopener"><b>${SITES[k][0]}</b><small>${SITES[k][1].replace(/^https:\/\//, '')}</small></a>${spark(vals, i)}<span class="tn"><b>${fmt(d.sites[k]?.visits)}</b><small>${vals.length > 7 ? `${fmt(week)} en los últimos 7 días` : 'visitas'}</small></span></li>`;
  }).join('');

  // ---------- render ----------
  let last = null, first = true, refreshedAt = 0;
  const render = d => {
    const sent = (d.forms.rows || []).filter(r => r.outcome === 'sent').reduce((s, r) => s + r.n, 0);
    const blocked = (d.forms.rows || []).filter(r => !['sent', 'mail_error'].includes(r.outcome)).reduce((s, r) => s + r.n, 0);
    $('#kpis').innerHTML = [
      ['Visitas', d.total.visits, 0, delta(d.total.visits, d.previous.visits)],
      ['Páginas vistas', d.total.views, 0, delta(d.total.views, d.previous.views)],
      ['Páginas por visita', d.total.visits ? d.total.views / d.total.visits : 0, 1, '<span class="d">media</span>'],
      ['Mensajes recibidos', sent, 0, `<span class="d">${fmt(blocked)} bloqueados</span>`],
    ].map(([k, v, dec, s], i) => `<div class="card kpi" title="${KPI_HELP[i]}"><span class="k">${k}</span><span class="v" data-count="${v}" data-dec="${dec}">0</span>${s}</div>`).join('');
    $('#insights').innerHTML = insights(d, sent, blocked).map(([icon, t], i) => `<li data-j="${i}"><span class="ii" aria-hidden="true">${icon}</span><span>${t}</span></li>`).join('');
    $$('#insights li').forEach(li => li.style.setProperty('--j', li.dataset.j));
    $('[data-action="more"]').hidden = $$('#insights li').length <= 4;
    $('#trends').innerHTML = trends(d);
    $('#chart').innerHTML = chart(d.daily); $('#chart').classList.remove('static');
    $('#sites').innerHTML = donut(Object.entries(d.sites).map(([k, v]) => ({ key: SITES[k][0], visits: v.visits })), r => r.key);
    $('#sources').innerHTML = bars(d.sources, r => source(r.key));
    $('#pages').innerHTML = bars(d.pages, r => pageName(r.key), r => r.views);
    $('#devices').innerHTML = donut(d.devices, r => device(r.key));
    $('#browsers').innerHTML = bars(d.browsers, r => tech(r.key));
    $('#systems').innerHTML = bars(d.systems, r => tech(r.key));
    $('#forms').innerHTML = formsCard(d.forms);
    $('#security').innerHTML = securityCard(d);
    last = d; mapCities = d.cities?.rows || []; placesCard(); sizeBars(); drawDonuts(); countUp(); wireChart(); renderMap(d.countries, d.cities?.rows);
    $$('.site-opt [data-n]').forEach(el => { const v = d.sites[el.dataset.n]?.visits; el.textContent = v == null ? '' : `${fmt(v)} visitas`; });
    if (first) { first = false; $$('main .card').forEach((el, n) => el.style.setProperty('--i', Math.min(n, 14))); document.body.classList.add('enter'); }
    const since = new Date(d.range.since + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    $('#range').textContent = `Del ${since} a hoy (${d.range.days} ${d.range.days === 1 ? 'día' : 'días'}) · ${SITES[d.site][0]}`;
    $('#approx').hidden = d.range.days <= 7;
    $$('[data-sites-only]').forEach(e => { e.hidden = d.site !== 'all'; });
    refreshedAt = Date.parse(d.generated); tick();
  };
  const tick = () => { if (refreshedAt) $('#fresh').textContent = `Datos de ${ago(refreshedAt)}`; };

  // ---------- controls: period (presets or any number of days, weeks or months) and site ----------
  const syncControls = () => {
    const preset = [7, 30, 90].includes(days);
    $$('[data-days]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.days) === days)));
    $('[data-action="custom"]').setAttribute('aria-pressed', String(!preset));
    $('[data-action="custom"]').textContent = preset ? 'Personalizado' : `${days} días`;
    const s = SITES[site];
    $('#site-btn .sb-name').textContent = s[0]; $('#site-btn .sb-url').textContent = s[1] ? s[1].replace(/^https:\/\//, '') : 'Inicio, CV Online e IsAcademy';
    $$('.site-opt button[data-site]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.site === site)));
  };
  const load = async (fresh, gate) => {
    document.body.classList.add('loading'); $('#error').hidden = true; syncControls();
    try {
      const res = await fetch(`/api/data?days=${days}&site=${site}${fresh ? '&fresh=1' : ''}`, { headers: { Accept: 'application/json' } });
      if (res.status === 401) { location.href = '/login'; return; }
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || res.status);
      if (gate) await gate;   // the first figures appear as the opening lifts, so their animations are seen
      last = d; render(d);
    } catch (e) { $('#error').hidden = false; $('#error').textContent = `No he podido traer los datos de Cloudflare (${e.message}). Prueba a recargar en un minuto.`; }
    finally { document.body.classList.remove('loading'); }
  };
  const menu = $('#site-menu'), siteBtn = $('#site-btn');
  const openMenu = on => { menu.hidden = !on; siteBtn.setAttribute('aria-expanded', String(on)); if (on) menu.querySelector('[aria-checked="true"]')?.focus(); };
  const custom = $('#custom');
  document.addEventListener('click', async e => {
    const b = e.target.closest('button, a'); if (!b) { if (!e.target.closest('#site-menu')) openMenu(false); return; }
    if (b === siteBtn) { openMenu(menu.hidden); return; }
    if (!b.closest('#site-menu')) openMenu(false);
    if (b.dataset.days) { days = Number(b.dataset.days); store.set('panel-days', days); custom.hidden = true; load(false); }
    else if (b.dataset.site) { site = b.dataset.site; store.set('panel-site', site); openMenu(false); load(false); }
    else if (b.dataset.action === 'custom') { custom.hidden = !custom.hidden; if (!custom.hidden) $('#custom-n').focus(); }
    else if (b.dataset.action === 'refresh') { b.classList.add('spin'); await load(true); b.classList.remove('spin'); }
    else if (b.dataset.action === 'more') { $('#insights').classList.remove('short'); b.hidden = true; }
    else if (b.dataset.mapmode) { mapMode = b.dataset.mapmode; store.set('panel-map', mapMode); if (last) { placesCard(); paintMap(); fitCities(); } }
    else if (b.dataset.zoom) { const k = Number(b.dataset.zoom); if (k) zoom(k); else { view = { ...WORLD }; setView(); } }
    else if (b.dataset.action === 'theme') {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark'; store.set('ispanel-theme', document.documentElement.dataset.theme); window.syncIcon?.();
    }
    else if (b.dataset.action === 'logout-all' && confirm('¿Cerrar todas las sesiones abiertas de IsPanel, también esta? Tendrás que pedir un enlace nuevo.')) {
      const r = await fetch('/logout-all', { method: 'POST' }); if (r.ok) location.href = '/login';
    }
  });
  custom.addEventListener('submit', e => {
    e.preventDefault();
    const n = Math.round(Number($('#custom-n').value)), unit = Number($('#custom-u').value);
    const asked = n * unit;
    if (!(n >= 1) || asked > 180) { $('#custom-msg').textContent = 'Elige entre 1 día y 6 meses (180 días): Cloudflare guarda medio año de visitas.'; return; }
    $('#custom-msg').textContent = ''; days = asked; store.set('panel-days', days); custom.hidden = true; load(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { openMenu(false); custom.hidden = true; }
    if (!menu.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const items = $$('.site-opt button[data-site]'), i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); e.preventDefault();
    }
  });
  let timer = 0;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { if (last) { $('#chart').innerHTML = chart(last.daily); $('#chart').classList.add('static'); wireChart(); } }, 150); });
  // the figures refresh themselves every 5 minutes while the page is on screen; «Actualizar» does it at once
  setInterval(() => { tick(); if (document.visibilityState === 'visible' && Date.now() - refreshedAt > 5 * 60000) load(true); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && refreshedAt && Date.now() - refreshedAt > 5 * 60000) load(true); });
  // opening: the «Is» is inked, «Panel» rises, and the curtain lifts once the data is in (a click skips it)
  const intro = $('#intro');
  const lift = () => { if (!intro || intro.classList.contains('out')) return; intro.classList.add('out'); setTimeout(() => intro.remove(), 900); };
  if (reduce || !intro) { intro?.remove(); load(false); }
  else { let open; const gate = new Promise(r => { open = r; setTimeout(r, 1900); }); intro.addEventListener('click', () => open()); gate.then(lift); load(false, gate); }
}

const ICON_SUN = '<svg class="i-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_MOON = '<svg class="i-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICON_LINK = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_REFRESH = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const panelPage = () => html(nonce => page(nonce, 'IsPanel', {
  css: `.topbar .sp{flex:1}.tag{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-2);padding-left:14px;border-left:1px solid var(--line)}
.brand .brand-name{font-weight:600}.tools{display:flex;gap:8px;align-items:center}.spin svg{animation:turn .8s linear infinite}@keyframes turn{to{transform:rotate(360deg)}}
main{padding:26px 0 46px}.controls{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;justify-content:space-between;margin-bottom:8px}.periods{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.site-pick{position:relative;z-index:20}#site-btn{min-width:260px;justify-content:space-between;text-align:left}#site-btn .sb{display:grid;line-height:1.2}#site-btn .sb-url{font-size:12px;color:var(--text-2);font-weight:400}
#site-btn::after{content:'▾';color:var(--gold-text);margin-left:10px}
#site-menu{position:absolute;right:0;top:calc(100% + 8px);width:min(400px,calc(100vw - 32px));padding:8px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius,18px);box-shadow:0 18px 40px rgba(10,14,35,.22);animation:up .25s cubic-bezier(.2,.7,.2,1)}
.site-opt{display:grid;grid-template-columns:1fr auto;align-items:center;border-radius:12px}.site-opt:hover{background:var(--bg-alt)}
.site-opt button{all:unset;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:10px 12px;border-radius:12px}.site-opt button:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}
.site-opt b{color:var(--text);font-weight:600}.site-opt small{grid-column:1;font-size:12px;color:var(--text-2)}.site-opt [data-n]{grid-row:1;grid-column:2;font-size:12px;color:var(--gold-text);white-space:nowrap}.site-opt small{overflow-wrap:anywhere}
.site-opt button[aria-checked="true"] b::before{content:'● ';color:var(--gold)}.site-opt a{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;color:var(--text-2)}.site-opt a:hover{color:var(--gold-text);background:var(--surface)}
#custom{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 6px;padding:12px 14px;border:1px dashed var(--line);border-radius:14px;animation:up .25s}
#custom input,#custom select{font:inherit;min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)}#custom input{width:90px}#custom-msg{flex-basis:100%;margin:0;font-size:13px;color:var(--bad)}#custom-msg:empty{display:none}
#range{color:var(--text-2);font-size:13px;margin:10px 0 4px}#fresh{color:var(--text-2);font-size:12px}#approx{margin:6px 0 18px;font-size:12.5px;color:var(--text-2);border-left:3px solid var(--gold);padding:4px 0 4px 10px}
#error{background:color-mix(in srgb,var(--bad) 12%,var(--surface));color:var(--bad);border-radius:14px;padding:12px 16px;margin:10px 0 16px}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:16px 0}.kpi{display:grid;gap:2px;overflow:hidden}
.kpi::before{content:'';position:absolute;inset:auto 0 0 0;height:3px;background:linear-gradient(90deg,var(--gold),var(--gold-300),var(--gold))}
.k{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-2);font-weight:700}.v{font-size:34px;font-weight:700;color:var(--text);line-height:1.15;font-variant-numeric:tabular-nums}
.d{font-size:13px;color:var(--text-2)}.d.up{color:var(--ok)}.d.down{color:var(--bad)}
.card h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text);margin:0 0 14px;display:flex;justify-content:space-between;gap:10px}.card h2 small{letter-spacing:0;text-transform:none;color:var(--text-2);font-weight:500}
.grid2,.grid3,.mapgrid{display:grid;gap:16px;margin-top:16px}.grid2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid3{grid-template-columns:repeat(3,minmax(0,1fr))}.mapgrid{grid-template-columns:minmax(0,2.1fr) minmax(0,1fr)}
svg{width:100%;height:auto;display:block}.grid{stroke:var(--line);stroke-dasharray:2 4}.ax{fill:var(--text-2);font-size:11px}
#chart{position:relative}.li{fill:none;stroke-width:3;stroke-linecap:round;filter:drop-shadow(0 6px 10px rgba(200,149,63,.35));stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.5s .2s cubic-bezier(.6,0,.2,1) forwards}
.lv{fill:none;stroke:var(--accent);stroke-width:1.6;opacity:.55;stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.5s .35s cubic-bezier(.6,0,.2,1) forwards}
.area{opacity:0;transform-box:fill-box;transform-origin:bottom;transform:scaleY(.3);animation:rise 1.1s .5s cubic-bezier(.2,.7,.2,1) forwards}
.pt{fill:var(--surface);stroke:var(--gold);stroke-width:2;opacity:0;animation:fade .4s 1.2s forwards}.now{fill:var(--gold)}.pulse{fill:var(--gold);opacity:.35;transform-box:fill-box;transform-origin:center;animation:pulse 2s 1.6s ease-out infinite}
#chart.static .li,#chart.static .lv,#chart.static .area,#chart.static .pt{animation:none;stroke-dashoffset:0;opacity:1;transform:none}#chart.static .lv{opacity:.55}
.s0{stop-color:var(--gold);stop-opacity:.5}.sm{stop-color:var(--gold);stop-opacity:.14}.s1{stop-color:var(--gold);stop-opacity:0}.l0{stop-color:var(--gold-600)}.l1{stop-color:var(--gold-300)}
.hit{fill:transparent;cursor:crosshair;touch-action:pan-y}.guide{stroke:var(--gold);stroke-width:1;stroke-dasharray:3 3;opacity:0;transition:opacity .15s}.guide.on{opacity:.8}.hot{fill:var(--gold);stroke:var(--surface);stroke-width:3;pointer-events:none}
.tip{position:absolute;top:6px;left:var(--x);transform:translateX(-50%);z-index:3;background:var(--ink-800);color:var(--cream-200);border:1px solid rgba(226,178,92,.35);border-radius:12px;padding:8px 12px;font-size:12.5px;display:grid;gap:2px;pointer-events:none;box-shadow:0 12px 26px rgba(0,0,0,.22);white-space:nowrap}
.tip i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}.tip .tv{background:var(--gold)}.tip .tp{background:#9fb0ff}
.legend{display:flex;gap:18px;font-size:12px;color:var(--text-2);margin-top:8px}.legend i{display:inline-block;width:18px;height:3px;border-radius:2px;background:var(--gold);vertical-align:middle;margin-right:6px}.legend .v2{background:var(--accent)}
#map{position:relative;border-radius:14px;overflow:hidden;background:radial-gradient(120% 140% at 50% 0%,color-mix(in srgb,var(--gold) 7%,transparent),transparent 70%)}
#map svg{cursor:grab;touch-action:none;user-select:none}#map svg.dragging{cursor:grabbing}
#map path{fill:color-mix(in srgb,var(--text) 7%,var(--surface));stroke:color-mix(in srgb,var(--text) 18%,var(--surface));stroke-width:.35;vector-effect:non-scaling-stroke;transition:fill .3s,stroke .2s,fill-opacity .6s}#map path.has{fill:var(--gold)}
#map path.on{stroke:var(--gold-text);stroke-width:1.4}#maptip{top:var(--y);transform:translate(-50%,calc(-100% - 12px))}
.maphead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}.seg{display:inline-flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:999px;letter-spacing:0;text-transform:none}.seg .btn{min-height:30px;padding:3px 12px;border:0}
#dots .city{fill:var(--gold);fill-opacity:.78;stroke:var(--surface);stroke-width:.7;vector-effect:non-scaling-stroke;cursor:pointer;transition:fill-opacity .2s}#dots .city.on{fill-opacity:1;stroke:var(--gold-text);stroke-width:2}
#dots .city.big{animation:ping 2.4s ease-out infinite}@keyframes ping{0%,100%{stroke-width:.7;stroke-opacity:1}50%{stroke-width:5;stroke-opacity:.35}}
.mapctl{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px}.mapctl .btn{min-height:34px;min-width:34px;padding:4px;background:var(--surface)}
.bars{list-style:none;margin:0;padding:0;display:grid;gap:10px}.bars li{display:grid;grid-template-columns:1fr auto;gap:4px 10px}.bl{color:var(--text);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bn{font-weight:700;color:var(--text);font-size:14px;font-variant-numeric:tabular-nums}
.bt{--w:0;grid-column:1/-1;height:7px;background:var(--bg-alt);border-radius:4px;overflow:hidden}.bt i{display:block;height:100%;width:var(--w);background:linear-gradient(90deg,var(--gold-600),var(--gold-300));border-radius:4px;transition:width 1s cubic-bezier(.2,.7,.2,1)}
@media (max-width:680px){.mapctl{flex-direction:row;right:6px;bottom:6px}.mapctl .btn{min-height:30px;min-width:30px}}
.donut{display:grid;grid-template-columns:140px 1fr;gap:18px;align-items:center}.donut svg{width:140px}.track{fill:none;stroke:var(--bg-alt);stroke-width:16}
.arc{fill:none;stroke-width:16;transform:rotate(-90deg);transform-origin:70px 70px;transition:stroke-dasharray 1.1s cubic-bezier(.6,0,.2,1)}
.c0{stroke:var(--gold);background:var(--gold)}.c1{stroke:var(--accent);background:var(--accent)}.c2{stroke:var(--teal);background:var(--teal)}.c3{stroke:var(--text-2);background:var(--text-2)}
.dt{fill:var(--text);font-size:24px;font-weight:700}.ds{fill:var(--text-2);font-size:11px;letter-spacing:.08em}
.legend2{list-style:none;margin:0;padding:0;display:grid;gap:10px}.legend2 li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font-size:14px;color:var(--text)}.legend2 i{width:10px;height:10px;border-radius:3px}
.empty{color:var(--text-2);font-size:14px;margin:0}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:9px 6px;border-top:1px solid var(--line)}th{color:var(--text-2);font-weight:600;border-top:0;font-size:12px}td:not(:first-child),th:not(:first-child){text-align:right}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:var(--bad)}.dot.ok{background:var(--ok)}.dot.gold{background:var(--gold)}
.sec-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.sec-kpis>div{background:var(--bg-alt);border-radius:14px;padding:12px 14px;display:grid;gap:2px}.sec-kpis b{font-size:20px;color:var(--text)}.sec-kpis small{font-size:12px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sub{font-size:13px;color:var(--text);margin:0 0 8px}.log{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px}.log li{display:grid;grid-template-columns:auto auto 1fr;gap:4px 8px;align-items:center;font-size:13.5px;color:var(--text)}.log .m{color:var(--text-2);font-size:12.5px;text-align:right}
.note{font-size:12.5px;color:var(--text-2);margin:8px 0 12px}.sec-actions{display:flex;flex-wrap:wrap;gap:8px}.links{display:flex;flex-wrap:wrap;gap:8px}
.foot{color:var(--text-2);font-size:12px;margin-top:26px;text-align:center}
.hint{font-size:12.5px;line-height:1.5;color:var(--text-2);margin:-6px 0 14px}.kpi{cursor:help}
.insights{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.insights li{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:12px 14px;border-radius:14px;background:var(--bg-alt);font-size:14px;line-height:1.45;color:var(--text);animation:up .6s calc(.25s + var(--j, 0) * 70ms) cubic-bezier(.2,.7,.2,1) both;transition:transform .2s}
.insights li:hover{transform:translateY(-2px)}.insights b{color:var(--gold-text)}.ii{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:color-mix(in srgb,var(--gold) 18%,transparent);color:var(--gold-text);font-size:14px}
.trends{list-style:none;margin:0;padding:0;display:grid;gap:6px}.trends li{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,2fr) auto;gap:16px;align-items:center;padding:8px 10px;border-radius:12px;transition:background .2s}.trends li:hover{background:var(--bg-alt)}
.tw{display:grid;color:var(--text);text-decoration:none}.tw b{font-weight:600}.tw small{font-size:12px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tw:hover b{color:var(--gold-text)}
.spark{width:100%;height:40px;clip-path:inset(0 100% 0 0);animation:ink 1.3s .4s cubic-bezier(.6,0,.2,1) forwards}.sl{fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.c0f{fill:color-mix(in srgb,var(--gold) 16%,transparent)}.c1f{fill:color-mix(in srgb,var(--accent) 14%,transparent)}.c2f{fill:color-mix(in srgb,var(--teal) 14%,transparent)}
.tn{display:grid;text-align:right}.tn b{font-size:20px;color:var(--text);font-variant-numeric:tabular-nums}.tn small{font-size:12px;color:var(--text-2)}
.more{display:none;margin-top:12px}@media (max-width:680px){.insights.short li:nth-child(n+5){display:none}.insights.short+.more:not([hidden]){display:inline-flex}}
@media (max-width:680px){.trends li{grid-template-columns:1fr auto}.trends .spark{grid-column:1/-1;grid-row:2}}body.loading main .card{opacity:.6;transition:opacity .2s}
body.enter main .card{animation:up .7s calc(var(--i, 0) * 60ms) cubic-bezier(.2,.7,.2,1) both}
#intro{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:radial-gradient(120% 120% at 50% 30%,#2e3c74 0%,#1c2547 45%,#0b1026 100%);color:#f6f1e7;clip-path:inset(0 0 0 0);transition:clip-path .85s cubic-bezier(.7,0,.2,1);cursor:pointer}
#intro.out{clip-path:inset(0 0 100% 0)}.intro-in{display:grid;grid-template-columns:auto auto;align-items:baseline;justify-content:center}
.intro-is{font-family:var(--font-script);font-size:clamp(96px,16vw,170px);color:#e2b25c;line-height:1;clip-path:inset(0 100% 0 0);animation:ink 1.05s .15s cubic-bezier(.6,0,.2,1) forwards;filter:drop-shadow(0 0 22px rgba(226,178,92,.4))}
.intro-p{font-size:clamp(52px,9vw,96px);font-weight:700;letter-spacing:-.03em;opacity:0;transform:translateY(16px);animation:rise .65s .85s cubic-bezier(.2,.7,.2,1) forwards}
.intro-line{grid-column:1/-1;height:2px;margin-top:8px;background:linear-gradient(90deg,transparent,#e2b25c,transparent);transform:scaleX(0);animation:grow .8s 1.05s ease-out forwards}
.intro-sub{grid-column:1/-1;text-align:center;margin-top:14px;font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:#c9cde3;opacity:0;animation:rise .6s 1.2s ease-out forwards}
@media (prefers-reduced-motion:reduce){#intro{display:none}.li,.lv{stroke-dashoffset:0}.area,.pt{opacity:1;transform:none}.spark{clip-path:none}}
@media (max-width:980px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.grid3{grid-template-columns:1fr 1fr}.mapgrid{grid-template-columns:1fr}}
@media (max-width:680px){.grid2,.grid3,.sec-kpis{grid-template-columns:1fr}.v{font-size:28px}.tag,.tools .btn-text{display:none}#site-btn{min-width:0;width:100%}.site-pick{flex-basis:100%}#site-menu{left:0;right:auto}.donut{grid-template-columns:110px 1fr}.donut svg{width:110px}.log li{grid-template-columns:auto 1fr}.log .m{grid-column:1/-1;text-align:left}}`,
  html: `<div id="intro" aria-hidden="true"><div class="intro-in"><span class="intro-is">Is</span><span class="intro-p">Panel</span><span class="intro-line"></span><span class="intro-sub">Tu universo en datos</span></div></div>
<header class="topbar"><div class="container topbar-row"><a class="brand" href="/" aria-label="IsPanel"><span class="brand-is">Is</span><span class="brand-name">Panel</span></a><span class="tag">Tu universo en datos</span><span class="sp"></span>
<div class="tools"><button class="btn btn-sm" type="button" data-action="refresh" title="Traer los datos al momento">${ICON_REFRESH}<span class="btn-text">Actualizar</span></button>
<button class="btn btn-sm btn-icon theme-btn" type="button" data-action="theme" aria-label="Cambiar modo claro / oscuro">${ICON_MOON}${ICON_SUN}</button><a class="btn btn-sm" href="/logout">Salir</a></div></div></header>
<main class="container"><div class="controls"><div class="periods" role="group" aria-label="Periodo"><button class="btn btn-sm" type="button" data-days="7">7 días</button><button class="btn btn-sm" type="button" data-days="30">30 días</button><button class="btn btn-sm" type="button" data-days="90">90 días</button><button class="btn btn-sm" type="button" data-action="custom">Personalizado</button></div>
<div class="site-pick"><button class="btn" id="site-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="site-menu"><span class="sb"><span class="sb-name">Todas las webs</span><span class="sb-url"></span></span></button>
<div id="site-menu" role="menu" hidden>${Object.entries(SITES).map(([k, [name, href]]) => `<div class="site-opt"><button type="button" role="menuitemradio" aria-checked="false" data-site="${k}"><b>${name}</b><small>${href ? href.replace(/^https:\/\//, '') : 'Inicio, CV Online e IsAcademy juntas'}</small><span data-n="${k}"></span></button>${href ? `<a href="${href}" target="_blank" rel="noopener" aria-label="Abrir ${name} en una pestaña nueva" title="Abrir ${name}">${ICON_LINK}</a>` : '<span></span>'}</div>`).join('')}</div></div></div>
<form id="custom" hidden><label for="custom-n">Ver los últimos</label><input id="custom-n" type="number" min="1" max="180" step="1" value="14" inputmode="numeric"><select id="custom-u" aria-label="Unidad"><option value="1">días</option><option value="7">semanas</option><option value="30">meses</option></select><button class="btn btn-sm btn-primary" type="submit">Aplicar</button><p id="custom-msg" role="alert"></p></form>
<p id="range">Cargando…</p><p id="fresh" aria-live="polite"></p><p id="approx" hidden>Los 7 últimos días son exactos; los anteriores son una estimación de Cloudflare, que pasada una semana solo guarda 1 de cada 10 visitas. La comparación con el periodo anterior también es aproximada.</p><p id="error" hidden></p>
<section class="kpis" id="kpis" aria-label="Resumen"></section>
<section class="card" id="highlights-card"><h2>Lo más destacado</h2><ul class="insights short" id="insights"></ul><button class="btn btn-sm more" type="button" data-action="more" hidden>Ver todo lo destacado</button></section>
<section class="card"><h2>Visitas por día</h2><p class="hint">Visitas (llegadas a tus webs) y páginas vistas de cada día. Pasa el ratón o el dedo por la gráfica para ver un día concreto.</p><div id="chart"></div><div class="legend"><span><i></i>Visitas</span><span><i class="v2"></i>Páginas vistas</span></div></section>
<section class="card" data-sites-only><h2>Tendencia por web <small>visitas por día</small></h2><p class="hint">La evolución de cada web en el periodo. Pulsa el nombre para abrirla.</p><ul class="trends" id="trends"></ul></section>
<div class="mapgrid"><section class="card"><h2>De dónde te visitan <span class="maphead"><small id="map-count"></small><span class="seg" role="group" aria-label="Ver el mapa por"><button class="btn btn-sm" type="button" data-mapmode="countries" aria-pressed="true">Países</button><button class="btn btn-sm" type="button" data-mapmode="cities" aria-pressed="false">Ciudades</button></span></span></h2><div id="map"><p class="empty">Cargando el mapa…</p></div><p class="note" id="map-note"></p></section><section class="card"><h2 id="places-title">Países</h2><p class="hint" id="places-hint"></p><div id="countries"></div></section></div>
<div class="grid2"><section class="card" data-sites-only><h2>Por web</h2><p class="hint">Cómo se reparten las visitas entre tus tres webs.</p><div id="sites"></div></section><section class="card"><h2>Dispositivo</h2><p class="hint">Desde qué aparato te visitan: ordenador, móvil o tableta.</p><div id="devices"></div></section>
<section class="card"><h2>De dónde vienen</h2><p class="hint">La web o la app desde la que llegaron. «Directo» es quien escribe la dirección, usa un marcador o un enlace enviado por mensaje.</p><div id="sources"></div></section><section class="card"><h2>Páginas más vistas</h2><p class="hint">Páginas vistas por dirección. Las marcadas «no existe» son bots probando direcciones.</p><div id="pages"></div></section></div>
<div class="grid2"><section class="card"><h2>Navegador</h2><p class="hint">Con qué navegador te visitan.</p><div id="browsers"></div></section><section class="card"><h2>Sistema</h2><p class="hint">Con qué sistema operativo te visitan.</p><div id="systems"></div></section></div>
<div class="grid2"><section class="card"><h2>Formularios</h2><p class="hint">Qué pasó con cada envío de los formularios de contacto de CV Online e IsAcademy.</p><div id="forms"></div></section><section class="card"><h2>Seguridad</h2><p class="hint">Quién ha entrado en IsPanel y qué se ha frenado en tus webs.</p><div id="security"></div></section></div>
<section class="card" id="quick"><h2>Accesos rápidos</h2><p class="hint">Tus webs y los servicios que las mueven, a un clic.</p><div class="links">
<a class="btn btn-sm btn-arrow" href="${SITE}/" target="_blank" rel="noopener">Inicio</a><a class="btn btn-sm btn-arrow" href="${SITE}/cv/" target="_blank" rel="noopener">CV Online</a><a class="btn btn-sm btn-arrow" href="${SITE}/isacademy/" target="_blank" rel="noopener">IsAcademy</a>
<a class="btn btn-sm btn-arrow" href="https://dash.cloudflare.com/" target="_blank" rel="noopener">Cloudflare</a><a class="btn btn-sm btn-arrow" href="https://resend.com/emails" target="_blank" rel="noopener">Resend</a>
<a class="btn btn-sm btn-arrow" href="https://github.com/ismael-sarmiento" target="_blank" rel="noopener">GitHub</a><a class="btn btn-sm btn-arrow" href="https://www.linkedin.com/in/ismael-sarmiento/" target="_blank" rel="noopener">LinkedIn</a></div>
<p class="note">Las visitas vienen de Cloudflare Web Analytics: sin cookies y sin datos personales de tus visitantes. Excluye bots.</p></section>
<p class="foot">IsPanel · panel privado de Ismael Sarmiento · se actualiza solo cada 5 minutos mientras lo tienes abierto</p></main>`,
}, `(${panelClient})(${JSON.stringify(SITES)}, ${JSON.stringify(MAP_URL)}, ${JSON.stringify(MAP_SRI)}, ${JSON.stringify(ISO)})`));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (path === '/login' && req.method === 'POST') return sendLink(req, env, url);
    if (path === '/login') return (await authed(req, env)) ? redirect('/') : loginPage();
    if (path === '/auth') {
      if (!(await validLink(env, url.searchParams.get('t')))) return loginPage('El enlace no es válido, ya se usó o ha caducado. Pide uno nuevo.');
      await remember(env, req, 'access');
      return redirect('/', { 'Set-Cookie': `${COOKIE}=${await signSession(env)}; Path=/; Max-Age=${SESSION_MS / 1000}; HttpOnly; Secure; SameSite=Lax` });
    }
    if (path === '/logout') return redirect('/login', { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
    if (path === '/logout-all' && req.method === 'POST') {
      if (req.headers.get('Origin') !== url.origin || !(await authed(req, env))) return json({ ok: false }, 403);
      await env.PANEL_KV?.put('session-epoch', String(Number(await epoch(env)) + 1));
      return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
    }
    if (path === '/api/data') return (await authed(req, env)) ? data(req, env, url) : json({ error: 'auth' }, 401);
    if (path === '/') return (await authed(req, env)) ? panelPage() : redirect('/login');
    if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    return new Response('Not found', { status: 404, headers: secure(new Headers({ 'Content-Type': 'text/plain' }), 'x') });
  },
};
