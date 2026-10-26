// isa-panel · IsPanel, the Cloudflare Worker with the private panel of Ismael Sarmiento's sites (Inicio, CV Online, IsAcademy).
// One page, only for him, in the look of the sites (it loads the shared design system /assets/ds/ of the portada):
// visits by site, day, country (interactive world map), source, page and device (Cloudflare Web Analytics through the
// GraphQL API, no cookies on the sites), the outcome of the contact forms (written by isa-forms to Workers Analytics
// Engine), the approximate cities of the page views (isa-forms /hit, also in Analytics Engine) and a
// security corner (last accesses to the panel, blocked requests, probes of pages that do not exist).
// Optional D1 capture adds a private inbox (CONTACTS_ENABLED='true', 90 days) and individual Worker signals
// (TRAFFIC_ENABLED='true', 30 days, including available IP/network context). Both stay off until activation is approved.
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
// Bindings: PANEL_KV (Workers KV «isa-panel»): 2-minute aggregate cache and the last accesses
// (the Cache API does nothing on workers.dev).
// CONTACTS_DB (D1): authorization epoch/cooldown, private contacts, traffic and one-use link fingerprints.
// Authorization state and private records are never copied to KV or browser storage.
const SITE = 'https://ismael-sarmiento.github.io';
const SITE_KEY = '0x4AAAAAAFZ7JbJ5yVIvt3uH';
const COOKIE = '__Host-isa_panel';
const SESSION_MS = 30 * 86400000, LINK_MS = 15 * 60000, CACHE_S = 120, MAX_DAYS = 180;
const SITES = { all: ['Todas las webs', ''], inicio: ['Inicio', `${SITE}/`], cv: ['CV Online', `${SITE}/cv/`], isacademy: ['IsAcademy', `${SITE}/isacademy/`] };
// Natural Earth 1:50m, served from the owner's assets; see assets/maps/LICENSE.txt.
const MAP_URL = `${SITE}/assets/maps/countries-50m.json`;
const MAP_SRI = 'sha384-Aw4s9pX1PTPntIYkZ/qV9IYiF5Gv8eTl6Dd/TT56zfO1Wwd+owFwYUuuXNUMrWkc';
// ISO 3166 numeric (3 digits) + alpha-2, for every country: the map speaks numeric, Cloudflare speaks alpha-2
const ISO = '004AF008AL012DZ016AS020AD024AO660AI010AQ028AG032AR051AM533AW036AU040AT031AZ044BS048BH050BD052BB112BY056BE084BZ204BJ060BM064BT068BO070BA072BW074BV076BR086IO096BN100BG854BF108BI116KH120CM124CA132CV136KY140CF148TD152CL156CN162CX166CC170CO174KM178CG180CD184CK188CR384CI191HR192CU196CY203CZ208DK262DJ212DM214DO218EC818EG222SV226GQ232ER233EE231ET238FK234FO242FJ246FI250FR254GF258PF260TF266GA270GM268GE276DE288GH292GI300GR304GL308GD312GP316GU320GT324GN624GW328GY332HT334HM336VA340HN344HK348HU352IS356IN360ID364IR368IQ372IE376IL380IT388JM392JP400JO398KZ404KE296KI408KP410KR414KW417KG418LA428LV422LB426LS430LR434LY438LI440LT442LU446MO450MG454MW458MY462MV466ML470MT584MH474MQ478MR480MU175YT484MX583FM498MD492MC496MN500MS504MA508MZ104MM516NA520NR524NP528NL540NC554NZ558NI562NE566NG570NU574NF580MP807MK578NO512OM586PK585PW275PS591PA598PG600PY604PE608PH612PN616PL620PT630PR634QA638RE642RO643RU646RW654SH659KN662LC666PM670VC882WS674SM678ST682SA686SN690SC694SL702SG703SK705SI090SB706SO710ZA239GS724ES144LK729SD740SR744SJ748SZ752SE756CH760SY158TW762TJ834TZ764TH626TL768TG772TK776TO780TT788TN792TR795TM796TC798TV800UG804UA784AE826GB840US581UM858UY860UZ548VU862VE704VN092VG850VI876WF732EH887YE894ZM716ZW248AX535BQ531CW831GG833IM832JE499ME652BL663MF688RS534SX728SS983XK';
const enc = new TextEncoder();

// ---------- signed links and sessions ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function mac(env, text) {
  if (!env.PANEL_SECRET || typeof env.PANEL_SECRET !== 'string') throw new Error('session_unavailable');
  const key = await crypto.subtle.importKey('raw', enc.encode(env.PANEL_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const AUTH_EPOCH = /^[0-9a-f]{32}$/;
// Database time keeps the global reservation independent of clocks at different Worker locations.
const AUTH_NOW_SQL = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";
const authAvailable = env => Boolean(env.PANEL_KV && env.PANEL_SECRET && typeof env.PANEL_SECRET === 'string'
  && typeof env.CONTACTS_DB?.withSession === 'function');
function authStore(env) {
  if (!authAvailable(env)) throw new Error('session_unavailable');
  // A fresh first query on the primary avoids accepting a revoked epoch from a stale replica or KV.
  return env.CONTACTS_DB.withSession('first-primary');
}
const epoch = async env => {
  const value = await authStore(env).prepare('SELECT epoch FROM panel_auth_state WHERE id = 1').first('epoch');
  if (typeof value !== 'string' || !AUTH_EPOCH.test(value)) throw new Error('session_unavailable');
  return value;
};
const linkHash = async token => b64u(await crypto.subtle.digest('SHA-256', enc.encode(token)));
// Link: exp.nonce.sig; only its SHA-256 fingerprint reaches D1. The guarded UPDATE consumes it atomically.
// Session shape stays epoch.exp.sig; numeric legacy epochs are deliberately rejected after migration.
async function signLink(env) {
  if (!authAvailable(env) || !env.CONTACTS_DB) throw new Error('session_unavailable');
  const now = Date.now(), exp = now + LINK_MS, nonce = crypto.randomUUID();
  const token = `${exp}.${nonce}.${await mac(env, `link.${exp}.${nonce}`)}`;
  await env.CONTACTS_DB.prepare('INSERT INTO panel_link_tokens (token_hash, created_at, expires_at, used_at) VALUES (?, ?, ?, NULL)')
    .bind(await linkHash(token), now, exp).run();
  return token;
}
async function signSession(env) { const e = await epoch(env), exp = Date.now() + SESSION_MS; return `${e}.${exp}.${await mac(env, `session.${e}.${exp}`)}`; }
async function validLink(env, token) {
  if (!authAvailable(env) || !env.CONTACTS_DB) throw new Error('session_unavailable');
  // Check revocation storage before consuming a link, avoiding a successful consume with an unusable session.
  await epoch(env);
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts, now = Date.now();
  if (!/^\d{13}$/.test(exp) || Number(exp) <= now || Number(exp) > now + LINK_MS
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce)
    || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return false;
  if (!same(sig, await mac(env, `link.${exp}.${nonce}`))) return false;
  const consumed = await env.CONTACTS_DB.prepare('UPDATE panel_link_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? AND expires_at = ?')
    .bind(now, await linkHash(token), now, Number(exp)).run();
  return Number(consumed.meta?.changes) === 1;
}
async function validSession(env, token) {
  if (!authAvailable(env)) throw new Error('session_unavailable');
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  const [e, exp, sig] = parts;
  if (!AUTH_EPOCH.test(e) || !/^\d{13}$/.test(exp) || !/^[A-Za-z0-9_-]{43}$/.test(sig)
    || Number(exp) <= Date.now() || e !== await epoch(env)) return false;
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
    "default-src 'none'", `script-src 'nonce-${nonce}' https://challenges.cloudflare.com ${SITE}/assets/ds/`, `style-src 'nonce-${nonce}' ${SITE}`,
    `font-src ${SITE}`, `img-src data: ${SITE}`, `connect-src 'self' ${SITE}/assets/maps/`, 'frame-src https://challenges.cloudflare.com',
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

// Ask the last week separately from older dates. Cloudflare may sample adaptively even in recent periods;
// its aggregate counts remain estimates and are distinct from the optional individual Worker signals.
const DAY = 86400000;
async function gql(env, parts) {
  const query = `query { viewer { accounts(filter: { accountTag: ${lit(env.ACCOUNT_ID)} }) { ${parts.join('\n')} } } }`;
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
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
  const comparisonAllowed = day(from) >= day(oldest);
  const previousResults = comparisonAllowed ? await Promise.allSettled(split(from, new Date(since.getTime() - DAY)).map(([a, b]) =>
    gql(env, [group('total', { ...base, date_geq: a, date_leq: b, ...pathFilter(site) }, '', 1)]))) : [];
  const comparison = !comparisonAllowed ? { status: 'unavailable', reason: 'retention' }
    : previousResults.some(r => r.status === 'rejected') ? { status: 'error', reason: 'source' } : { status: 'ok' };
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
    range: { since: day(since), until: day(new Date()), days, exactSince: days > 7 ? day(weekAgo) : day(since) },
    total: num(current.map(w => w.total)), previous: comparison.status === 'ok'
      ? num(previousResults.map(r => r.value.total)) : { visits: null, views: null }, comparison, daily,
    sites: Object.fromEntries(['inicio', 'cv', 'isacademy'].map(s => [s, num(current.map(w => w[`site_${s}`]))])),
    siteDaily: Object.fromEntries(['inicio', 'cv', 'isacademy'].map(s => {
      const per = {}; for (const w of current) for (const r of w[`daily_${s}`] || []) per[r.dimensions.date] = (per[r.dimensions.date] || 0) + r.sum.visits;
      return [s, daily.map(d => per[d.key] || 0)];
    })),
    countries: merge('countries').sort((a, b) => b.visits - a.visits), sources: merge('sources'), pages: merge('pages'), devices: merge('devices'), browsers: merge('browsers'), systems: merge('systems'),
  };
}

// ---------- data: contact forms (Workers Analytics Engine, written by isa-forms) ----------
// An empty dataset is an empty result, not an HTTP error. In particular, bad SQL, a missing binding or a revoked
// token must remain visible as a failed source instead of silently turning into «zero contacts».
async function aeSql(env, sql) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST', signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` }, body: sql,
  });
  if (!res.ok) throw new Error(`Analytics Engine HTTP ${res.status}`);
  const out = await res.json().catch(() => null);
  if (!out || !Array.isArray(out.data)) throw new Error('Analytics Engine returned an invalid response');
  return out;
}
async function forms(env, days, site) {
  const only = ['inicio', 'cv', 'isacademy'].includes(site) ? ` AND blob1 = '${site}'` : '';
  const out = await aeSql(env, `SELECT blob1 AS site, blob2 AS outcome, SUM(_sample_interval) AS n FROM isa_forms_events
    WHERE timestamp > NOW() - INTERVAL '${days}' DAY${only} GROUP BY site, outcome FORMAT JSON`);
  return { rows: out.data.map(r => ({ site: r.site, outcome: r.outcome, n: Number(r.n) || 0 })) };
}
// page views by approximate city (written by isa-forms /hit since 18 October 2026); the site is one of a fixed list
async function cities(env, days, site) {
  const only = ['inicio', 'cv', 'isacademy'].includes(site) ? ` AND blob1 = '${site}'` : '';
  const out = await aeSql(env, `SELECT blob2 AS country, blob3 AS region, blob4 AS city, AVG(double1) AS lat, AVG(double2) AS lon,
    SUM(_sample_interval) AS n FROM isa_site_views WHERE timestamp > NOW() - INTERVAL '${days}' DAY${only}
    AND double1 >= -90 AND double1 <= 90 AND double2 >= -180 AND double2 <= 180
    AND (blob6 = 'geo-v1' OR (blob6 = '' AND (double1 != 0 OR double2 != 0)))
    GROUP BY country, region, city ORDER BY n DESC LIMIT 300 FORMAT JSON`);
  const coordinate=(value,limit)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Math.abs(Number(value))<=limit?Number(value):null;
  return { rows: out.data.map(r => ({ country: r.country, region: r.region, city: r.city, lat: coordinate(r.lat,90), lon: coordinate(r.lon,180), n: Number(r.n) || 0 })) };
}

async function data(req, env, url) {
  const asked = Math.round(Number(url.searchParams.get('days')));
  const days = Number.isFinite(asked) && asked >= 1 && asked <= MAX_DAYS ? asked : 30;
  const site = Object.hasOwn(SITES, url.searchParams.get('site')) ? url.searchParams.get('site') : 'all';
  const security = { accesses: await env.PANEL_KV?.get('access-log', 'json').catch(() => null) || [] };
  // cached for 2 minutes per period and site (the cache is only read after the session check); «Actualizar» skips it
  // This cache contains aggregate metrics only. Contact names, emails and messages never enter KV.
  // New namespace prevents pre-validity city results from returning through cache or stale snapshots.
  const key = `data:v3:${days}:${site}`, snapshotKey = `snapshot:${key}`;
  const hit = url.searchParams.get('fresh') === '1' ? null : await env.PANEL_KV?.get(key, 'json').catch(() => null);
  if (hit) return json({ ...hit, security, cached: true });
  const saved = await env.PANEL_KV?.get(snapshotKey, 'json').catch(() => null) || {};
  const results = await Promise.allSettled([visits(env, days, site), forms(env, days, site), cities(env, days, site)]);
  const generated = new Date().toISOString(), sources = {}, values = {}, nextSnapshot = {};
  for (const [i, source] of ['visits', 'forms', 'cities'].entries()) {
    const result = results[i], previous = saved[source];
    if (result.status === 'fulfilled') {
      values[source] = result.value;
      const empty = source === 'visits' ? !result.value.total.visits && !result.value.total.views : !result.value.rows.length;
      sources[source] = { status: empty ? 'empty' : 'ok', generated };
      nextSnapshot[source] = { value: result.value, generated };
    } else if (previous?.value && Date.parse(previous.generated) > Date.now() - DAY) {
      values[source] = previous.value;
      sources[source] = { status: 'stale', generated: previous.generated, message: 'La fuente no responde. Se muestran los últimos datos disponibles.' };
      nextSnapshot[source] = previous;
    } else {
      sources[source] = { status: 'error', generated: null, message: 'No se ha podido consultar esta fuente. Vuelve a intentarlo.' };
    }
  }
  const unavailableVisits = {
    range: { since: day(new Date(Date.now() - (days - 1) * DAY)), until: day(new Date()), days },
    total: { visits: null, views: null }, previous: { visits: null, views: null }, daily: [],
    sites: {}, siteDaily: {}, countries: [], sources: [], pages: [], devices: [], browsers: [], systems: [],
  };
  const body = { ...(values.visits || unavailableVisits), site, forms: values.forms || { rows: [], note: 'error' },
    cities: values.cities || { rows: [], note: 'error' }, generated, sourceHealth: sources,
    partial: Object.values(sources).some(s => s.status === 'error' || s.status === 'stale') || values.visits?.comparison?.status === 'error',
    stale: Object.values(sources).some(s => s.status === 'stale') };
  // `sources` is already the referrer ranking in the public analytics contract; sourceHealth deliberately avoids
  // overwriting it. The per-source timestamps remain visible when a fresh request has to use an older snapshot.
  await env.PANEL_KV?.put(key, JSON.stringify(body), { expirationTtl: Math.max(60, CACHE_S) }).catch(() => {});
  await env.PANEL_KV?.put(snapshotKey, JSON.stringify(nextSnapshot), { expirationTtl: DAY / 1000 }).catch(() => {});
  return json({ ...body, security, cached: false });
}

// ---------- private contacts: D1 only, with a hard 90-day read boundary ----------
const CONTACT_STATUSES = ['new', 'following', 'resolved', 'archived'];
const CONTACT_RETENTION_DAYS = 90;
const CONTACT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const CONTACT_COLUMNS = 'id, created_at, expires_at, site, page, language, name, email, phone, company, message, details_json, context_json, status, notification_status, provider_id, updated_at';
const contactObject = value => {
  try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
};
function contactItem(row) {
  if (!row) return null;
  const { details_json, context_json, ...item } = row;
  return { ...item, details: contactObject(details_json), context: contactObject(context_json) };
}
const contactCursor = row => b64u(enc.encode(JSON.stringify({ t: Number(row.created_at), id: row.id })));
function parseContactCursor(raw) {
  if (!raw) return null;
  if (raw.length > 300 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('cursor');
  try {
    const value = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
    if (!Number.isSafeInteger(value.t) || value.t < 0 || typeof value.id !== 'string' || !CONTACT_ID.test(value.id)) throw new Error('cursor');
    return value;
  } catch { throw new Error('cursor'); }
}
function contactFilters(url, now) {
  const site = url.searchParams.get('site') || 'all', status = url.searchParams.get('status') || 'all';
  const q = (url.searchParams.get('q') || '').trim();
  const daysText = url.searchParams.get('days') || String(CONTACT_RETENTION_DAYS);
  const limitText = url.searchParams.get('limit') || '25';
  const days = Number(daysText), limit = Number(limitText);
  if (!Object.hasOwn(SITES, site) || status !== 'all' && !CONTACT_STATUSES.includes(status) || q.length > 200
    || !/^\d+$/.test(daysText) || !Number.isInteger(days) || days < 1 || days > CONTACT_RETENTION_DAYS
    || !/^\d+$/.test(limitText) || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('filters');
  const clauses = ['expires_at > ?', 'created_at >= ?'], params = [now, now - days * DAY];
  if (site !== 'all') { clauses.push('site = ?'); params.push(site); }
  if (status !== 'all') { clauses.push('status = ?'); params.push(status); }
  if (q) {
    // D1 caps LIKE/GLOB patterns at 50 bytes. instr keeps literal substring matching for the full 200-character input.
    clauses.push('(instr(lower(name), lower(?)) > 0 OR instr(lower(email), lower(?)) > 0 OR instr(lower(phone), lower(?)) > 0 OR instr(lower(company), lower(?)) > 0 OR instr(lower(message), lower(?)) > 0)');
    params.push(q, q, q, q, q);
  }
  return { where: clauses.join(' AND '), params, limit, cursor: parseContactCursor(url.searchParams.get('cursor')) };
}
async function contactSummary(db, where, params) {
  const row = await db.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new,
    SUM(CASE WHEN status = 'following' THEN 1 ELSE 0 END) AS following,
    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
    SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived,
    MIN(CASE WHEN status IN ('new', 'following') THEN created_at ELSE NULL END) AS oldestPendingAt,
    SUM(CASE WHEN site = 'inicio' THEN 1 ELSE 0 END) AS inicio,
    SUM(CASE WHEN site = 'cv' THEN 1 ELSE 0 END) AS cv,
    SUM(CASE WHEN site = 'isacademy' THEN 1 ELSE 0 END) AS isacademy,
    SUM(CASE WHEN notification_status = 'failed' THEN 1 ELSE 0 END) AS notificationFailed
    FROM contacts WHERE ${where}`).bind(...params).first();
  const n = key => Number(row?.[key]) || 0;
  return { total: n('total'), new: n('new'), following: n('following'), resolved: n('resolved'), archived: n('archived'),
    oldestPendingAt: row?.oldestPendingAt == null ? null : Number(row.oldestPendingAt),
    sites: { inicio: n('inicio'), cv: n('cv'), isacademy: n('isacademy') }, notificationFailed: n('notificationFailed') };
}
async function readContactPatch(req) {
  if ((req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return { error: 'content_type', status: 415 };
  const reader = req.body?.getReader();
  if (!reader) return { error: 'invalid_body', status: 400 };
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return { error: 'body_too_large', status: 413 }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length !== 1 || !CONTACT_STATUSES.includes(value.status))
      return { error: 'invalid_status', status: 400 };
    return { value };
  } catch { return { error: 'invalid_body', status: 400 }; }
}
async function contacts(req, env, url, id = null) {
  const metadata = { enabled: true, retentionDays: CONTACT_RETENTION_DAYS };
  if (env.CONTACTS_ENABLED !== 'true') return json({ error: 'contacts_disabled', ...metadata, enabled: false }, 503);
  if (!env.CONTACTS_DB || !env.PANEL_KV) return json({ error: 'contacts_unavailable', ...metadata }, 503);
  if (id && !CONTACT_ID.test(id)) return json({ error: 'not_found' }, 404);
  if (!['GET', 'PATCH'].includes(req.method) || req.method === 'PATCH' && !id) return json({ error: 'method' }, 405, { Allow: id ? 'GET, PATCH' : 'GET' });
  if (req.method === 'PATCH' && req.headers.get('Origin') !== url.origin) return json({ error: 'origin' }, 403);
  const now = Date.now(), db = env.CONTACTS_DB;
  try {
    if (id) {
      if (req.method === 'PATCH') {
        const patch = await readContactPatch(req);
        if (patch.error) return json({ error: patch.error }, patch.status);
        const updated = await db.prepare('UPDATE contacts SET status = ?, updated_at = ? WHERE id = ? AND expires_at > ? AND created_at >= ?')
          .bind(patch.value.status, now, id, now, now - CONTACT_RETENTION_DAYS * DAY).run();
        if (Number(updated.meta?.changes) === 0) return json({ error: 'not_found' }, 404);
      }
      const row = await db.prepare(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = ? AND expires_at > ? AND created_at >= ?`)
        .bind(id, now, now - CONTACT_RETENTION_DAYS * DAY).first();
      return row ? json({ item: contactItem(row), ...metadata }) : json({ error: 'not_found' }, 404);
    }
    let filters;
    try { filters = contactFilters(url, now); }
    catch { return json({ error: 'invalid_filters' }, 400); }
    const { where, params, cursor, limit } = filters;
    const summary = await contactSummary(db, where, params);
    if (url.searchParams.get('summary') === '1') return json({ items: [], nextCursor: null, summary, ...metadata });
    const cursorWhere = cursor ? ' AND (created_at < ? OR (created_at = ? AND id < ?))' : '';
    const cursorParams = cursor ? [cursor.t, cursor.t, cursor.id] : [];
    const out = await db.prepare(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE ${where}${cursorWhere} ORDER BY created_at DESC, id DESC LIMIT ?`)
      .bind(...params, ...cursorParams, limit + 1).all();
    const rows = out.results || [], hasMore = rows.length > limit, page = rows.slice(0, limit);
    return json({ items: page.map(contactItem), nextCursor: hasMore ? contactCursor(page.at(-1)) : null, summary, ...metadata });
  } catch {
    // Never log a D1 error: bindings and SQL parameters can contain personal contact data.
    return json({ error: 'contacts_unavailable', ...metadata }, 503);
  }
}

// ---------- private traffic: individual Worker signals, retained for at most 30 days ----------
const TRAFFIC_RETENTION_DAYS = 30;
const TRAFFIC_COLUMNS = 'id, created_at, expires_at, site, page, referrer, context_json';
const TRAFFIC_CONTEXT_FIELDS = ['ip', 'country', 'region', 'regionCode', 'city', 'continent', 'postalCode', 'latitude', 'longitude',
  'timezone', 'asn', 'asOrganization', 'colo', 'httpProtocol', 'tlsVersion', 'tlsCipher', 'clientTcpRtt', 'clientQuicRtt',
  'browser', 'os', 'device', 'language', 'botScore', 'verifiedBot', 'rayId'];
function trafficItem(row) {
  const { context_json, ...item } = row, raw = contactObject(context_json), context = {};
  // Defense in depth: a corrupt/unexpected stored field never becomes an API contract or exposes unrelated data.
  for (const key of TRAFFIC_CONTEXT_FIELDS) {
    const value = raw[key];
    if (typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean') context[key] = value;
  }
  return { ...item, context };
}
function trafficFilters(url, now) {
  const site = url.searchParams.get('site') || 'all', q = (url.searchParams.get('q') || '').trim();
  const daysText = url.searchParams.get('days') || String(TRAFFIC_RETENTION_DAYS), limitText = url.searchParams.get('limit') || '25';
  const country = (url.searchParams.get('country') || '').toUpperCase(), asnText = url.searchParams.get('asn') || '';
  const days = Number(daysText), limit = Number(limitText), asn = Number(asnText);
  if (!Object.hasOwn(SITES, site) || q.length > 200 || !/^\d+$/.test(daysText) || !Number.isInteger(days) || days < 1 || days > TRAFFIC_RETENTION_DAYS
    || !/^\d+$/.test(limitText) || !Number.isInteger(limit) || limit < 1 || limit > 50
    || country && !/^[A-Z]{2}$/.test(country) || asnText && (!/^\d+$/.test(asnText) || !Number.isSafeInteger(asn) || asn < 1 || asn > 4294967295)) throw new Error('filters');
  const clauses = ['expires_at > ?', 'created_at >= ?'], params = [now, now - days * DAY];
  if (site !== 'all') { clauses.push('site = ?'); params.push(site); }
  if (country) { clauses.push("json_extract(context_json, '$.country') = ?"); params.push(country); }
  if (asnText) { clauses.push("json_extract(context_json, '$.asn') = ?"); params.push(asn); }
  if (q) {
    const fields = ["json_extract(context_json, '$.ip')", "json_extract(context_json, '$.city')", "json_extract(context_json, '$.region')",
      "json_extract(context_json, '$.asOrganization')", "json_extract(context_json, '$.asn')", 'page'];
    clauses.push(`(${fields.map(field => `instr(lower(COALESCE(CAST(${field} AS TEXT), '')), lower(?)) > 0`).join(' OR ')})`);
    params.push(...fields.map(() => q));
  }
  return { where: clauses.join(' AND '), params, limit, cursor: parseContactCursor(url.searchParams.get('cursor')) };
}
const TRAFFIC_LOCATED = "json_type(context_json, '$.latitude') IN ('integer','real') AND json_type(context_json, '$.longitude') IN ('integer','real') AND json_extract(context_json, '$.latitude') BETWEEN -90 AND 90 AND json_extract(context_json, '$.longitude') BETWEEN -180 AND 180";
async function trafficSummary(db, filters) {
  const { where, params } = filters;
  const row = await db.prepare(`SELECT COUNT(*) AS events,
    COUNT(DISTINCT NULLIF(json_extract(context_json, '$.ip'), '')) AS networkAddresses,
    COUNT(DISTINCT NULLIF(json_extract(context_json, '$.country'), '')) AS countries,
    COUNT(DISTINCT CASE WHEN COALESCE(json_extract(context_json, '$.city'), '') != ''
      THEN json_array(json_extract(context_json, '$.country'), json_extract(context_json, '$.region'), json_extract(context_json, '$.city')) END) AS cities,
    SUM(CASE WHEN ${TRAFFIC_LOCATED} THEN 1 ELSE 0 END) AS withLocation,
    SUM(CASE WHEN json_type(context_json, '$.verifiedBot') = 'true' THEN 1 ELSE 0 END) AS knownBots,
    SUM(CASE WHEN COALESCE(json_type(context_json, '$.verifiedBot'), '') != 'true' AND (COALESCE(json_type(context_json, '$.botScore'), '') NOT IN ('integer','real') OR json_extract(context_json, '$.botScore') = 0) THEN 1 ELSE 0 END) AS unclassifiedBots,
    MAX(created_at) AS latestAt,
    SUM(CASE WHEN site = 'inicio' THEN 1 ELSE 0 END) AS inicio,
    SUM(CASE WHEN site = 'cv' THEN 1 ELSE 0 END) AS cv,
    SUM(CASE WHEN site = 'isacademy' THEN 1 ELSE 0 END) AS isacademy
    FROM traffic_events WHERE ${where}`).bind(...params).first();
  const placeFields = "COALESCE(json_extract(context_json, '$.country'), '') AS country, COALESCE(json_extract(context_json, '$.region'), '') AS region, COALESCE(json_extract(context_json, '$.city'), '') AS city, json_extract(context_json, '$.latitude') AS lat, json_extract(context_json, '$.longitude') AS lon";
  const groupPlaces = `FROM traffic_events WHERE ${where} AND (${TRAFFIC_LOCATED}) GROUP BY country, region, city, lat, lon`;
  const results = await Promise.all([
    db.prepare(`SELECT ${placeFields}, COUNT(*) AS n, MAX(created_at) AS latestAt ${groupPlaces} ORDER BY n DESC, latestAt DESC, country, region, city LIMIT 500`).bind(...params).all(),
    db.prepare(`SELECT COUNT(*) AS groups FROM (SELECT ${placeFields} ${groupPlaces})`).bind(...params).first(),
    db.prepare(`SELECT json_extract(context_json, '$.asn') AS asn, COALESCE(json_extract(context_json, '$.asOrganization'), '') AS organization, COUNT(*) AS n
      FROM traffic_events WHERE ${where} GROUP BY asn, organization ORDER BY n DESC, organization, asn LIMIT 100`).bind(...params).all(),
    db.prepare(`SELECT COALESCE(NULLIF(json_extract(context_json, '$.httpProtocol'), ''), 'unknown') AS key, COUNT(*) AS n
      FROM traffic_events WHERE ${where} GROUP BY key ORDER BY n DESC, key`).bind(...params).all(),
    db.prepare(`SELECT COALESCE(NULLIF(json_extract(context_json, '$.device'), ''), 'unknown') AS key, COUNT(*) AS n
      FROM traffic_events WHERE ${where} GROUP BY key ORDER BY n DESC, key`).bind(...params).all(),
    db.prepare(`SELECT json_extract(context_json, '$.country') AS key, COUNT(*) AS n
      FROM traffic_events WHERE ${where} AND COALESCE(json_extract(context_json, '$.country'), '') != '' GROUP BY key ORDER BY n DESC, key`).bind(...params).all(),
  ]);
  const n = key => Number(row?.[key]) || 0, places = results[0].results || [], groups = Number(results[1]?.groups) || 0;
  return {
    summary: { events: n('events'), networkAddresses: n('networkAddresses'), countries: n('countries'), cities: n('cities'),
      withLocation: n('withLocation'), knownBots: n('knownBots'), unclassifiedBots: n('unclassifiedBots'),
      latestAt: row?.latestAt == null ? null : Number(row.latestAt), bySite: { inicio: n('inicio'), cv: n('cv'), isacademy: n('isacademy') } },
    places, placesMeta: { limit: 500, groups, mappedEvents: n('withLocation'), returnedEvents: places.reduce((sum, item) => sum + Number(item.n || 0), 0), truncated: groups > 500 },
    networks: results[2].results || [], networksMeta: { limit: 100, truncated: (results[2].results || []).reduce((sum, item) => sum + Number(item.n || 0), 0) < n('events') },
    protocols: results[3].results || [], devices: results[4].results || [], countries: results[5].results || [],
  };
}
async function traffic(req, env, url, mode, id = null) {
  const metadata = { enabled: true, retentionDays: TRAFFIC_RETENTION_DAYS };
  if (env.TRAFFIC_ENABLED !== 'true') return json({ error: 'traffic_disabled', ...metadata, enabled: false }, 503);
  if (!env.CONTACTS_DB || !env.PANEL_KV) return json({ error: 'traffic_unavailable', ...metadata }, 503);
  if (req.method !== 'GET') return json({ error: 'method' }, 405, { Allow: 'GET' });
  if (id && !CONTACT_ID.test(id)) return json({ error: 'not_found' }, 404);
  const now = Date.now(), db = env.CONTACTS_DB;
  try {
    if (id) {
      const row = await db.prepare(`SELECT ${TRAFFIC_COLUMNS} FROM traffic_events WHERE id = ? AND expires_at > ? AND created_at >= ?`)
        .bind(id, now, now - TRAFFIC_RETENTION_DAYS * DAY).first();
      return row ? json({ item: trafficItem(row), ...metadata }) : json({ error: 'not_found' }, 404);
    }
    let filters;
    try { filters = trafficFilters(url, now); }
    catch { return json({ error: 'invalid_filters' }, 400); }
    if (mode === 'summary') return json({ ...await trafficSummary(db, filters), generated: now, ...metadata });
    const { where, params, cursor, limit } = filters;
    const cursorWhere = cursor ? ' AND (created_at < ? OR (created_at = ? AND id < ?))' : '';
    const cursorParams = cursor ? [cursor.t, cursor.t, cursor.id] : [];
    const out = await db.prepare(`SELECT ${TRAFFIC_COLUMNS} FROM traffic_events WHERE ${where}${cursorWhere} ORDER BY created_at DESC, id DESC LIMIT ?`)
      .bind(...params, ...cursorParams, limit + 1).all();
    const rows = out.results || [], hasMore = rows.length > limit, page = rows.slice(0, limit);
    return json({ items: page.map(trafficItem), nextCursor: hasMore ? contactCursor(page.at(-1)) : null, ...metadata });
  } catch {
    // Neither SQL errors, IP addresses nor the record contents are copied into logs, Analytics Engine or KV.
    return json({ error: 'traffic_unavailable', ...metadata }, 503);
  }
}

// ---------- login by link ----------
async function readLoginInput(req) {
  if ((req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) && typeof value.token === 'string'
      && value.token.length > 0 && value.token.length <= 2048 ? { token: value.token } : null;
  } catch { return null; }
}
async function sendLink(req, env, url) {
  if (req.headers.get('Origin') !== url.origin) return json({ ok: false, message: 'origin' }, 403);
  if (!authAvailable(env) || !env.CONTACTS_DB || !env.PANEL_EMAIL || !env.RESEND_API_KEY || !env.TURNSTILE_SECRET)
    return json({ ok: false, message: 'unavailable' }, 503);
  const input = await readLoginInput(req);
  if (!input) return json({ ok: false, message: 'invalid_body' }, 400);
  const { token } = input;
  try {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', token);
    form.append('remoteip', req.headers.get('CF-Connecting-IP') || '');
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(10000) }).then(r => r.json());
    if (!check.success || check.hostname !== url.hostname) return json({ ok: false, message: 'turnstile' }, 403);
    await epoch(env); // Do not issue a link against missing or malformed authorization state.
    // The conditional write grants exactly one reservation across concurrent requests.
    const reservation = await authStore(env).prepare(`UPDATE panel_auth_state SET login_until_ms = ${AUTH_NOW_SQL} + 60000
      WHERE id = 1 AND login_until_ms <= ${AUTH_NOW_SQL} RETURNING login_until_ms`).first();
    if (!reservation) {
      await epoch(env); // Missing/malformed state is unavailable, not an ordinary cooldown.
      return json({ ok: false, message: 'wait' }, 429);
    }
    await remember(env, req, 'link');
    const link = `${url.origin}/auth?t=${await signLink(env)}`;
    const from = where(req), browser = browserOf(req.headers.get('User-Agent'));
    const when = new Date().toLocaleString('es-ES', { timeZone: 'Atlantic/Canary', dateStyle: 'long', timeStyle: 'short' });
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
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
  } catch {
    // Token values, email addresses and provider responses must never escape via an error response or a log.
    return json({ ok: false, message: 'unavailable' }, 503);
  }
}

// ---------- private weekly report: same content for preview and email ----------
const REPORT_COLUMNS = 'id, kind, period_start, period_end, created_at, updated_at, status, provider_id, error_code';
const REPORT_TIMEZONE = 'Atlantic/Canary';
const PANEL_URL = 'https://isa-panel.ismaelantonio-professional.workers.dev';
const reportConfigured = env => !!(env.CONTACTS_DB && env.PANEL_KV && env.PANEL_SECRET && env.PANEL_EMAIL && env.RESEND_API_KEY);
export function reportClock(time) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: REPORT_TIMEZONE, weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(new Date(time));
  const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
  return { date:`${p.year}-${p.month}-${p.day}`, due:p.weekday==='Mon'&&p.hour==='09'&&p.minute==='00' };
}
const reportItem = (row, now=Date.now()) => row ? { ...row, status:['preparing','sending'].includes(row.status)&&row.updated_at<now-120000?'unknown':row.status } : null;
async function reportData(req, env, now=Date.now()) {
  const url=new URL('/api/data?days=7&site=all&fresh=1',req.url);
  const aggregate=await (await data(req,env,url)).json();
  const out={generated:now,period:{since:now-7*DAY,until:now},aggregate,contacts:{status:'disabled'},traffic:{status:'disabled'}};
  if(env.CONTACTS_ENABLED==='true'){
    try{out.contacts={status:'ok',recent:await contactSummary(env.CONTACTS_DB,'expires_at > ? AND created_at >= ? AND created_at <= ?',[now,now-7*DAY,now]),active:await contactSummary(env.CONTACTS_DB,'expires_at > ? AND created_at >= ? AND created_at <= ?',[now,now-90*DAY,now])};}
    catch{out.contacts={status:'error'};}
  }
  if(env.TRAFFIC_ENABLED==='true'){
    try{const filters=trafficFilters(new URL('/api/traffic/summary?days=7&site=all',req.url),now);out.traffic={status:'ok',...await trafficSummary(env.CONTACTS_DB,filters)};}
    catch{out.traffic={status:'error'};}
  }
  // Access logs and personal records never enter the report payload.
  delete out.aggregate.security;
  return out;
}
export function renderPanelReport(d, panelURL=PANEL_URL) {
  const f=n=>n==null?'No disponible':new Intl.NumberFormat('es-ES').format(n),
    date=n=>new Intl.DateTimeFormat('es-ES',{timeZone:REPORT_TIMEZONE,dateStyle:'medium',timeStyle:'short'}).format(new Date(n)),
    a=d.aggregate,cs=d.contacts,ts=d.traffic,base=new URL(panelURL).origin;
  const country=c=>{try{return new Intl.DisplayNames(['es'],{type:'region'}).of(c)||c;}catch{return c||'Sin país';}};
  const lines=[], sections=[];
  const section=(title,body,plain)=>{sections.push(`<tr><td style="padding:22px 28px;border-top:1px solid #343b58"><h2 style="margin:0 0 14px;color:#e5b45e;font:600 19px Arial,sans-serif">${esc(title)}</h2>${body}</td></tr>`);lines.push(title,plain,'');};
  const p=s=>`<p style="margin:8px 0;color:#d2d6e3;font:14px/1.7 Arial,sans-serif">${esc(s)}</p>`;
  const link=(hash,label)=>`<p style="margin:16px 0 0"><a href="${esc(base+'/#'+hash)}" style="color:#e5b45e;font:600 14px Arial,sans-serif;text-decoration:underline">${esc(label)} →</a></p>`;
  const rows=list=>`<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${list.map(([label,value])=>`<tr><td style="padding:9px 8px 9px 0;border-bottom:1px solid #343b58;font:14px Arial,sans-serif;color:#f6f1e7;overflow-wrap:anywhere">${esc(label)}</td><td align="right" style="padding:9px 0;border-bottom:1px solid #343b58;font:600 15px Arial,sans-serif;color:#e5b45e">${esc(f(value))}</td></tr>`).join('')}</table>`;
  const available=a.sourceHealth?.visits?.status!=='error',stale=a.sourceHealth?.visits?.status==='stale';
  section('Tu universo, de un vistazo',p('Últimos 7 días · Inicio, CV Online e IsAcademy. Periodo independiente de los filtros abiertos en el panel.')+p(`${date(d.period.since)} — ${date(d.period.until)} · Canarias`),`${date(d.period.since)} — ${date(d.period.until)} (Canarias)`);
  section('Tráfico de las tres webs',rows([['Visitas estimadas',available?a.total.visits:null],['Páginas vistas estimadas',available?a.total.views:null],...Object.entries(SITES).filter(([k])=>k!=='all').map(([key,[label]])=>[label,available?a.sites[key]?.visits:null])])+p(`Web Analytics: ${a.range.since} — ${a.range.until} (fechas UTC). Son recuentos agregados independientes de las señales privadas.${stale?' La fuente no responde: estas cifras son anteriores, con su fecha de consulta.':''}`)+link('traffic','Consultar tráfico y fechas de las fuentes'),`Visitas estimadas: ${f(available?a.total.visits:null)}; páginas vistas: ${f(available?a.total.views:null)}\n${Object.entries(SITES).filter(([k])=>k!=='all').map(([k,[label]])=>`${label}: ${f(available?a.sites[k]?.visits:null)}`).join('\n')}`);
  if(cs.status==='ok'){
    const n=cs.recent,active=cs.active,pending=active.new+active.following;
    section('Conversaciones que merecen atención',rows([['Recibidas en los últimos 7 días',n.total],['Pendientes en la bandeja activa',pending],['Nuevas pendientes',active.new],['En seguimiento',active.following],['Avisos de correo fallidos del periodo',n.notificationFailed]])+p('Las pendientes incluyen solicitudes anteriores a esta semana que siguen en la bandeja de 90 días. El correo contiene el resumen; las fichas y mensajes completos se consultan en IsPanel.')+link('contacts','Abrir la bandeja privada'),`Recibidas: ${f(n.total)}; pendientes activas: ${f(pending)}; avisos fallidos del periodo: ${f(n.notificationFailed)}`);
  }else section('Contactos',p(cs.status==='disabled'?'La bandeja está pendiente de activación. Los mensajes anteriores permanecen en tu correo.':'La bandeja no se ha podido consultar; no equivale a cero solicitudes.')+link('contacts','Revisar contactos'),cs.status==='disabled'?'Bandeja sin activar':'Fuente no disponible');
  if(ts.status==='ok'){
    section('Señales recibidas y ubicaciones',rows([['Registros recibidos',ts.summary.events],['Direcciones de red distintas',ts.summary.networkAddresses],['Con coordenadas aproximadas',ts.summary.withLocation],['Bots verificados',ts.summary.knownBots]])+p('Una dirección de red puede ser compartida. Las señales de /hit y Web Analytics tienen coberturas diferentes.')+rows(ts.countries.slice(0,5).map(c=>[country(c.key),c.n]))+p('Cinco primeros países por señales. Ubicación de red aproximada.')+link('traffic','Explorar el mapa y los registros'),`Señales: ${f(ts.summary.events)}; direcciones: ${f(ts.summary.networkAddresses)}; con coordenadas: ${f(ts.summary.withLocation)}; bots verificados: ${f(ts.summary.knownBots)}`);
    const networks=(ts.networks||[]).slice(0,5).map(r=>[r.organization|| (r.asn?'AS'+r.asn:'Operador no disponible'),r.n]),protocols=(ts.protocols||[]).slice(0,5).map(r=>[r.key==='unknown'?'Protocolo no disponible':r.key,r.n]);
    section('Redes y protocolos',p('Hasta cinco operadores y protocolos por señales recibidas.')+rows(networks)+rows(protocols)+link('traffic','Consultar el contexto de conexión'),[...networks,...protocols].map(([key,n])=>`${key}: ${f(n)}`).join('\n'));
  }else section('Registro privado',p(ts.status==='disabled'?'La captura detallada sigue sin activar. No es posible reconstruir registros individuales del histórico agregado.':'No se ha podido consultar el registro privado; sus cifras quedan sin confirmar.'),ts.status==='disabled'?'Captura sin activar':'Fuente no disponible');
  const top=(key,title,label)=>{const list=available?(a[key]||[]).slice(0,5):[];section(title,list.length?rows(list.map(r=>[label(r),key==='pages'?r.views:r.visits]))+p('Cinco primeros resultados de la fuente agregada.'):p(available?'Sin resultados disponibles en este periodo.':'Fuente no disponible.'),list.map(r=>`${label(r)}: ${f(key==='pages'?r.views:r.visits)}`).join('\n')||'Sin resultados disponibles');};
  top('sources','Cómo llegan hasta ti',r=>r.key||'Directo o procedencia no disponible');
  top('pages','Páginas más vistas',r=>r.key||'/');
  top('devices','Dispositivos',r=>({desktop:'Escritorio',mobile:'Móvil',tablet:'Tableta'})[r.key]||r.key||'No disponible');
  top('browsers','Navegadores',r=>r.key||'No disponible');
  top('systems','Sistemas operativos',r=>r.key||'No disponible');
  const formLabels={sent:'Aviso de correo aceptado',accepted:'Aviso aceptado (histórico)',notification_accepted:'Guardado y aviso aceptado',notification_failed:'Guardado; aviso fallido',notification_unknown:'Guardado; aviso sin confirmar',stored:'Solicitud guardada',duplicate:'Duplicado',turnstile:'Rechazo antibots',honeypot:'Trampa antispam',origin:'Origen rechazado',invalid:'Contenido rechazado',mail:'Error de correo',mail_error:'Incidencia de correo (flujo anterior)',mail_unknown:'Correo sin confirmar (flujo anterior)',storage_error:'Error de almacenamiento'};
  const formResults=new Map();for(const row of a.forms?.rows||[])formResults.set(formLabels[row.outcome]||row.outcome,(formResults.get(formLabels[row.outcome]||row.outcome)||0)+row.n);
  section('Formularios y avisos',a.sourceHealth?.forms?.status==='error'?p('No se ha podido consultar esta fuente.'):formResults.size?rows([...formResults]):p('Sin resultados en este periodo.'),'Resultados: '+([...formResults].map(([key,n])=>`${key}: ${f(n)}`).join('; ')||'sin datos disponibles'));
  const health=Object.entries(a.sourceHealth||{}).map(([key,v])=>`${({visits:'Web Analytics',forms:'Formularios',cities:'Ubicaciones agregadas'})[key]||key}: ${({ok:'actualizado',empty:'sin datos',error:'no disponible',stale:'dato anterior'})[v.status]||v.status}${v.generated?' · '+date(Date.parse(v.generated)):''}`);
  section('Estado de las fuentes',health.map(p).join('')+p('Un aviso aceptado por el proveedor no acredita entrega ni lectura. Cada fuente mantiene su propia fecha y cobertura.')+link('system','Revisar servicios y formularios'),health.join('\n'));
  lines.push('Abrir IsPanel: '+base+'/', 'Contactos: '+base+'/#contacts', 'Tráfico: '+base+'/#traffic', 'Sistema: '+base+'/#system', '', 'Este correo conserva su contenido en tu buzón según sus propias reglas; no amplía la conservación activa del panel.');
  const title='IsPanel · tu resumen de los últimos 7 días';
  const body=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title}</title></head><body style="margin:0;background:#0b1026;color:#f6f1e7"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1026"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#141b40;border:1px solid #343b58;border-radius:18px"><tr><td style="padding:32px 28px"><div style="font:600 37px Arial,sans-serif;color:#f6f1e7"><span style="font:italic 48px Georgia,serif;color:#e5b45e">Is</span>Panel</div><p style="font:12px/1.6 Arial,sans-serif;letter-spacing:2px;color:#e5b45e">TU UNIVERSO, EN BUENAS MANOS</p><p style="font:13px Arial,sans-serif;color:#d2d6e3">${esc(date(d.generated))} · Canarias</p></td></tr>${sections.join('')}<tr><td style="padding:24px 28px;border-top:1px solid #343b58"><p style="font:12px/1.7 Arial,sans-serif;color:#d2d6e3">Resumen privado para el correo configurado de IsPanel. Consulta las fichas completas en el panel. La conservación de este mensaje en tu buzón es independiente de la del panel.</p></td></tr></table></td></tr></table></body></html>`;
  return {subject:title,html:body,text:[title,'',...lines].join('\n')};
}
async function deliverReport(req,env,kind,id,now=Date.now()) {
  const db=env.CONTACTS_DB,existing=await db.prepare(`SELECT ${REPORT_COLUMNS} FROM panel_reports WHERE id = ? AND expires_at > ?`).bind(id,Date.now()).first();
  if(existing)return {item:reportItem(existing),duplicate:true};
  const created=Date.now(),key='ispanel-report/'+id;
  const result=await db.prepare(`INSERT OR IGNORE INTO panel_reports (id,kind,period_start,period_end,created_at,updated_at,expires_at,status,idempotency_key)
    SELECT ?,?,?,?,?,?,?,'preparing',? WHERE ? = 'weekly' OR NOT EXISTS(SELECT 1 FROM panel_reports WHERE kind='manual' AND created_at > ?)`)
    .bind(id,kind,now-7*DAY,now,created,created,created+30*DAY,key,kind,created-60000).run();
  if(!result.meta?.changes){const prior=await db.prepare(`SELECT ${REPORT_COLUMNS} FROM panel_reports WHERE id = ? AND expires_at > ?`).bind(id,Date.now()).first();return prior?{item:reportItem(prior),duplicate:true}:{error:'wait',retryAfter:60};}
  const set=async(status,provider=null,code=null,hash=null)=>db.prepare('UPDATE panel_reports SET status=?, provider_id=?, error_code=?, payload_hash=COALESCE(?,payload_hash), updated_at=? WHERE id=?').bind(status,provider,code,hash,Date.now(),id).run();
  let sent=false;
  try{
    const content=renderPanelReport(await reportData(req,env,now),new URL(req.url).origin);
    const payload={from:'IsPanel <onboarding@resend.dev>',to:[env.PANEL_EMAIL],...content};
    const encoded=JSON.stringify(payload),hash=await linkHash(encoded);await set('sending',null,null,hash);sent=true;
    const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:encoded});
    const value=await response.json().catch(()=>null);
    if(response.ok&&typeof value?.id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(value.id))await set('accepted',value.id);
    else if(!response.ok&&response.status>=400&&response.status<500&&response.status!==408)await set('failed',null,'provider_rejected');
    else await set('unknown',null,'provider_unconfirmed');
  }catch{await set(sent?'unknown':'failed',null,sent?'transport_unconfirmed':'report_unavailable').catch(()=>{});}
  const row=await db.prepare(`SELECT ${REPORT_COLUMNS} FROM panel_reports WHERE id = ?`).bind(id).first();
  return {item:reportItem(row)};
}
async function reports(req,env,url) {
  if(!env.CONTACTS_DB||!env.PANEL_KV)return json({error:'reports_unavailable'},503);
  const action=url.pathname.slice('/api/reports/'.length),enabled=env.REPORTS_ENABLED==='true',configured=reportConfigured(env);
  if(action==='status'&&req.method==='GET'){
    const now=Date.now(),last=await env.CONTACTS_DB.prepare(`SELECT ${REPORT_COLUMNS} FROM panel_reports WHERE expires_at > ? ORDER BY created_at DESC,id DESC LIMIT 1`).bind(now).first();
    const manual=await env.CONTACTS_DB.prepare("SELECT MAX(created_at) AS t FROM panel_reports WHERE kind='manual' AND expires_at > ?").bind(now).first();
    return json({enabled,configured,schedule:{weekday:1,hour:9,minute:0,timeZone:REPORT_TIMEZONE},latest:reportItem(last),manualAvailableAt:Math.max(now,Number(manual?.t||0)+60000)});
  }
  if(action==='preview'&&req.method==='GET'){
    const content=renderPanelReport(await reportData(req,env),url.origin);
    const headers=secure(new Headers({'Content-Type':'text/html; charset=utf-8'}),'x');
    headers.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    return new Response(content.html,{headers});
  }
  if(action==='send'&&req.method==='POST'){
    if(req.headers.get('Origin')!==url.origin)return json({error:'origin'},403);
    if((req.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return json({error:'content_type'},415);
    const reader=req.body?.getReader();if(!reader)return json({error:'invalid_body'},400);
    const chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024){await reader.cancel();return json({error:'body_size'},413);}chunks.push(value);}}
    catch{return json({error:'invalid_body'},400);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const raw=new TextDecoder().decode(bytes);
    let input;try{input=JSON.parse(raw);}catch{return json({error:'invalid_body'},400);}
    if(!input||Object.keys(input).length!==1||typeof input.requestId!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(input.requestId))return json({error:'invalid_body'},400);
    if(!enabled)return json({error:'reports_disabled'},503);
    if(!configured)return json({error:'reports_unavailable'},503);
    const result=await deliverReport(req,env,'manual','manual:'+input.requestId);
    return json(result,result.error==='wait'?429:200);
  }
  return json({error:'method'},405,{Allow:action==='send'?'POST':'GET'});
}

// Clip each ring at the antimeridian, without moving the other islands of the same country.
// Kept pure so the browser and geometric regression tests execute the exact same decoder.
export function decodeWorldCountries(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(a => { let x=0,y=0;return a.map(([dx,dy])=>{x+=dx;y+=dy;return[x*sx+tx,y*sy+ty];}); });
  const arc = i => i>=0?arcs[i]:arcs[~i].slice().reverse();
  const ring = indices => indices.flatMap((i,k)=>k?arc(i).slice(1):arc(i));
  const clip = (points,edge,keepGreater) => {
    const out=[];let previous=points.at(-1);
    for(const current of points){const a=keepGreater?previous[0]>=edge:previous[0]<=edge,b=keepGreater?current[0]>=edge:current[0]<=edge;
      if(a!==b){const t=(edge-previous[0])/(current[0]-previous[0]);out.push([edge,previous[1]+t*(current[1]-previous[1])]);}
      if(b)out.push(current);previous=current;
    }return out;
  };
  const fragments = points => {
    const unwrapped=[];let last=points[0][0];
    for(const [original,lat] of points){let lon=original;while(lon-last>180)lon-=360;while(lon-last< -180)lon+=360;unwrapped.push([lon,lat]);last=lon;}
    const bounds=unwrapped.reduce((b,p)=>[Math.min(b[0],p[0]),Math.max(b[1],p[0])],[Infinity,-Infinity]),out=[];
    for(let shift=Math.ceil((-180-bounds[1])/360);shift<=Math.floor((180-bounds[0])/360);shift++){
      let cut=clip(unwrapped.map(([lon,lat])=>[lon+shift*360,lat]),-180,true);if(!cut.length)continue;cut=clip(cut,180,false);if(cut.length<3)continue;
      const area=cut.reduce((sum,p,i)=>{const q=cut[(i+1)%cut.length];return sum+p[0]*q[1]-q[0]*p[1];},0);if(Math.abs(area)<1e-9)continue;
      const dense=[];for(let i=0;i<cut.length;i++){const p=cut[i],q=cut[(i+1)%cut.length];dense.push(p);if(Math.abs(Math.abs(p[0])-180)<1e-8&&Math.abs(p[0]-q[0])<1e-8){const steps=Math.ceil(Math.abs(q[1]-p[1]));for(let j=1;j<steps;j++)dense.push([p[0],p[1]+(q[1]-p[1])*j/steps]);}}
      out.push(dense);
    }return out;
  };
  return topo.objects.countries.geometries.filter(g=>g.id!=='010').map(g=>({id:g.id,name:g.properties?.name||'',rings:(g.type==='Polygon'?[g.arcs]:g.type==='MultiPolygon'?g.arcs:[]).flatMap(p=>p.flatMap(r=>fragments(ring(r))))}));
}

// ---------- shared look: the sites' design system plus what only the panel needs ----------
// the tab icon of the sites («Is» in gold), light or dark like the page (see /assets/ds/favicon.js)
const ICONS = ['light', 'dark'].map(t => `<link rel="icon" href="${SITE}/assets/brand/favicon-${t}.svg" type="image/svg+xml" media="(prefers-color-scheme: ${t})" data-theme-icon="${t}">
<link rel="icon" href="${SITE}/assets/brand/favicon-${t}-32.png" sizes="32x32" type="image/png" media="(prefers-color-scheme: ${t})" data-theme-icon="${t}">`).join('')
  + `<link rel="apple-touch-icon" href="${SITE}/assets/brand/apple-touch-icon.png">`;
const SYNC_ICON = `function syncIcon(){const f=document.documentElement.dataset.theme;document.querySelectorAll('link[data-theme-icon]').forEach(l=>{const m=f?(f===l.dataset.themeIcon?'all':'not all'):'(prefers-color-scheme: '+l.dataset.themeIcon+')';if(l.media===m)return;const n=l.cloneNode();n.media=m;l.replaceWith(n)})}`;
const HEAD = nonce => `<link rel="stylesheet" href="${SITE}/assets/ds/tokens.css"><link rel="stylesheet" href="${SITE}/assets/ds/base.css"><link rel="stylesheet" href="${SITE}/assets/ds/circuit.css">${ICONS}
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
<body class="${title === 'IsPanel' ? 'panel-page' : 'login-page'}">${body.html}<script nonce="${nonce}">${script}</script></body></html>`;

const PANEL_CIRCUIT = `<svg class="ds-circuit ds-circuit--intro" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><path pathLength="1" d="M1600 150 H1380 L1340 190 H1180"/><circle cx="1180" cy="190" r="5"/><path pathLength="1" d="M1600 210 H1440 L1400 250 H1290"/><circle cx="1290" cy="250" r="5"/><path pathLength="1" d="M0 720 H200 L240 680 H380"/><circle cx="380" cy="680" r="5"/><path pathLength="1" d="M0 780 H260 L300 740 H460"/><circle cx="460" cy="740" r="5"/></svg>`;

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
.login p{color:var(--text-2);margin:0 0 22px}#status{min-height:24px;margin:18px 0 0;font-size:14px}#status.ok{color:var(--ok)}#status.bad{color:var(--bad)}#ts{position:absolute}.foot{margin-top:22px;font-size:12px;color:var(--text-2)}@media(prefers-reduced-motion:reduce){.logo .brand-is{clip-path:none}}`,
  html: `<main>${PANEL_CIRCUIT}<div class="card login"><h1 class="logo"><span class="brand-is">Is</span>Panel</h1><p class="eyebrow">Tu universo en datos</p>
<p>Contactos, actividad y seguimiento de Inicio, CV Online e IsAcademy. Te envío un enlace de acceso a tu correo.</p>
<button class="btn btn-primary btn-lg btn-arrow" id="send" type="button">Envíame el enlace</button><div id="ts"></div><p id="status" role="status" aria-live="polite" class="${message ? 'bad' : ''}">${esc(message || '')}</p>
<p class="foot">Privado · enlace de un solo uso · protegido con Cloudflare Turnstile</p></div></main>`,
}, `(${loginClient})(${JSON.stringify(SITE_KEY)})`));

// Client helper is self-contained because the Worker serializes it into the nonce-protected page.
// A lost response can follow a committed revocation: never infer that sessions remain open or auto-retry.
export async function requestSessionRevocation() {
  try {
    const response = await fetch('/logout-all', { method: 'POST', headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return false;
    return (await response.json())?.ok === true;
  } catch { return false; }
}

// ---------- panel page ----------
function panelClient(SITES, MAP_URL, MAP_SRI, ISO, SIGNATURE_URL, decodeWorldCountries, requestSessionRevocation) {
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
  const OUT = { sent: ['Correo aceptado (flujo anterior)', 'ok'], notification_accepted: ['Correo aceptado por Resend', 'ok'], notification_unknown: ['Aviso sin confirmar', 'gold'], stored: ['Solicitud guardada', 'ok'], notification_failed: ['Guardada; aviso fallido', 'bad'],
    turnstile: ['Verificación no superada', 'bad'], honeypot: ['Campo trampa rellenado', 'bad'], origin: ['Origen no permitido', 'bad'],
    invalid: ['Petición no válida', 'bad'], mail_error: ['Incidencia de correo (flujo anterior)', 'bad'], mail_unknown: ['Correo sin confirmar (flujo anterior)', 'gold'], storage_error: ['Error al guardar', 'bad'], duplicate: ['Reintento reconocido', 'gold'] };
  const delta = (now, before) => {
    if (before == null) return '<span class="d">comparación no disponible</span>';
    if (before < 5) return `<span class="d">antes: ${fmt(before)}</span>`;
    const p = Math.round((now - before) / before * 100);
    if (p > 300) return `<span class="d up">▲ ×${(now / before).toFixed(1).replace('.', ',')}</span>`;
    return `<span class="d ${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? '▲' : p < 0 ? '▼' : '='} ${Math.abs(p)} %</span>`;
  };
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };
  const when = t => new Date(t).toLocaleString('es-ES', { timeZone: 'Atlantic/Canary', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' });
  const networkFields = c => [
    ['IP',c.ip], ['Ubicación de red',[...new Set([c.city,c.region,countryName(c.country)].filter(v=>v&&v!=='Desconocido'))].join(', ')],
    ['Zona horaria',c.timezone], ['Código postal de red',c.postalCode], ['Continente',c.continent],
    ['Operador de red',c.asOrganization], ['ASN',c.asn!=null?`AS${c.asn}`:null], ['Centro de Cloudflare',c.colo],
    ['Dispositivo',c.device?device(c.device):null], ['Navegador',c.browser], ['Sistema operativo',c.os], ['Idioma del navegador',c.language],
    ['Protocolo',c.httpProtocol], ['Cifrado',c.tlsVersion], ['Suite TLS',c.tlsCipher],
    ['RTT TCP',c.clientTcpRtt!=null?`${c.clientTcpRtt} ms`:null], ['RTT QUIC',c.clientQuicRtt!=null?`${c.clientQuicRtt} ms`:null],
    ['Coordenadas de red',Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)?`${c.latitude}, ${c.longitude}`:null],
    ['Señal de bot',c.botScore!=null?(c.botScore===0?'No calculada (0)':`${c.botScore} / 99`):null], ['Bot verificado',typeof c.verifiedBot==='boolean'?(c.verifiedBot?'Sí':'No'):null], ['Cloudflare Ray ID',c.rayId],
  ].filter(([,v])=>v!==undefined&&v!==null&&v!=='');
  const fieldMarkup = fields => fields.map(([k,v])=>`<div><dt>${text(k)}</dt><dd>${text(String(v))}</dd></div>`).join('');

  // ---------- bars, rings and counters (lengths go through the CSSOM: the CSP blocks inline style attributes) ----------
  const bars = (rows, label, value = r => r.visits, action = null) => {
    const merged = new Map();
    for (const r of rows) { const l = label(r); merged.set(l, (merged.get(l) || 0) + (value(r) || 0)); }
    const list = [...merged].map(([l, v]) => ({ l, v })).filter(r => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
    if (!list.length) return '<p class="empty">Sin datos en este periodo.</p>';
    const max = list[0].v;
    return `<ul class="bars">${list.map(r => `<li>${action ? `<button class="bl place-select" type="button" ${action(rows.find(row => label(row) === r.l))}>${text(r.l)}</button>` : `<span class="bl">${text(r.l)}</span>`}<span class="bn">${fmt(r.v)}</span><span class="bt"><i data-w="${(r.v / max * 100).toFixed(1)}"></i></span></li>`).join('')}</ul>`;
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
    c.style.strokeDasharray = reduce || !first ? `${len} ${C - len}` : `0 ${C}`;
    c.style.transitionDelay = `${n * 120}ms`;
    if (!reduce && first) requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDasharray = `${len} ${C - len}`; }));
  });
  const countUp = () => $$('[data-count]').forEach(el => {
    const end = Number(el.dataset.count), dec = Number(el.dataset.dec || 0);
    const show = v => { el.textContent = dec ? v.toFixed(dec).replace('.', ',') : fmt(v); };
    if (reduce || !first || !end) return show(end);
    const t0 = performance.now(), dur = 950;
    const step = now => { if (!el.isConnected) return; const p = Math.min(1, (now - t0) / dur); show(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });

  // ---------- visits per day: a smooth line that draws itself, with a tooltip that follows the pointer ----------
  let series = [];
  const chart = daily => {
    series = daily;
    if (!daily.length) return '<p class="empty">La gráfica no está disponible. Revisa el estado de la fuente de tráfico.</p>';
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
      const i = Math.max(0, Math.min(series.length - 1, typeof ev === 'number' ? ev : Math.round((px - P) / ((W - 2 * P) / Math.max(1, series.length - 1)))));
      const d = series[i], gx = x(i);
      guide.setAttribute('x1', gx); guide.setAttribute('x2', gx); guide.classList.add('on');
      hot.setAttribute('cx', gx); hot.setAttribute('cy', y(d.visits));
      tip.hidden = false;
      tip.innerHTML = `<b>${dm(d.key)}</b><span><i class="tv"></i>${fmt(d.visits)} visitas</span><span><i class="tp"></i>${fmt(d.views)} páginas vistas</span>`;
      tip.style.setProperty('--x', `${Math.max(80, Math.min(box.width - 80, gx / W * box.width))}px`);
      hit.setAttribute('aria-valuenow', i); hit.setAttribute('aria-valuetext', `${dm(d.key)}: ${fmt(d.visits)} visitas y ${fmt(d.views)} páginas vistas`);
    };
    const hide = () => { tip.hidden = true; guide.classList.remove('on'); hot.setAttribute('cx', -20); };
    hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', hide);
    hit.setAttribute('role','slider'); hit.setAttribute('tabindex','0'); hit.setAttribute('aria-label','Día de la gráfica'); hit.setAttribute('aria-valuemin','0'); hit.setAttribute('aria-valuemax',series.length-1); hit.setAttribute('aria-valuenow',series.length-1);
    hit.addEventListener('focus', () => show(series.length-1)); hit.addEventListener('blur',hide);
    hit.addEventListener('keydown', e => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return; e.preventDefault(); show(e.key === 'Home' ? 0 : e.key === 'End' ? series.length-1 : Number(hit.getAttribute('aria-valuenow'))+(e.key==='ArrowRight'?1:-1)); });
  };

  // ---------- world map: Natural Earth countries, Equal Earth projection, drag to move, wheel or buttons to zoom ----------
  const num2a = {}; for (let i = 0; i < ISO.length; i += 5) num2a[ISO.slice(i, i + 3)] = ISO.slice(i + 3, i + 5);
  const WORLD = { x: -272, y: -134, w: 544, h: 242 };   // from Greenland to Tierra del Fuego
  let world = null, worldLoading = null, mapVisits = {}, mapCities = [], view = { ...WORLD };
  let mapSource = 'activity', trafficData = null, trafficItems = [], trafficCursor = null, trafficSeq = 0, trafficController = null, trafficKey = '', trafficStale=false;
  let mapMode = store.get('panel-map') === 'cities' ? 'cities' : 'countries';
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  const project = ([lon, lat]) => {
    const l = lon * Math.PI / 180, t = Math.asin(M * Math.sin(lat * Math.PI / 180)), t2 = t * t, t6 = t2 * t2 * t2;
    return [100 * l * Math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), -100 * t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
  };
  const loadWorld = async () => {
    if (world) return world;
    if (worldLoading) return worldLoading;
    worldLoading = (async () => {
    const response = await fetch(MAP_URL, { integrity: MAP_SRI, mode: 'cors', credentials: 'omit',signal:AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('map_unavailable');
    const topo = await response.json();
    world = decodeWorldCountries(topo).map(g=>({code:num2a[g.id]||'',name:g.name,d:g.rings.map(r=>`M${r.map(p=>project(p).map(v=>v.toFixed(3)).join(',')).join('L')}Z`).join('')}));
    return world;
    })().finally(()=>{worldLoading=null;});
    return worldLoading;
  };
  // the dots keep their size on screen while zooming
  const drawMapDots = () => {
    const dots=$('#dots');if(!dots)return;
    const places=mapMode==='cities'?mapCities.filter(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lon)):[];
    const cell=22*view.w/Math.max(240,$('#map svg').clientWidth),groups=new Map();
    for(const c of places){const [x,y]=project([c.lon,c.lat]),key=Math.floor((x-view.x)/cell)+':'+Math.floor((y-view.y)/cell);let group=groups.get(key);if(!group){group={x:0,y:0,n:0,places:[],latestAt:0};groups.set(key,group);}group.x+=x*c.n;group.y+=y*c.n;group.n+=c.n;group.places.push(c);group.latestAt=Math.max(group.latestAt,c.latestAt||0);}
    const list=[...groups.values()].map(g=>({...g,x:g.x/g.n,y:g.y/g.n})).sort((a,b)=>b.n-a.n),top=Math.max(1,...list.map(g=>g.n));
    dots.innerHTML=list.map((g,i)=>{const c=g.places[0],multiple=g.places.length>1,cc=g.places.every(p=>p.country===c.country)?c.country:'',r=(1.6+4.4*Math.sqrt(g.n/top))*view.w/WORLD.w;return `<circle cx="${g.x.toFixed(3)}" cy="${g.y.toFixed(3)}" r="${r.toFixed(3)}" class="city${i<3?' big':''}" data-city="${text(multiple?g.places.length+' lugares próximos':placeName(c))}" data-where="${text(multiple?'Acerca el mapa para separarlos':[c.region&&c.region!==c.city?c.region:'',countryName(c.country)].filter(Boolean).join(', '))}" data-cc="${text(cc)}" data-n="${g.n}" data-cluster="${g.places.length}" data-latest="${g.latestAt||''}"/>`;}).join('');
    const svg = $('#map svg'), labels = $('#map-labels');
    if (!svg.clientWidth) { labels.replaceChildren(); return; }
    const unitsPerPixel = svg.viewBox.baseVal.width / svg.clientWidth;
    labels.innerHTML = list.filter(g => g.places.length === 1).slice(0, 6).map(g =>
      `<text x="${g.x.toFixed(3)}" y="${(g.y - 12 * unitsPerPixel).toFixed(3)}" font-size="${(12 * unitsPerPixel).toFixed(3)}" text-anchor="middle">${text(placeName(g.places[0]))}</text>`).join('');
    // Decorative names keep a readable screen size; the ordered list remains the complete alternative.
    // Test the rendered boxes after zoom/resize, preserving the higher-activity names first.
    const frame = svg.getBoundingClientRect(), kept = [], gap = 4;
    for (const label of labels.children) {
      const box = label.getBoundingClientRect();
      const clipped = box.left < frame.left + gap || box.right > frame.right - gap
        || box.top < frame.top + gap || box.bottom > frame.bottom - gap;
      const overlaps = kept.some(other => box.left < other.right + gap && box.right > other.left - gap
        && box.top < other.bottom + gap && box.bottom > other.top - gap);
      if (clipped || overlaps) label.style.display = 'none';
      else kept.push(box);
    }
  };
  const setView = () => { $('#map svg')?.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); drawMapDots(); if($('#map-level')) $('#map-level').textContent=`×${(WORLD.w/view.w).toFixed(1)}`; };
  const zoom = (k, cx = view.x + view.w / 2, cy = view.y + view.h / 2) => {
    const w = Math.max(22, Math.min(WORLD.w, view.w / k)), h = w * WORLD.h / WORLD.w;
    view = { x: cx - (cx - view.x) * w / view.w, y: cy - (cy - view.y) * h / view.h, w, h }; setView();
  };
  const placeName = c => c.city || c.region || 'Lugar sin determinar';
  const paintMap = () => {
    const max = Math.max(1, ...Object.values(mapVisits)), soft = mapMode === 'cities';
    const activity = mapSource === 'activity' && trafficData;
    $('#map svg')?.setAttribute('aria-label', soft ? 'Mapa del mundo por ciudad aproximada' : 'Mapa del mundo por país');
    $$('#map path[data-c]').forEach(p => {
      const v = mapVisits[p.dataset.c] || 0;
      p.classList.toggle('has', v > 0);
      p.setAttribute('fill-opacity', v ? (soft ? 0.22 : 0.45 + 0.55 * Math.sqrt(v / max)).toFixed(2) : '1');
    });
    const places = soft ? mapCities.filter(c => Number.isFinite(c.lat)&&Number.isFinite(c.lon)) : [];
    drawMapDots();
    $$('[data-mapmode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapmode === mapMode)));
    const n = soft ? places.length : Object.keys(mapVisits).length;
    const unavailable = !activity && last?.sourceHealth?.[soft ? 'cities' : 'visits']?.status === 'error';
    $('#map-count').textContent = unavailable ? 'fuente no disponible' : soft ? (n === 1 ? '1 ubicación' : `${n} ubicaciones`) : (n === 1 ? '1 país' : `${n} países`);
    $('#map-note').textContent = `${activity?'Registros recibidos · últimos '+Math.min(days,30)+' días':'Analítica agregada de Cloudflare'} · ubicación de red aproximada. ${activity?'Selecciona un lugar para consultar sus registros.':'Consulta los lugares con el puntero o la lista.'}${!activity&&soft?' Se omiten las señales sin coordenadas válidas y los puntos históricos (0,0) de origen ambiguo.':''}`;
    $('#map-source-label').textContent=activity?`Registro privado · 30 días${trafficStale?' · dato anterior':''}`:'Analítica agregada';
    $$('[data-map-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapSource===mapSource)));
  };
  // «Ciudades» frames the dots (never closer than a region), «Países» goes back to the whole world
  const fitCities = () => {
    const pts = mapMode === 'cities' ? mapCities.filter(c => Number.isFinite(c.lat)&&Number.isFinite(c.lon)).map(c => project([c.lon, c.lat])) : [];
    if (!pts.length) { view = { ...WORLD }; return setView(); }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const w = Math.min(WORLD.w, Math.max(70, (Math.max(...xs) - Math.min(...xs)) * 1.5, (Math.max(...ys) - Math.min(...ys)) * 1.5 * WORLD.w / WORLD.h)), h = w * WORLD.h / WORLD.w;
    view = { x: cx - w / 2, y: cy - h / 2, w, h }; setView();
  };
  const placesCard = () => {
    $('#map-selection').textContent = '';
    $$('#map .on').forEach(el => el.classList.remove('on'));
    $('#places-title').textContent = mapMode === 'cities' ? 'Ciudades' : 'Países';
    const activity=mapSource==='activity'&&trafficData;
    $('#places-hint').textContent = 'Diez primeros por actividad. '+(activity?'Selecciona un lugar para filtrar el registro.':'Recuentos agregados del periodo seleccionado.');
    const unavailable = !activity && last?.sourceHealth?.[mapMode === 'cities' ? 'cities' : 'visits']?.status === 'error';
    $('#countries').innerHTML = unavailable ? '<p class="empty">Esta fuente no se ha podido consultar. No equivale a cero visitas.</p>' : mapMode === 'cities'
      ? (mapCities.length ? bars(mapCities.map(c => ({ ...c, visits: c.n })), c => `${flag(c.country)}${placeName(c)}${c.region && c.region !== c.city ? ` · ${c.region}` : ''}`, r=>r.visits, r=>`data-place-city="${text(placeName(r))}" data-place-country="${text(r.country)}"`)
        : '<p class="empty">No hay registros con ciudad disponible en este periodo.</p>')
      : bars(Object.entries(mapVisits).map(([key,visits])=>({key,visits})), r => country(r.key), r=>r.visits, r=>`data-place-country="${text(r.key)}"`);
    sizeBars();
  };
  const renderMap = async (rows, places) => {
    mapVisits = Object.fromEntries(rows.filter(r => r.key && r.key !== 'XX').map(r => [r.key, r.visits]));
    mapCities = places || [];
    if (currentView !== 'traffic') return;
    if (!$('#map svg')) {
      try {
        const countries = await loadWorld();
        if(currentView!=='traffic')return;
        if($('#map svg')){paintMap();return;}
        const line=points=>points.map((p,i)=>(i?'L':'M')+project(p).map(n=>n.toFixed(3)).join(',')).join('');
        const grid=[...Array.from({length:11},(_,i)=>line(Array.from({length:31},(_,j)=>[-150+i*30,-75+j*5]))),...Array.from({length:5},(_,i)=>line(Array.from({length:73},(_,j)=>[-180+j*5,-60+i*30])))].join('');
        $('#map').innerHTML = `<svg viewBox="${view.x} ${view.y} ${view.w} ${view.h}" role="img" tabindex="0" aria-describedby="map-note" aria-label="Mapa del mundo por país">
<path d="${grid}" class="map-grid" aria-hidden="true"/>${countries.map(c => `<path d="${c.d}" data-c="${c.code}" data-n="${text(c.name)}"/>`).join('')}<g id="dots"></g><g id="map-labels" aria-hidden="true"></g></svg><div class="tip" id="maptip" hidden></div><span id="map-level" class="map-level">×1.0</span>
<div class="mapctl"><button class="btn btn-sm btn-icon" type="button" data-zoom="1.6" aria-label="Acercar">+</button><button class="btn btn-sm btn-icon" type="button" data-zoom="0.625" aria-label="Alejar">−</button><button class="btn btn-sm btn-icon" type="button" data-zoom="0" aria-label="Ver el mundo entero">⟲</button></div>`;
        wireMap();
      } catch { $('#map').innerHTML = '<p class="empty">No se ha podido cargar el mapa ahora mismo; tienes la lista de países al lado.</p>'; return; }
    }
    paintMap();
  };
  const refreshGeo = () => {
    const matchingAnalytics=last&&last.site===site&&Number(last.range.days)===days;
    if((mapSource==='activity'&&!trafficData)||(mapSource==='analytics'&&!matchingAnalytics)){
      const label=mapSource==='activity'?'Registro detallado pendiente de consulta':'Analítica pendiente de consulta';
      $('#map').innerHTML=`<p class="empty">${label}</p>`;$('#countries').innerHTML='<p class="empty">Sin datos para estos filtros todavía.</p>';$('#map-count').textContent='';$('#map-note').textContent='';$('#map-source-label').textContent=label;
      $$('[data-map-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapSource===mapSource)));return;
    }
    const activity=mapSource==='activity'&&trafficData;
    const rows=activity?(trafficData.countries||[]).map(r=>({key:r.key,visits:r.n})):(last?.countries||[]);
    const places=activity?(trafficData.places||[]):(last?.cities?.rows||[]);
    mapVisits=Object.fromEntries(rows.filter(r=>r.key&&r.key!=='XX').map(r=>[r.key,r.visits]));mapCities=places;
    placesCard(); renderMap(rows,places);
  };
  const wireMap = () => {
    const svg = $('#map svg'), tip = $('#maptip');
    const toMap = ev => { const b = svg.getBoundingClientRect(); return [view.x + (ev.clientX - b.left) / b.width * view.w, view.y + (ev.clientY - b.top) / b.height * view.h]; };
    let drag = null, suppressClick = false;
    svg.addEventListener('pointermove', ev => {
      if (drag) { if(Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)>4)drag.moved=true; const b = svg.getBoundingClientRect(); view.x = drag.vx - (ev.clientX - drag.x) / b.width * view.w; view.y = drag.vy - (ev.clientY - drag.y) / b.height * view.h; setView(); tip.hidden = true; return; }
      const dot = ev.target.closest('circle[data-city]'), p = dot ? null : ev.target.closest('path[data-c]');
      $$('#map .on').forEach(x => x !== p && x !== dot && x.classList.remove('on'));
      if (!p && !dot) { tip.hidden = true; return; }
      (p || dot).classList.add('on');
      const b = $('#map').getBoundingClientRect();
      if (dot) { const v = Number(dot.dataset.n); tip.innerHTML = `<b>${flag(dot.dataset.cc)}${text(dot.dataset.city)}</b><span>${text(dot.dataset.where)}</span><span>${fmt(v)} ${mapSource==='activity'?'registros':'páginas vistas'}</span>${dot.dataset.latest?`<span>Último: ${when(Number(dot.dataset.latest))}</span>`:''}`; }
      else { const v = mapVisits[p.dataset.c] || 0; tip.innerHTML = `<b>${flag(p.dataset.c)}${text(countryName(p.dataset.c) || p.dataset.n)}</b><span>${mapSource!=='activity'&&last?.sourceHealth?.visits?.status === 'error' ? 'Fuente no disponible' : v ? `${fmt(v)} ${mapSource==='activity'?'registros':'visitas'}` : 'Sin registros'}</span>`; }
      tip.hidden = false; tip.style.setProperty('--x', `${ev.clientX - b.left}px`); tip.style.setProperty('--y', `${ev.clientY - b.top}px`);
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; $$('#map .on').forEach(x => x.classList.remove('on')); });
    const choose = target=>{const dot=target.closest('circle[data-city]'),p=target.closest('path[data-c]');if(dot&&Number(dot.dataset.cluster)>1)zoom(2,Number(dot.getAttribute('cx')),Number(dot.getAttribute('cy')));else if(dot)selectPlace(dot.dataset.cc,dot.dataset.city);else if(p?.dataset.c)selectPlace(p.dataset.c);};
    svg.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse' || ev.button !== 0) return; drag = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y,target:ev.target,moved:false }; svg.setPointerCapture(ev.pointerId); svg.classList.add('dragging'); });
    const stop = ev => { if(drag){suppressClick=true;if(!drag.moved&&ev.type==='pointerup')choose(drag.target);} drag = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', stop); svg.addEventListener('pointercancel', stop);
    svg.addEventListener('click',ev=>{if(suppressClick){suppressClick=false;return;}choose(ev.target);});
    svg.addEventListener('wheel', ev => { if (!ev.ctrlKey && !ev.metaKey) return; ev.preventDefault(); const [cx, cy] = toMap(ev); zoom(ev.deltaY < 0 ? 1.25 : 0.8, cx, cy); }, { passive: false });
    svg.addEventListener('keydown', e => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)) return; e.preventDefault(); if (e.key==='Home') { view={...WORLD}; setView(); } else if (['+','=','-'].includes(e.key)) zoom(e.key==='-'?.8:1.25); else { view.x += e.key==='ArrowLeft'?-view.w*.08:e.key==='ArrowRight'?view.w*.08:0; view.y += e.key==='ArrowUp'?-view.h*.08:e.key==='ArrowDown'?view.h*.08:0; setView(); } });
  };

  // ---------- forms and security ----------
  const formsCard = f => {
    const rows = f.rows || [];
    const total = o => rows.filter(r => r.outcome === o).reduce((s, r) => s + r.n, 0);
    const by = (s, o) => rows.filter(r => r.site === s && r.outcome === o).reduce((a, r) => a + r.n, 0);
    const used = Object.keys(OUT).filter(o => total(o));
    if (!rows.length) return `<p class="empty">${f.note && f.note !== 'empty' ? 'No se han podido leer los formularios ahora mismo.' : 'Aún no hay envíos en este periodo (se cuentan desde el 18 de octubre de 2026).'}</p>`;
    return `<table><thead><tr><th>Resultado</th><th>Inicio</th><th>CV Online</th><th>IsAcademy</th><th>Total</th></tr></thead><tbody>${used.map(o =>
      `<tr><td><span class="dot ${OUT[o][1]}"></span>${OUT[o][0]}</td><td>${fmt(by('inicio', o))}</td><td>${fmt(by('cv', o))}</td><td>${fmt(by('isacademy', o))}</td><td><b>${fmt(total(o))}</b></td></tr>`).join('')}</tbody></table>`;
  };
  let closingSessions = false, sessionCloseNote = '';
  const renderSessionClose = () => {
    const button = $('[data-action="logout-all"]'), feedback = $('#session-close-feedback');
    if (button) {
      button.disabled = closingSessions;
      button.setAttribute('aria-busy', String(closingSessions));
      button.textContent = closingSessions ? 'Cerrando sesiones…' : 'Cerrar todas las sesiones';
    }
    if (feedback) { feedback.textContent = sessionCloseNote; feedback.hidden = !sessionCloseNote; }
  };
  const securityCard = d => {
    const blocked = (d.forms.rows || []).filter(r => ['turnstile', 'honeypot', 'origin', 'invalid'].includes(r.outcome)).reduce((s, r) => s + r.n, 0);
    const probes = d.pages.filter(p => probe(p.key));
    const acc = (d.security?.accesses || []).slice(0, 6);
    const lastIn = acc.find(a => a.kind === 'access');
    return `<div class="sec-kpis"><div><span class="k">Último acceso</span><b>${lastIn ? ago(lastIn.t) : '—'}</b><small>${lastIn ? text(lastIn.where) : ''}</small></div>
<div><span class="k">Peticiones rechazadas</span><b>${d.sourceHealth?.forms?.status === 'error' ? '—' : fmt(blocked)}</b><small>${d.sourceHealth?.forms?.status === 'error' ? 'Fuente no disponible' : 'Verificación, origen y validación del formulario'}</small></div>
<div><span class="k">Rutas a revisar</span><b>${d.sourceHealth?.visits?.status === 'error' ? '—' : fmt(probes.reduce((s, p) => s + p.views, 0))}</b><small>${d.sourceHealth?.visits?.status === 'error' ? 'Fuente no disponible' : 'Entre las páginas más vistas; puede incluir pruebas propias'}</small></div></div>
<h3 class="sub">Últimos accesos a IsPanel</h3><p class="note">Hasta seis entradas recientes; no es un historial completo.</p>${acc.length ? `<ul class="log">${acc.map(a => `<li><span class="dot ${a.kind === 'access' ? 'ok' : 'gold'}"></span><span>${a.kind === 'access' ? 'Entrada' : 'Enlace pedido'}</span><span class="m">${when(a.t)} · ${text(a.where)} · ${text(a.browser)}</span></li>`).join('')}</ul>` : '<p class="empty">Aún no hay accesos registrados.</p>'}
<p class="note">Si ves una entrada que no es tuya, cierra todas las sesiones: el enlace solo llega a tu correo y sirve una vez.</p>
<div class="sec-actions"><button class="btn btn-sm" type="button" data-action="logout-all" aria-describedby="session-close-feedback" aria-busy="${closingSessions}"${closingSessions ? ' disabled' : ''}>${closingSessions ? 'Cerrando sesiones…' : 'Cerrar todas las sesiones'}</button>
<a class="btn btn-sm btn-arrow" href="https://dash.cloudflare.com/profile/authentication" target="_blank" rel="noopener">Verificación en dos pasos de Cloudflare</a>
<a class="btn btn-sm btn-arrow" href="https://github.com/settings/security" target="_blank" rel="noopener">Seguridad de GitHub</a></div>
<p class="note" id="session-close-feedback" role="status" aria-live="polite"${sessionCloseNote ? '' : ' hidden'}>${text(sessionCloseNote)}</p>`;
  };

  // ---------- highlights: a few sentences that read the figures for you ----------
  const KPI_HELP = ['Llegadas a tus webs desde fuera (Cloudflare cuenta una visita cada vez que alguien llega desde otra web, un buscador o un enlace)',
    'Todas las páginas abiertas, también las que se ven dentro de una misma visita', 'Cuántas páginas abre de media cada visita',
    'Envíos aceptados por el proveedor de correo; no acredita entrega ni lectura del mensaje'];
  const longDay = s => new Date(s + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const share = (part, all) => all ? Math.round(part / all * 100) : 0;
  const insights = (d, sent, blocked) => {
    const out = [], total = d.total.visits;
    const best = d.daily.reduce((a, b) => (b.visits > a.visits ? b : a), d.daily[0] || { visits: 0 });
    if (best.visits) out.push(['★', `Tu mejor día fue el <b>${longDay(best.key)}</b>, con <b>${fmt(best.visits)}</b> visitas.`]);
    const today = d.daily.at(-1), before = d.daily.at(-2);
    if (today && d.sourceHealth?.visits?.status !== 'stale') out.push(['◷', `Hoy llevas <b>${fmt(today.visits)}</b> visita${today.visits === 1 ? '' : 's'}${before ? ` (ayer, ${fmt(before.visits)})` : ''}.`]);
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
    if (sent || blocked) out.push(['✉', `<b>${fmt(sent)}</b> envío${sent === 1 ? '' : 's'} aceptado${sent === 1 ? '' : 's'} por correo y <b>${fmt(blocked)}</b> ${blocked === 1 ? 'petición' : 'peticiones'} rechazada${blocked === 1 ? '' : 's'}; pueden incluir pruebas.`]);
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
    const sent = (d.forms.rows || []).filter(r => ['sent','notification_accepted'].includes(r.outcome)).reduce((s, r) => s + r.n, 0);
    const blocked = (d.forms.rows || []).filter(r => ['turnstile', 'honeypot', 'origin', 'invalid'].includes(r.outcome)).reduce((s, r) => s + r.n, 0);
    $('#kpis').innerHTML = [
      ['Visitas', d.total.visits, 0, delta(d.total.visits, d.previous.visits)],
      ['Páginas vistas', d.total.views, 0, delta(d.total.views, d.previous.views)],
      ['Páginas por visita', d.total.visits ? d.total.views / d.total.visits : 0, 1, '<span class="d">media</span>'],
      ['Correo aceptado', sent, 0, `<span class="d">${fmt(blocked)} peticiones rechazadas</span>`],
    ].map(([k, v, dec, s], i) => { const unavailable=d.sourceHealth?.[i<3?'visits':'forms']?.status==='error'; return `<div class="card kpi" title="${KPI_HELP[i]}"><span class="k">${k}</span>${unavailable?'<span class="v">—</span><span class="d">sin actualizar</span>':`<span class="v" data-count="${v}" data-dec="${dec}">0</span>${s}`}</div>`; }).join('');
    $('#insights').innerHTML = insights(d, sent, blocked).map(([icon, t], i) => `<li data-j="${i}"><span class="ii" aria-hidden="true">${icon}</span><span>${t}</span></li>`).join('');
    $$('#insights li').forEach(li => li.style.setProperty('--j', li.dataset.j));
    $('[data-action="more"]').hidden = $$('#insights li').length <= 4;
    $('#trends').innerHTML = d.sourceHealth?.visits?.status === 'error' ? '<li class="empty">Tráfico sin actualizar. No se muestran ceros para una fuente no disponible.</li>' : trends(d);
    $('#chart').innerHTML = d.sourceHealth?.visits?.status === 'error' ? '<p class="empty">Tráfico no disponible. Vuelve a consultarlo más adelante.</p>' : chart(d.daily); $('#chart').classList.toggle('static', !first || reduce);
    $('#sites').innerHTML = donut(Object.entries(d.sites).map(([k, v]) => ({ key: SITES[k][0], visits: v.visits })), r => r.key);
    $('#sources').innerHTML = bars(d.sources, r => source(r.key));
    $('#pages').innerHTML = bars(d.pages, r => pageName(r.key), r => r.views);
    $('#devices').innerHTML = donut(d.devices, r => device(r.key));
    $('#browsers').innerHTML = bars(d.browsers, r => tech(r.key));
    $('#systems').innerHTML = bars(d.systems, r => tech(r.key));
    if (d.sourceHealth?.visits?.status === 'error') ['sites','sources','pages','devices','browsers','systems'].forEach(id => { $(`#${id}`).innerHTML = '<p class="empty">Fuente de tráfico no disponible.</p>'; });
    $('#forms').innerHTML = formsCard(d.forms);
    $('#security').innerHTML = securityCard(d);
    last = d; sizeBars(); drawDonuts(); countUp(); wireChart(); refreshGeo();
    $$('.site-opt [data-n]').forEach(el => { const v = d.sites[el.dataset.n]?.visits; el.textContent = v == null ? '' : `${fmt(v)} visitas`; });
    if (first) { first = false; $$('main .card').forEach((el, n) => el.style.setProperty('--i', Math.min(n, 5))); document.body.classList.add('enter'); setTimeout(() => document.body.classList.remove('enter'), 1100); }
    const since = new Date(d.range.since + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    const until = d.sourceHealth?.visits?.status === 'stale' ? new Date(d.range.until + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : 'hoy';
    $('#range').textContent = `Del ${since} a ${until} (${d.range.days} ${d.range.days === 1 ? 'día' : 'días'}) · ${SITES[d.site][0]}${d.sourceHealth?.visits?.status === 'stale' ? ' · dato anterior de tráfico' : ''}`;
    $('#approx').hidden = false;
    $('#source-health').innerHTML = Object.entries(d.sourceHealth || {}).map(([k, v]) => `<span class="source-state ${text(v.status)}">${({visits:'Tráfico',forms:'Formularios',cities:'Ciudades'})[k] || text(k)} · ${({ok:'actualizado',empty:'sin datos',error:'no disponible',stale:'dato anterior'})[v.status] || text(v.status)}${v.status==='stale'&&v.generated?` · ${when(Date.parse(v.generated))}`:''}</span>`).join('');
    $('#error').hidden = !d.partial && !d.stale;
    if (d.partial || d.stale) $('#error').textContent = 'Hay fuentes pendientes de actualizar. Conservamos la fecha del último dato disponible; una fuente caída no significa cero actividad.';
    $$('[data-sites-only]').forEach(e => { e.hidden = d.site !== 'all'; });
    refreshedAt = Date.parse(d.generated); tick();
  };
  const tick = () => { if (refreshedAt) $('#fresh').textContent = `Consultado ${ago(refreshedAt)}`; };

  // ---------- private inbox: same filters, independent requests, no personal data in browser storage ----------
  const STATUS = { new: 'Nuevo', following: 'En seguimiento', resolved: 'Resuelto', archived: 'Archivado' };
  const NOTIFY = { accepted: 'Aceptado por Resend', pending: 'Aviso pendiente', failed: 'Aviso fallido', unknown: 'Aviso sin confirmar' };
  let contactItems = [], contactCursor = null, contactSeq = 0, contactController = null, detailSeq = 0, currentView = 'overview', loadedContactKey = '';
  const contactQuery = () => new URLSearchParams({ days: String(Math.min(days, 90)), site, status: $('#contact-status').value, q: $('#contact-search').value.trim(), limit: '25' });
  const contactStats = summary => {
    const pending = summary.new + summary.following;
    $('#contact-kpis').innerHTML = [['Por atender', summary.new], ['En seguimiento', summary.following], ['Resueltas', summary.resolved], ['Solicitudes', summary.total]]
      .map(([label, n]) => `<div><span class="k">${label}</span><b>${fmt(n)}</b></div>`).join('');
    if ($('#contact-search').value || $('#contact-status').value) { $('#attention-title').textContent='Tu bandeja tiene un filtro activo'; $('#attention-copy').textContent='Abre Contactos para consultar los resultados o retirar la búsqueda y el estado seleccionados.'; $('#inbox-badge').textContent=''; return; }
    $('#attention-title').textContent = pending ? `${fmt(pending)} ${pending === 1 ? 'solicitud necesita' : 'solicitudes necesitan'} tu atención` : 'Todo al día';
    $('#attention-copy').textContent = pending ? `${fmt(summary.new)} nuevas y ${fmt(summary.following)} en seguimiento.${summary.oldestPendingAt ? ` La más antigua llegó ${ago(summary.oldestPendingAt)}.` : ''}` : 'No hay solicitudes pendientes en el periodo y la web seleccionados.';
    $('#inbox-badge').textContent = pending ? fmt(pending) : '';
    $('#notification-note').textContent = summary.notificationFailed ? `${fmt(summary.notificationFailed)} ${summary.notificationFailed===1?'aviso de correo fallido':'avisos de correo fallidos'}. Las solicitudes están guardadas en la bandeja.` : 'Las solicitudes se guardan durante 90 días. El correo tiene su propia conservación.';
  };
  const renderContacts = () => {
    $('#contact-list').innerHTML = contactItems.length ? contactItems.map(c => `<button class="contact-row" type="button" data-contact="${text(c.id)}" aria-label="Abrir solicitud de ${text(c.name)}">
<span class="contact-avatar" aria-hidden="true">${text(c.name.slice(0, 1).toUpperCase())}</span><span class="contact-person"><b>${text(c.name)}</b><span>${text(c.company || c.details?.interest || c.details?.summary || c.email)}</span></span>
<span class="contact-origin">${text(SITES[c.site]?.[0] || c.site)}<small>${when(c.created_at)}</small></span><span class="status-chip ${text(c.status)}">${STATUS[c.status] || text(c.status)}</span><span class="row-arrow" aria-hidden="true">↗</span></button>`).join('')
      : '<div class="inbox-empty"><span aria-hidden="true">✉</span><h3>No hay solicitudes aquí</h3><p>Prueba otro filtro o vuelve más adelante. Las solicitudes anteriores a la activación de la bandeja siguen en tu correo.</p></div>';
    $('#contact-more').hidden = !contactCursor;
  };
  const loadContacts = async (append = false) => {
    const seq = ++contactSeq; contactController?.abort(); const controller = contactController = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000), query = contactQuery();
    const key=query.toString();
    if (key !== loadedContactKey) { contactItems=[];contactCursor=null;loadedContactKey=key;$('#contact-list').innerHTML='<p class="empty">Cargando solicitudes con estos filtros…</p>';$('#contact-count').textContent='Actualizando filtros…';$('#contact-more').hidden=true; }
    if (append && contactCursor) query.set('cursor', contactCursor);
    $('#contact-list').setAttribute('aria-busy', 'true'); $('#contact-error').hidden = true; $('#contact-more').disabled = true;
    try {
      const response = await fetch(`/api/contacts?${query}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (response.status === 401) { location.href = '/login'; return; }
      const data = await response.json(); if (seq !== contactSeq) return;
      if (data.error === 'contacts_disabled') {
        contactItems = []; contactCursor = null;
        $('#contact-list').innerHTML = '<p class="empty">La bandeja todavía no está activada. Los mensajes siguen llegando al correo.</p>';
        $('#contact-count').textContent = 'Bandeja desactivada'; $('#contact-more').hidden = true;
        $('#contact-kpis').innerHTML = [['Por atender'], ['En seguimiento'], ['Resueltas'], ['Solicitudes']].map(([label]) => `<div><span class="k">${label}</span><b>—</b></div>`).join('');
        $('#inbox-badge').textContent = ''; $('#attention-title').textContent = 'Tu correo sigue siendo el punto de encuentro';
        $('#attention-copy').textContent = 'La bandeja privada está pendiente de activación. Aquí aparecerán las nuevas solicitudes cuando esté lista.';
        $('#notification-note').textContent = 'La conservación de 90 días comenzará al activar esta bandeja. Los mensajes anteriores siguen en tu correo.';
        return;
      }
      if (!response.ok) throw new Error('La bandeja no está disponible ahora. Vuelve a intentarlo; tus filtros se conservan.');
      contactItems = append ? [...contactItems, ...data.items] : data.items; contactCursor = data.nextCursor;
      contactStats(data.summary); renderContacts();
      $('#contact-count').textContent = `${fmt(data.summary.total)} ${data.summary.total === 1 ? 'solicitud' : 'solicitudes'} · últimos ${Math.min(days, 90)} días`;
    } catch (error) {
      if (seq !== contactSeq) return;
      $('#contact-error').hidden = false; $('#contact-error').textContent = error.name === 'AbortError' ? 'La consulta está tardando demasiado. Vuelve a intentarlo.' : error.message;
      if(contactItems.length) $('#contact-count').textContent='Datos anteriores · no se han podido actualizar';
      if (!contactItems.length) { $('#contact-list').innerHTML = '<p class="empty">Los datos no se han cargado. Esto no significa que no haya solicitudes.</p>'; $('#contact-count').textContent = 'Bandeja sin actualizar'; }
      $('#attention-title').textContent = 'Revisa tu bandeja'; $('#attention-copy').textContent = 'No hemos podido actualizar las solicitudes. Puedes consultar las otras secciones; cada fuente muestra su estado.';
    } finally { clearTimeout(timeout); if (seq === contactSeq) { $('#contact-list').setAttribute('aria-busy', 'false'); $('#contact-more').disabled = false; } }
  };
  const detail = $('#contact-detail'); let detailContact = null, detailTrigger = null;
  const showDetail = item => {
    detailContact = item;
    $('#detail-title').textContent = item.name; $('#detail-meta').textContent = `${SITES[item.site]?.[0] || item.site} · ${when(item.created_at)}`;
    const labels={summary:'Resumen',subject:'Asunto',interest:'Interés',level:'Edad o nivel'};
    const fields = [['Email', item.email], ['Teléfono', item.phone], ['Empresa', item.company], ['Idioma de la solicitud', ({es:'Español',en:'Inglés'})[item.language]||item.language], ['Página de origen',item.page], ['Recibida',when(item.created_at)], ['Último cambio',when(item.updated_at)], ...Object.entries(item.details || {}).filter(([k]) => !['Nombre','Email','Mensaje','Empresa','Teléfono'].includes(k)).map(([k,v])=>[labels[k]||k,v])];
    $('#detail-fields').innerHTML = fieldMarkup(fields.filter(([,v]) => v != null && String(v).trim()));
    const contextFields = networkFields(item.context || {});
    $('#detail-network').innerHTML = contextFields.length ? fieldMarkup(contextFields) : '<p class="empty">Este contacto no tiene contexto de red disponible.</p>';
    $('#detail-message').textContent = item.message || 'No dejó un mensaje adicional.';
    $('#detail-state').value = item.status;
    $('#detail-notification').textContent = NOTIFY[item.notification_status] || 'Estado de aviso no disponible';
    $('#detail-expiry').textContent = `Sale de esta bandeja el ${new Date(item.expires_at).toLocaleDateString('es-ES', {timeZone:'Atlantic/Canary',day:'numeric',month:'long',year:'numeric'})}.`;
    const context = item.context || {}, place = [...new Set([context.city, context.region, countryName(context.country)].filter(v => v && v !== 'Desconocido'))].join(', ');
    $('#detail-context').textContent = [place ? `Ubicación de red aproximada: ${place}` : 'Ubicación de red no disponible', context.browser, context.os].filter(Boolean).join(' · ');
    $('#detail-email').href = `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent('Re: tu solicitud desde ' + (SITES[item.site]?.[0] || 'la web'))}`;
    const phone=String(item.phone||'').replace(/[^+\d]/g,'');
    $('#detail-phone').hidden = phone.replace(/\D/g,'').length<3; $('#detail-phone').href = `tel:${phone}`;
    $('#detail-feedback').textContent = '';
  };
  const openContact = async (id, trigger) => {
    const seq = ++detailSeq; detailTrigger = trigger; detailContact = null;
    $('#detail-title').textContent = 'Cargando solicitud…'; $('#detail-body').hidden = true; $('#detail-feedback').textContent = '';
    $('#contact-detail details').open=false;
    if (!detail.open) detail.showModal();
    detail.scrollTop=0;
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(id)}`, {headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
      const data = await response.json(); if (seq !== detailSeq || !detail.open) return;
      if (!response.ok) throw new Error(response.status === 404 ? 'Esta solicitud ya no está disponible o ha caducado.' : 'No se ha podido abrir la solicitud. Cierra y vuelve a intentarlo.');
      showDetail(data.item); $('#detail-body').hidden = false;
    } catch (error) { if (seq === detailSeq && detail.open) { $('#detail-title').textContent = 'Solicitud no disponible'; $('#detail-feedback').textContent = error.name === 'TimeoutError' ? 'La consulta está tardando demasiado.' : error.message; } }
  };
  detail.addEventListener('close', () => { detailSeq++; detailContact = null; if(detailTrigger?.isConnected) detailTrigger.focus(); else $('#tab-contacts').focus(); });
  $('#detail-state').addEventListener('change', async e => {
    const item = detailContact; if (!item) return;
    const selected = e.target.value; e.target.disabled = true;
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(item.id)}`, { method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:selected}),signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('No se pudo guardar el estado. Se conserva el anterior.');
      if (detailContact?.id === item.id) { detailContact.status = selected; $('#detail-feedback').textContent = 'Estado guardado.'; }
      await loadContacts();
    } catch (error) { if (detailContact?.id === item.id) { e.target.value = item.status; $('#detail-feedback').textContent = error.message; } }
    finally { e.target.disabled = false; }
  });
  const switchView = name => {
    if (!['overview','contacts','traffic','system'].includes(name)) return;
    currentView = name;
    if(location.hash.slice(1)!==name)history.replaceState(null,'','#'+name);
    $$('[data-panel-view]').forEach(el => { el.hidden = el.dataset.panelView !== name; });
    $$('[role="tab"][data-view]').forEach(el => { el.setAttribute('aria-selected', String(el.dataset.view === name)); el.tabIndex = el.dataset.view === name ? 0 : -1; });
    $('#workspace-title').textContent = ({overview:'Tu universo, de un vistazo.',contacts:'Cada conversación cuenta.',traffic:'Cómo llegan hasta ti.',system:'Todo bajo control.'})[name];
    $('#workspace-description').textContent = ({overview:'Lo que necesita tu atención y cómo evolucionan tus webs.',contacts:'Solicitudes, contexto y seguimiento en un solo lugar.',traffic:'Actividad recibida, mapa y contexto de cada registro.',system:'Estado de los formularios, acceso privado y servicios conectados.'})[name];
    if (name === 'traffic') { if(last){$('#chart').innerHTML = last.sourceHealth?.visits?.status === 'error' ? '<p class="empty">Tráfico no disponible. Vuelve a consultarlo más adelante.</p>' : chart(last.daily); $('#chart').classList.add('static'); wireChart();} refreshGeo(); }
  };
  let searchTimer;
  $('#contact-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadContacts(), 250); });
  $('#contact-status').addEventListener('change', () => loadContacts());

  // ---------- received activity: private 30-day events, independent of sampled Web Analytics ----------
  const trafficQuery = () => new URLSearchParams({days:String(Math.min(days,30)),site,q:$('#traffic-search').value.trim(),country:$('#traffic-country').value,asn:$('#traffic-asn').value.trim(),limit:'25'});
  const renderTrafficItems = () => {
    $('#traffic-list').innerHTML=trafficItems.length?trafficItems.map(item=>{const c=item.context||{};return `<button type="button" class="traffic-row" data-traffic-event="${text(item.id)}" aria-label="Abrir registro ${text(item.id)}"><span class="event-mark" aria-hidden="true">${flag(c.country)||'◎'}</span><span><b>${text(c.ip||'IP no disponible')}</b><small>${text([...new Set([c.city,c.region,countryName(c.country)].filter(v=>v&&v!=='Desconocido'))].join(', ')||'Ubicación no disponible')}</small></span><span><b>${text(SITES[item.site]?.[0]||item.site)}</b><small>${text(item.page)}</small></span><span><b>${text(c.asOrganization||'Operador no disponible')}</b><small>${text([c.browser,c.os].filter(Boolean).join(' · '))}</small></span><span class="event-time">${when(item.created_at)}<small>${c.verifiedBot===true?'Bot verificado':c.botScore===0?'Señal no calculada':c.botScore!=null?'Señal de bot: '+c.botScore+'/99':'Sin puntuación de bot'}</small></span><span class="row-arrow" aria-hidden="true">↗</span></button>`;}).join(''):'<div class="inbox-empty"><span aria-hidden="true">◎</span><h3>No hay registros con estos filtros</h3><p>Prueba otra web, ubicación o periodo.</p></div>';
    $('#traffic-more').hidden=!trafficCursor;
  };
  const renderTrafficSummary = d => {
    const s=d.summary;
    $('#traffic-kpis').innerHTML=[['Registros recibidos',s.events],['Direcciones de red',s.networkAddresses],['Con ubicación',s.withLocation],['Bots verificados',s.knownBots]].map(([label,n])=>`<div><span class="k">${label}</span><b>${fmt(n)}</b></div>`).join('');
    $('#traffic-count').textContent=`${fmt(s.events)} ${s.events===1?'registro':'registros'} · últimos ${Math.min(days,30)} días · consultado ${when(Number(d.generated))}`;
    $('#traffic-coverage').textContent=`${fmt(s.withLocation)} de ${fmt(s.events)} registros tienen coordenadas de red.${d.placesMeta?.truncated?' El mapa muestra '+fmt(d.placesMeta.limit)+' de '+fmt(d.placesMeta.groups)+' lugares; el listado permite consultar todos los registros.':''} ${fmt(s.unclassifiedBots)} sin puntuación de bot. Una dirección de red puede ser compartida.`;
    $('#traffic-networks').innerHTML=bars(d.networks||[],r=>r.organization?`${r.organization}${r.asn!=null?' · AS'+r.asn:''}`:r.asn!=null?'AS'+r.asn:'Sin operador',r=>r.n);
    $('#traffic-protocols').innerHTML=bars(d.protocols||[],r=>r.key&&r.key!=='unknown'?r.key:'No disponible',r=>r.n);
    const selected=$('#traffic-country').value;
    if(!selected&&!$('#traffic-search').value.trim()&&!$('#traffic-asn').value.trim()) $('#traffic-country').innerHTML='<option value="">Todos los países</option>'+(d.countries||[]).map(r=>`<option value="${text(r.key)}">${text(countryName(r.key))}</option>`).join('');
  };
  const loadTraffic = async (append=false) => {
    const asn=$('#traffic-asn').value.trim();
    if(asn&&(!/^\d+$/.test(asn)||Number(asn)<1||Number(asn)>4294967295)){trafficSeq++;trafficController?.abort();$('#traffic-list').setAttribute('aria-busy','false');$('#traffic-more').disabled=false;$('#traffic-error').hidden=false;$('#traffic-error').textContent='ASN: escribe un número entre 1 y 4294967295. Ese filtro todavía no se ha aplicado.';return;}
    const seq=++trafficSeq;trafficController?.abort();const controller=trafficController=new AbortController();
    const query=trafficQuery(),key=query.toString(),changed=key!==trafficKey;trafficKey=key;
    if(changed){trafficData=null;trafficStale=false;trafficItems=[];trafficCursor=null;$('#traffic-list').innerHTML='<p class="empty">Consultando registros…</p>';$('#traffic-count').textContent='Actualizando filtros…';$('#traffic-kpis').innerHTML=['Registros recibidos','Direcciones de red','Con ubicación','Bots verificados'].map(k=>`<div><span class="k">${k}</span><b>—</b></div>`).join('');$('#traffic-coverage').textContent='';$('#traffic-more').hidden=true;$('#traffic-networks').innerHTML=$('#traffic-protocols').innerHTML='<p class="empty">Consultando estos filtros…</p>';refreshGeo();}
    if(append&&trafficCursor)query.set('cursor',trafficCursor);
    const timeout=setTimeout(()=>controller.abort(),15000);$('#traffic-list').setAttribute('aria-busy','true');$('#traffic-error').hidden=true;$('#traffic-more').disabled=true;
    try {
      const read=async path=>{const response=await fetch(path,{signal:controller.signal,headers:{Accept:'application/json'}});if(response.status===401){location.href='/login';throw new Error('Sesión caducada.');}const data=await response.json();return{response,data};};
      const [overview,list]=await Promise.all([read('/api/traffic/summary?'+query),read('/api/traffic/events?'+query)]);
      if(seq!==trafficSeq)return;
      if(overview.data.error==='traffic_disabled'||list.data.error==='traffic_disabled') {
        trafficData=null;trafficStale=false;trafficItems=[];trafficCursor=null;mapSource='analytics';
        $('#traffic-kpis').innerHTML=['Registros recibidos','Direcciones de red','Con ubicación','Bots verificados'].map(k=>`<div><span class="k">${k}</span><b>—</b></div>`).join('');$('#traffic-more').hidden=true;$('#traffic-networks').innerHTML=$('#traffic-protocols').innerHTML='<p class="empty">Registro detallado sin activar.</p>';
        $('#traffic-count').textContent='Registro detallado pendiente de activación';$('#traffic-list').innerHTML='<p class="empty">Aquí aparecerán las señales recibidas después de activar el registro. La analítica agregada conserva su propio histórico.</p>';
        $('#traffic-coverage').textContent='Conservación prevista: 30 días. El histórico agregado anterior no permite reconstruir estos registros.';
        $('[data-map-source="activity"]').disabled=true;refreshGeo();return;
      }
      if(!overview.response.ok||!list.response.ok)throw new Error('No se ha podido consultar el registro de actividad. Vuelve a intentarlo.');
      $('[data-map-source="activity"]').disabled=false;
      trafficData=overview.data;trafficStale=false;trafficItems=append?[...trafficItems,...list.data.items]:list.data.items;trafficCursor=list.data.nextCursor;
      renderTrafficSummary(trafficData);renderTrafficItems();refreshGeo();
    }catch(error){if(seq!==trafficSeq)return;$('#traffic-error').hidden=false;$('#traffic-error').textContent=error.name==='AbortError'?'La consulta está tardando demasiado. Vuelve a intentarlo.':error.message;$('#traffic-count').textContent=trafficItems.length?'Datos anteriores · registro sin actualizar':'Registro no disponible';if(!trafficItems.length){$('#traffic-list').innerHTML='<p class="empty">Los registros no se han cargado. No equivale a cero actividad.</p>';$('#traffic-networks').innerHTML=$('#traffic-protocols').innerHTML='<p class="empty">Fuente no disponible.</p>';}trafficStale=!!trafficData;if(!trafficData)mapSource='analytics';refreshGeo();}
    finally{clearTimeout(timeout);if(seq===trafficSeq){$('#traffic-list').setAttribute('aria-busy','false');$('#traffic-more').disabled=false;}}
  };
  const selectPlace = (cc,city='') => {
    if(mapSource!=='activity'||!trafficData)return;
    if(city==='Lugar sin determinar')city='';
    if(![...$('#traffic-country').options].some(o=>o.value===cc))$('#traffic-country').add(new Option(countryName(cc),cc));
    $('#traffic-country').value=cc;$('#traffic-search').value=city;$('#traffic-asn').value='';
    $('#map-selection').textContent=[city,countryName(cc)].filter(Boolean).join(', ');loadTraffic();
    $('#traffic-log').scrollIntoView({behavior:reduce?'instant':'smooth',block:'start'});
  };
  const eventDialog=$('#traffic-detail');let eventTrigger=null,eventDetailSeq=0;
  const openTrafficEvent=async(id,trigger)=>{
    const seq=++eventDetailSeq;eventTrigger=trigger;$('#event-title').textContent='Abriendo registro…';$('#event-content').hidden=true;$('#event-feedback').textContent='';eventDialog.showModal();eventDialog.scrollTop=0;
    try{const response=await fetch('/api/traffic/events/'+encodeURIComponent(id),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});const data=await response.json();if(seq!==eventDetailSeq||!eventDialog.open)return;if(!response.ok)throw new Error(response.status===404?'El registro ha caducado o ya no está disponible.':'No se ha podido abrir el registro.');const item=data.item,c=item.context||{};$('#event-title').textContent=c.ip||'Registro sin IP disponible';$('#event-meta').textContent=`${SITES[item.site]?.[0]||item.site} · ${when(item.created_at)}`;$('#event-fields').innerHTML=fieldMarkup([['Página',item.page],['Procedencia',item.referrer||'No disponible'],['Recibido',when(item.created_at)],['Caduca',when(item.expires_at)],...networkFields(c)]);$('#event-content').hidden=false;}
    catch(error){if(seq===eventDetailSeq&&eventDialog.open){$('#event-title').textContent='Registro no disponible';$('#event-feedback').textContent=error.name==='TimeoutError'?'La consulta está tardando demasiado.':error.message;}}
  };
  eventDialog.addEventListener('close',()=>{eventDetailSeq++;if(eventTrigger?.isConnected)eventTrigger.focus();else $('#tab-traffic').focus();});
  let trafficSearchTimer;
  $('#traffic-search').addEventListener('input',()=>{clearTimeout(trafficSearchTimer);trafficSearchTimer=setTimeout(()=>loadTraffic(),300);});
  $('#traffic-asn').addEventListener('input',()=>{clearTimeout(trafficSearchTimer);trafficSearchTimer=setTimeout(()=>loadTraffic(),300);});
  $('#traffic-country').addEventListener('change',()=>loadTraffic());

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
  let loadSeq = 0, loadController = null;
  let reportRequestId=null,reportStatusSeq=0,reportTimer=null;
  const REPORT_LABELS={preparing:'Preparando el informe',sending:'Envío en curso',accepted:'Aceptado por Resend',failed:'No se pudo enviar',unknown:'Resultado sin confirmar'};
  const loadReports=async()=>{
    clearTimeout(reportTimer);
    const seq=++reportStatusSeq;
    try{const response=await fetch('/api/reports/status',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});if(response.status===401){location.href='/login';return;}if(!response.ok)throw new Error();const d=await response.json();if(seq!==reportStatusSeq)return;
      const pending=['preparing','sending'].includes(d.latest?.status);
      $('#report-send').disabled=!d.enabled||!d.configured||d.manualAvailableAt>Date.now()||pending;
      const waiting = Number.isFinite(d.manualAvailableAt) && d.manualAvailableAt > Date.now();
      const availableTime = waiting ? new Date(d.manualAvailableAt).toLocaleTimeString('es-ES', {
        timeZone: 'Atlantic/Canary', hour: '2-digit', minute: '2-digit', second: '2-digit',
      }) : '';
      $('#report-availability').textContent = !d.enabled ? 'El envío manual está pendiente de activación.'
        : !d.configured ? 'El envío manual no está disponible: falta comprobar su configuración.'
        : pending ? 'Hay una solicitud de informe en curso. Espera a conocer su resultado.'
        : d.latest?.status === 'unknown' ? `Revisa Resend antes de solicitar otro envío: el resultado anterior no está confirmado.${waiting ? ` La espera termina a las ${availableTime}, hora de Canarias.` : ''}`
        : waiting ? `Podrás solicitar otro informe a partir de las ${availableTime}, hora de Canarias.`
        : 'Disponible para solicitar un informe manual.';
      $('#report-schedule').textContent=d.enabled&&d.configured?'Lunes · 09:00 · hora de Canarias':'Programación preparada · pendiente de activación';
      $('#report-last').textContent=d.latest?`${REPORT_LABELS[d.latest.status]||'Estado no disponible'} · ${when(d.latest.updated_at)}`:'Todavía no se ha solicitado ningún informe.';
      $('#report-copy').textContent='Últimos 7 días de las tres webs, contactos pendientes y estado de las fuentes. Independiente de los filtros del panel.';
      if(pending||d.manualAvailableAt>Date.now()){const delay=pending?4000:Math.min(65000,d.manualAvailableAt-Date.now()+100);reportTimer=setTimeout(()=>loadReports(),delay);}
    }catch{if(seq===reportStatusSeq){$('#report-send').disabled=true;$('#report-availability').textContent='El envío está desactivado mientras no podamos comprobar su disponibilidad.';$('#report-schedule').textContent='Programación sin comprobar';$('#report-last').textContent='No se ha podido consultar el estado del informe. Puedes volver a actualizar.';}}
  };
  const sendReport=async()=>{
    const button=$('#report-send');button.disabled=true;$('#report-availability').textContent='El envío manual está en curso. Espera a conocer su resultado.';reportRequestId??=crypto.randomUUID();$('#report-feedback').textContent='Preparando el informe…';
    try{const response=await fetch('/api/reports/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:reportRequestId}),signal:AbortSignal.timeout(45000)});const d=await response.json();if(!response.ok)throw new Error(d.error==='wait'?'Espera un minuto antes de pedir otro informe.':d.error==='reports_disabled'?'El envío está pendiente de activación.':'No se ha podido solicitar el informe.');
      $('#report-feedback').textContent=d.item?.status==='accepted'?'Resend ha aceptado el informe para tu correo configurado.':d.item?.status==='unknown'?'El resultado no está confirmado. Revisa Resend antes de solicitar otro envío.':d.item?.status==='failed'?'El informe no se ha podido enviar. Revisa el estado de las fuentes y del correo.':'La solicitud ya está registrada; consulta el último resultado.';
      // A new conscious click may request another report after the server's cooldown. No automatic email retry.
      reportRequestId=null;
    }catch(error){$('#report-feedback').textContent=error.name==='TimeoutError'?'La respuesta está tardando. Actualiza el estado antes de volver a solicitarlo.':error.message;}
    finally{await loadReports();}
  };
  const load = async (fresh, gate) => {
    const seq = ++loadSeq; loadController?.abort(); const controller = loadController = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const requestedDays = days, requestedSite = site;
    document.body.classList.add('loading'); $('#error').hidden = true; syncControls();
    loadContacts();loadTraffic();loadReports();
    try {
      const res = await fetch(`/api/data?days=${requestedDays}&site=${requestedSite}${fresh ? '&fresh=1' : ''}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (res.status === 401) { location.href = '/login'; return; }
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || res.status);
      if (gate) await gate;   // the first figures appear as the opening lifts, so their animations are seen
      if (seq !== loadSeq) return;
      last = d; render(d);
    } catch (e) { if (seq === loadSeq) { $('#error').hidden = false; $('#error').textContent = 'No se han podido actualizar las métricas. Conservamos la última vista; prueba de nuevo.'; } }
    finally { clearTimeout(timeout); if (seq === loadSeq) document.body.classList.remove('loading'); }
  };
  const menu = $('#site-menu'), siteBtn = $('#site-btn');
  const openMenu = on => { menu.hidden = !on; siteBtn.setAttribute('aria-expanded', String(on)); if (on) menu.querySelector('[aria-checked="true"]')?.focus(); };
  const custom = $('#custom');
  document.addEventListener('click', async e => {
    const b = e.target.closest('button, a'); if (!b) { if (!e.target.closest('#site-menu')) openMenu(false); return; }
    if(b.dataset.action==='report-send'){sendReport();return;}
    if(b.dataset.action==='report-refresh'){loadReports();return;}
    if (b.dataset.view) { switchView(b.dataset.view); if (b.getAttribute('role') !== 'tab') $(`#tab-${b.dataset.view}`).focus(); return; }
    if (b.dataset.contact) { openContact(b.dataset.contact, b); return; }
    if (b.dataset.trafficEvent) { openTrafficEvent(b.dataset.trafficEvent,b); return; }
    if (b.dataset.action==='close-event') { eventDialog.close(); return; }
    if (b.dataset.action==='traffic-more') { loadTraffic(true); return; }
    if (b.dataset.action==='traffic-retry') { loadTraffic(); return; }
    if (b.dataset.action==='traffic-clear') { $('#traffic-search').value='';$('#traffic-country').value='';$('#traffic-asn').value='';view={...WORLD};loadTraffic();return; }
    if (b.dataset.mapSource) { mapSource=b.dataset.mapSource;refreshGeo();return; }
    if (b.dataset.action === 'close-detail') { detail.close(); return; }
    if (b.dataset.action === 'contact-more') { loadContacts(true); return; }
    if (b.dataset.action === 'contact-retry') { loadContacts(); return; }
    if (b.dataset.placeCountry) {
      const cc = b.dataset.placeCountry, city = b.dataset.placeCity;
      if(mapSource==='activity'&&trafficData){selectPlace(cc,city||'');return;}
      $$('#map .on').forEach(p => p.classList.remove('on'));
      if (city) { const place = mapCities.find(c => placeName(c) === city && c.country === cc); if (place && Number.isFinite(place.lat) && Number.isFinite(place.lon)) { const [x,y] = project([place.lon,place.lat]); view={x:x-35,y:y-35*WORLD.h/WORLD.w,w:70,h:70*WORLD.h/WORLD.w}; setView(); $('#map-selection').textContent=`${city}, ${countryName(cc)} · ${fmt(place.n)} páginas vistas. Ubicación aproximada.`; } else $('#map-selection').textContent=`${city}, ${countryName(cc)} · sin coordenadas disponibles para acercar el mapa.`; }
      else { const path=$$('#map path').find(p=>p.dataset.c===cc); path?.classList.add('on'); const box=path?.getBBox(); if(box){const w=Math.min(WORLD.w,Math.max(80,box.width*2,box.height*WORLD.w/WORLD.h*2));view={x:box.x+box.width/2-w/2,y:box.y+box.height/2-w*WORLD.h/WORLD.w/2,w,h:w*WORLD.h/WORLD.w};setView();} $('#map-selection').textContent=`${countryName(cc)} · ${fmt(mapVisits[cc]||0)} visitas.`; }
      return;
    }
    if (b === siteBtn) { openMenu(menu.hidden); return; }
    if (!b.closest('#site-menu')) openMenu(false);
    if (b.dataset.days) { days = Number(b.dataset.days); store.set('panel-days', days); custom.hidden = true; load(false); }
    else if (b.dataset.site) { site = b.dataset.site; store.set('panel-site', site); openMenu(false); load(false); }
    else if (b.dataset.action === 'custom') { custom.hidden = !custom.hidden; if (!custom.hidden) $('#custom-n').focus(); }
    else if (b.dataset.action === 'refresh') { b.classList.add('spin'); await load(true); b.classList.remove('spin'); }
    else if (b.dataset.action === 'more') { $('#insights').classList.remove('short'); b.hidden = true; }
    else if (b.dataset.mapmode) { mapMode = b.dataset.mapmode; store.set('panel-map', mapMode); refreshGeo();fitCities(); }
    else if (b.dataset.zoom) { const k = Number(b.dataset.zoom); if (k) zoom(k); else { view = { ...WORLD }; setView(); } }
    else if (b.dataset.action === 'theme') {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark'; store.set('ispanel-theme', document.documentElement.dataset.theme); window.syncIcon?.();
    }
    else if (b.dataset.action === 'logout-all') {
      if (closingSessions || !confirm('¿Cerrar todas las sesiones abiertas de IsPanel, también esta? Tendrás que pedir un enlace nuevo.')) return;
      closingSessions = true; sessionCloseNote = 'Cerrando sesiones…'; renderSessionClose();
      if (await requestSessionRevocation()) { location.href = '/login'; return; }
      closingSessions = false;
      sessionCloseNote = 'No hemos podido confirmar que se hayan cerrado todas las sesiones. Comprueba la conexión antes de repetir la acción.';
      renderSessionClose();
      if (currentView === 'system' && (document.activeElement === b || document.activeElement === document.body))
        $('[data-action="logout-all"]')?.focus();
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
    if (e.target.matches('[role="tab"][data-view]') && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
      const tabs = $$('[role="tab"][data-view]'), i = tabs.indexOf(e.target);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus(); switchView(tabs[next].dataset.view); e.preventDefault(); return;
    }
    if (e.key === 'Escape') { openMenu(false); custom.hidden = true; }
    if (!menu.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const items = $$('.site-opt button[data-site]'), i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); e.preventDefault();
    }
  });
  let timer = 0;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { if (last) { $('#chart').innerHTML = chart(last.daily); $('#chart').classList.add('static'); wireChart(); } if($('#map svg'))setView(); }, 150); });
  // the figures refresh themselves every 5 minutes while the page is on screen; «Actualizar» does it at once
  setInterval(() => { tick(); if (document.visibilityState === 'visible' && Date.now() - refreshedAt > 5 * 60000) load(true); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && refreshedAt && Date.now() - refreshedAt > 5 * 60000) load(true); });
  // Every entry uses the sites' real signature module; preferences never hide it permanently.
  const intro = $('#intro'), skipLink = $('.skip-link');
  const skipLinkWasInert = skipLink?.inert ?? false;
  let releaseIntroKeys = () => {};
  const lift = () => { if (!intro || intro.classList.contains('out')) return; intro.classList.add('out'); setTimeout(() => { const focusWasInside=intro.contains(document.activeElement); releaseIntroKeys(); intro.remove(); $('#workspace').inert=false; $('.topbar').inert=false; if(skipLink)skipLink.inert=skipLinkWasInert; if(focusWasInside){$('#workspace-title').tabIndex=-1;$('#workspace-title').focus({preventScroll:true});} }, 1250); };
  switchView(['overview','contacts','traffic','system'].includes(location.hash.slice(1))?location.hash.slice(1):'overview');
  addEventListener('hashchange',()=>{const name=location.hash.slice(1);if(['overview','contacts','traffic','system'].includes(name))switchView(name);});
  if (reduce || !intro) { intro?.remove(); load(false); }
  else {
    $('#workspace').inert=true;$('.topbar').inert=true;if(skipLink)skipLink.inert=true;$('#skip-intro').focus();
    let open,ended=false,signature=null,svg=null;
    const gate=new Promise(resolve=>{open=resolve;});
    const finish=()=>{if(ended)return;ended=true;if(svg&&signature)signature.skipSignature(svg);clearTimeout(safety);intro.classList.add('ready');open();lift();};
    const escape=event=>{if(event.key==='Escape'){event.preventDefault();finish();}else if(event.key==='Tab'&&!event.ctrlKey&&!event.altKey&&!event.metaKey){event.preventDefault();$('#skip-intro').focus();}};
    releaseIntroKeys=()=>document.removeEventListener('keydown',escape);
    const safety=setTimeout(finish,8500);$('#skip-intro').addEventListener('click',finish);document.addEventListener('keydown',escape);
    (async()=>{try{signature=await import(SIGNATURE_URL);if(ended)return;$('#intro-signature').innerHTML=signature.signatureSVG('panel-opening','Panel');svg=$('#intro .sig');await signature.playSignature(svg);if(!ended){intro.classList.add('ready');setTimeout(finish,1800);}}catch{intro.classList.add('ready');setTimeout(finish,1800);}})();
    load(false,gate);
  }
}

const ICON_SUN = '<svg class="i-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_MOON = '<svg class="i-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICON_LINK = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_REFRESH = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const PANEL_V2_CSS = `
@view-transition{navigation:none}
html{scroll-padding-top:88px}
.panel-page .topbar{z-index:30;background:var(--bg);backdrop-filter:none;isolation:isolate;box-shadow:var(--bar-shadow)}
.panel-page #intro.out{transition-duration:1.2s}
.report-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center}.report-card h2{margin-bottom:12px}.report-card p{max-width:740px}.report-actions{display:flex;flex-wrap:wrap;justify-content:end;gap:10px}.report-card .note{margin:6px 0}.report-card [role=status]{grid-column:1/-1;min-height:20px;color:var(--gold-text);font-size:13px;margin:0}.report-card #report-availability{grid-column:1/-1;margin:0}.report-card .eyebrow{font-size:10px}.report-card .hint{margin-bottom:14px}@media(max-width:1000px){.report-card{grid-template-columns:1fr}.report-actions{justify-content:start}.report-actions .btn{flex:1;min-height:44px}}
.panel-page #view-traffic .mapgrid{align-items:start}
.panel-page main{padding-top:32px}#workspace-title:focus{outline:none}.place-select{all:unset;cursor:pointer;font:inherit;font-size:14px;color:var(--text);text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:4px}.place-select:hover{color:var(--gold-text)}.map-selection{font-size:13px;color:var(--gold-text);margin-top:18px}.workspace-heading{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:12px 0 30px}.workspace-heading h1{font-size:clamp(29px,4vw,44px);line-height:1.16;max-width:850px}.workspace-heading p:last-child{margin:12px 0 0;color:var(--text-2);font-size:16px}.private-label{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;font-size:12px;color:var(--gold-text);padding:8px 12px;border:1px solid var(--line);border-radius:999px}.workspace-heading .eyebrow{font-size:11px;margin-bottom:10px}
.workspace-tabs{display:flex;border-bottom:1px solid var(--line);gap:6px;margin:0 0 24px}.workspace-tabs button{position:relative;display:flex;gap:9px;align-items:center;justify-content:center;min-height:52px;padding:12px 22px;border:0;background:none;color:var(--text-2);font-size:15px;transition:color var(--dur-fast),background var(--dur-fast)}.workspace-tabs button::after{content:'';position:absolute;bottom:-1px;left:16px;right:16px;height:2px;background:var(--gold);transform:scaleX(0);transition:transform var(--dur-base) var(--ease-out)}.workspace-tabs button[aria-selected=true]{color:var(--gold-text)}.workspace-tabs button[aria-selected=true]::after{transform:scaleX(1)}.workspace-tabs button:hover{background:var(--bg-alt);border-radius:12px 12px 0 0}.tab-icon{font-size:19px}.inbox-badge:not(:empty){font-size:11px;background:var(--gold);color:var(--on-gold);padding:1px 6px;border-radius:99px}
.data-meta{display:flex;gap:16px;flex-wrap:wrap;align-items:baseline}.source-health{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 20px}.source-state{font-size:11px;color:var(--text-2);border:1px solid var(--line);border-radius:99px;padding:3px 9px}.source-state::before{content:'·';font-size:16px;color:var(--ok);margin-right:5px}.source-state.error::before,.source-state.stale::before{color:var(--gold)}
.panel-page .card{margin-bottom:16px}.panel-page .card:hover{transform:none}.attention{display:flex;gap:22px;align-items:center;border-color:color-mix(in srgb,var(--gold) 45%,var(--line));background:linear-gradient(120deg,color-mix(in srgb,var(--gold) 6%,var(--surface)),var(--surface));padding:28px!important}.attention-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:color-mix(in srgb,var(--gold) 12%,transparent);color:var(--gold-text);font-size:26px;flex-shrink:0}.attention>div:nth-child(2){flex:1}.attention .eyebrow{font-size:10px;margin-bottom:8px}.attention h2{font-size:22px;letter-spacing:-.02em;text-transform:none;color:var(--text);margin:0 0 8px}.attention p:last-child{margin:0;color:var(--text-2);font-size:14px}.attention .btn{white-space:nowrap}.panel-page .kpis{gap:12px}.panel-page .kpi{min-height:145px;cursor:default}.panel-page .kpi .k{font-size:10px;letter-spacing:.08em}.panel-page .kpi .v{font-size:36px}.panel-page .kpi .d{font-size:11px}.panel-page .insights li{animation:none}.panel-page .pulse{animation-iteration-count:2}.panel-page #dots .city.big{animation:none}.panel-page #map svg{touch-action:pan-y}.panel-page #map svg:focus-visible{outline-offset:-3px}
.contact-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}.contact-kpis>div{border:1px solid var(--line);border-radius:16px;padding:18px 20px;background:var(--surface);display:grid;gap:8px}.contact-kpis .k{font-size:10px;letter-spacing:.08em}.contact-kpis b{font-size:30px;font-weight:600;line-height:1.1}.inbox-heading{display:flex;gap:16px;align-items:start;justify-content:space-between;margin-bottom:20px}.inbox-heading h2{margin-bottom:10px}.retention-label{font-size:11px;color:var(--text-2);border:1px solid var(--line);border-radius:99px;padding:4px 10px;white-space:nowrap}.inbox-controls{display:flex;align-items:center;gap:10px;margin-bottom:20px}.inbox input,.inbox select,#detail-state{font:inherit;font-size:14px;min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);padding:10px 12px;max-width:100%}.search-field{position:relative;flex:1;min-width:100px}.search-field input{width:100%;padding-left:34px}.search-field>span[aria-hidden]{position:absolute;left:12px;top:7px;font-size:22px;color:var(--text-2)}.inbox-controls .btn{white-space:nowrap}.contact-row{display:grid;grid-template-columns:42px minmax(0,1.6fr) minmax(120px,1fr) 130px 16px;align-items:center;gap:15px;width:100%;text-align:left;padding:19px 10px;border:0;border-top:1px solid var(--line);background:transparent;transition:background var(--dur-fast)}.contact-row:hover{background:var(--bg-alt)}.contact-avatar{width:40px;height:40px;border:1px solid color-mix(in srgb,var(--gold) 30%,var(--line));border-radius:12px;display:grid;place-items:center;font-size:17px;color:var(--gold-text);background:color-mix(in srgb,var(--gold) 6%,transparent)}.contact-person{display:grid;gap:4px;min-width:0}.contact-person b{font-size:15px;font-weight:600}.contact-person>span{font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.contact-origin{display:grid;gap:4px;font-size:12px}.contact-origin small{font-size:11px;color:var(--text-2)}.status-chip{justify-self:start;font-size:11px;padding:4px 9px;border-radius:99px;white-space:nowrap;background:var(--bg-alt);color:var(--text-2);border:1px solid var(--line)}.status-chip.new{color:var(--gold-text);background:color-mix(in srgb,var(--gold) 9%,transparent);border-color:color-mix(in srgb,var(--gold) 35%,var(--line))}.status-chip.following{color:var(--accent)}.status-chip.resolved{color:var(--ok)}.row-arrow{color:var(--gold-text)}.inbox-footer{border-top:1px solid var(--line);padding-top:16px;margin:4px 0 0;font-size:11px;color:var(--text-2)}.load-more{margin:10px auto 20px;display:flex}.form-notice{font-size:14px;color:var(--bad);padding:14px;border:1px solid var(--line);border-radius:12px}.inbox-empty{text-align:center;max-width:440px;margin:40px auto 48px;padding:10px}.inbox-empty>span{color:var(--gold-text);font-size:32px}.inbox-empty h3{font-size:21px;margin:18px 0 12px}.inbox-empty p{font-size:14px;color:var(--text-2)}.table-wrap{overflow-x:auto}
#contact-detail{width:min(760px,calc(100% - 28px));max-height:calc(100dvh - 40px);padding:30px;border:1px solid var(--line);border-radius:22px;background:var(--surface);color:var(--text);box-shadow:var(--shadow);overscroll-behavior:contain}#contact-detail::backdrop{background:color-mix(in srgb,var(--ink-900) 70%,transparent);backdrop-filter:blur(5px)}#contact-detail[open]{animation:up .25s var(--ease-out)}.detail-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.detail-top .eyebrow{margin:0;font-size:10px}#detail-title{font-size:30px;margin-bottom:8px}.detail-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:16px 0;border-block:1px solid var(--line);margin:20px 0}.detail-toolbar label{font-size:12px;color:var(--text-2)}#detail-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}#detail-fields>div{min-width:0}#detail-fields dt{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-2);margin-bottom:4px}#detail-fields dd{font-size:14px;overflow-wrap:anywhere;margin:0}#detail-message{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.7;border-left:2px solid var(--gold);padding:8px 0 8px 18px;margin:14px 0 24px}.detail-actions{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 14px}#detail-feedback{font-size:13px;color:var(--gold-text);min-height:20px;margin:10px 0 0}.panel-page button:disabled{opacity:.55;cursor:wait;transform:none;box-shadow:none}.panel-page #skip-intro{position:absolute;right:24px;top:24px;color:var(--text);border-color:var(--gold)}
@media(max-width:760px){.workspace-heading{margin-top:0;gap:12px}.private-label{display:none}.workspace-tabs button{padding:12px 14px;font-size:13px;flex:1;gap:6px}.workspace-tabs{gap:0}.workspace-tabs .tab-icon{font-size:16px}.attention{flex-wrap:wrap;padding:22px!important;gap:16px}.attention-icon{width:46px;height:46px;font-size:22px}.attention h2{font-size:20px}.attention .btn{margin-left:62px}.contact-row{grid-template-columns:38px minmax(0,1fr) auto;gap:12px;padding:17px 0}.contact-avatar{width:36px;height:36px}.contact-origin{grid-column:2;font-size:11px;display:flex;flex-wrap:wrap;gap:8px}.status-chip{grid-row:1;grid-column:3}.row-arrow{display:none}.inbox-controls{flex-wrap:wrap}.search-field{flex-basis:100%}.inbox-controls>label:nth-child(2){flex:1}.inbox-controls select{width:100%}.inbox-heading{display:block}.inbox-heading .retention-label{display:inline-block;margin-top:8px}.contact-kpis{grid-template-columns:1fr 1fr;gap:10px}.contact-kpis>div{padding:16px}.workspace-heading p:last-child{font-size:14px}.panel-page .kpi{padding:18px;min-height:130px}.panel-page .kpi .v{font-size:30px}.data-meta{gap:0}#range{flex-basis:100%}#contact-detail{padding:22px}.detail-toolbar .retention-label{white-space:normal}#detail-title{font-size:25px}.panel-page .seg .btn{min-height:40px}.panel-page .mapctl .btn{min-width:40px;min-height:40px}.panel-page .card{padding:20px}.source-health{gap:5px}.source-state{font-size:10px}}
.geo-source{display:flex;gap:16px;align-items:center;justify-content:space-between;margin:26px 0 14px}.geo-source .eyebrow{font-size:11px;margin:0}.panel-page #map{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:radial-gradient(ellipse at 50% 35%,color-mix(in srgb,var(--gold) 7%,var(--bg)),var(--bg));min-height:220px}.panel-page #map path.map-grid{fill:none;stroke:var(--gold);stroke-opacity:.14;stroke-width:.3;pointer-events:none}.panel-page #map path[data-c]{stroke:color-mix(in srgb,var(--text) 32%,var(--surface));stroke-width:.35}.panel-page #map path[data-c].on{stroke:var(--gold-text);stroke-width:1.1}.panel-page #map-labels{pointer-events:none}.panel-page #map-labels text{fill:var(--text);paint-order:stroke;stroke:var(--bg);stroke-width:1.3;stroke-linejoin:round;font-family:var(--font-sans)}.map-level{position:absolute;left:14px;bottom:14px;font-size:11px;color:var(--text-2);font-variant-numeric:tabular-nums}.map-legend{display:flex;align-items:center;gap:7px;font-size:10px;color:var(--text-2);margin-top:14px;flex-wrap:wrap}.map-legend i{width:5px;height:5px;background:var(--gold);border-radius:50%}.map-legend i:nth-of-type(2){width:8px;height:8px}.map-legend i:nth-of-type(3){width:12px;height:12px}.map-legend small{margin-left:auto;font-size:10px}.activity-log{scroll-margin-top:95px}.activity-controls{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:20px 0}.activity-controls label{display:grid;gap:7px;font-size:11px;color:var(--text-2)}.activity-controls .search-field{flex:1;min-width:220px}.activity-controls input,.activity-controls select{font:inherit;font-size:13px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:10px;min-height:44px;max-width:100%;padding:10px 12px}.activity-controls #traffic-asn{width:110px}.activity-controls button{min-height:44px}.traffic-row{width:100%;display:grid;grid-template-columns:34px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.3fr) 125px 16px;gap:14px;align-items:center;background:none;border:0;border-top:1px solid var(--line);padding:20px 0;text-align:left;color:var(--text)}.traffic-row:hover{background:var(--bg-alt)}.traffic-row>span{min-width:0}.traffic-row b{font-size:13px;font-weight:500;overflow-wrap:anywhere}.traffic-row small{display:block;color:var(--text-2);font-size:11px;margin-top:5px;overflow-wrap:anywhere}.event-mark{font-size:18px}.event-time{font-size:11px}.network-fields{display:grid;grid-template-columns:1fr 1fr;gap:19px 24px;margin:22px 0}.network-fields>div{min-width:0}.network-fields dt{font-size:10px;color:var(--text-2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}.network-fields dd{margin:0;font-size:14px;overflow-wrap:anywhere}.network-disclosure{border-block:1px solid var(--line);padding:18px 0;margin:24px 0}.network-disclosure summary{cursor:pointer;font-size:14px;color:var(--gold-text);min-height:28px}.panel-page .detail-actions{position:static;margin:0;padding:14px 0;background:var(--surface);border-bottom:1px solid var(--line)}.detail-actions .btn{font-size:13px;min-height:44px}.panel-page .detail-top{position:sticky;top:-30px;z-index:3;background:var(--surface);padding:10px 0}.panel-page .detail-toolbar{margin-top:0;border-top:0}#traffic-detail{width:min(820px,calc(100% - 28px));max-height:calc(100dvh - 40px);padding:30px;border:1px solid var(--line);border-radius:22px;background:var(--surface);color:var(--text);box-shadow:var(--shadow);overscroll-behavior:contain}#traffic-detail::backdrop{background:color-mix(in srgb,var(--ink-900) 70%,transparent);backdrop-filter:blur(5px)}#traffic-detail[open]{animation:up .25s var(--ease-out)}#event-title{font-size:clamp(22px,4vw,30px);overflow-wrap:anywhere;margin-bottom:10px}
#intro{cursor:default}#intro .intro-in{position:relative;display:block;width:min(760px,88vw);z-index:1}#intro-signature{width:100%;min-height:180px;display:flex;align-items:baseline;justify-content:center;font-size:clamp(50px,12vw,100px);font-weight:500}#intro-signature .brand-is{font-size:1.6em}#intro .sig:not(.is-live){visibility:hidden}#intro .sig{max-height:360px}#intro .intro-line{display:block;width:75%;margin:18px auto 0;animation:none;transition:transform .22s var(--ease-out)}#intro .intro-sub{display:block;animation:none;letter-spacing:.16em;transition:opacity .22s var(--ease-out);font-size:clamp(10px,2vw,13px)}#intro.ready .intro-line{transform:scaleX(1)}#intro.ready .intro-sub{opacity:1}.login-page main{position:relative;isolation:isolate}.login-page main>.ds-circuit{z-index:-1}.login-page .login{position:relative}
@media(min-width:1100px){#view-traffic .mapgrid{grid-template-columns:minmax(0,2.5fr) minmax(240px,1fr)}}
@media(max-width:900px){.traffic-row{grid-template-columns:28px minmax(0,1fr) minmax(0,1fr)}.traffic-row>span:nth-child(4){grid-column:2}.traffic-row .event-time{grid-column:3;grid-row:2}.traffic-row .row-arrow{display:none}.activity-controls .search-field{flex-basis:100%}}
@media(max-width:760px){.geo-source{align-items:start;flex-direction:column}.maphead{width:100%;margin-top:12px}.map-legend small{flex-basis:100%;margin-left:0}.panel-page .detail-top{top:-22px}#traffic-detail{padding:22px}.activity-controls{gap:10px}.activity-controls label{flex:1;min-width:0}.activity-controls input,.activity-controls select{width:100%}.activity-controls #traffic-asn{width:100%}.activity-controls .search-field{min-width:0}.panel-page .detail-actions{gap:8px}.detail-actions .btn{flex:1;justify-content:center}}
/* Retain readable text while fitting the five result columns on small phones. */
@media(max-width:480px){
  #forms :is(th,td){padding-inline:3px}
  #forms :is(th,td):first-child{padding-left:0}
  #forms :is(th,td):last-child{padding-right:0}
}
@media(max-width:480px){.workspace-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.workspace-tabs button{min-width:0;flex-direction:column;gap:4px;padding:10px 3px;font-size:12px;min-height:68px}.workspace-tabs button::after{left:4px;right:4px}.workspace-tabs .inbox-badge:not(:empty){position:absolute;top:4px;right:6px}#detail-fields,.network-fields{grid-template-columns:1fr}.traffic-row{gap:10px;font-size:12px}.traffic-row>span:nth-child(3){font-size:11px}.traffic-row b{font-size:12px}.geo-source .seg{width:100%}.geo-source .seg button{flex:1}#intro-signature{min-height:110px}}
@media(prefers-reduced-motion:reduce){.panel-page *{scroll-behavior:auto!important}.panel-page .insights li,.panel-page .spark{animation:none;clip-path:none}.panel-page #contact-detail[open]{animation:none}}
`;

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
.sec-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}.sec-kpis>div{background:var(--bg-alt);border-radius:14px;padding:12px 14px;display:grid;gap:2px}.sec-kpis b{font-size:20px;color:var(--text)}.sec-kpis small{font-size:12px;color:var(--text-2);overflow-wrap:anywhere}
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
#intro{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:var(--bg);color:var(--text);clip-path:inset(0 0 0 0);transition:clip-path .85s cubic-bezier(.7,0,.2,1);cursor:pointer}
#intro.out{clip-path:inset(0 0 100% 0)}.intro-in{display:grid;grid-template-columns:auto auto;align-items:baseline;justify-content:center}
.intro-is{font-family:var(--font-script);font-size:clamp(96px,16vw,170px);color:#e2b25c;line-height:1;clip-path:inset(0 100% 0 0);animation:ink .7s .05s cubic-bezier(.6,0,.2,1) forwards;filter:drop-shadow(0 0 22px rgba(226,178,92,.4))}
.intro-p{font-size:clamp(52px,9vw,96px);font-weight:700;letter-spacing:-.03em;opacity:0;transform:translateY(16px);animation:rise .4s .2s cubic-bezier(.2,.7,.2,1) forwards}
.intro-line{grid-column:1/-1;height:2px;margin-top:8px;background:linear-gradient(90deg,transparent,var(--gold),transparent);transform:scaleX(0);animation:grow .35s .4s ease-out forwards}
.intro-sub{grid-column:1/-1;text-align:center;margin-top:14px;font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:var(--text-2);opacity:0;animation:rise .35s .5s ease-out forwards}
@media (prefers-reduced-motion:reduce){#intro{display:none}.li,.lv{stroke-dashoffset:0}.area,.pt{opacity:1;transform:none}.spark{clip-path:none}}
@media (max-width:980px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.grid3{grid-template-columns:1fr 1fr}.mapgrid{grid-template-columns:1fr}}
@media (max-width:680px){.grid2,.grid3,.sec-kpis{grid-template-columns:1fr}.v{font-size:28px}.tag,.tools .btn-text{display:none}#site-btn{min-width:0;width:100%}.site-pick{flex-basis:100%}#site-menu{left:0;right:auto}.donut{grid-template-columns:110px 1fr}.donut svg{width:110px}.log li{grid-template-columns:auto 1fr}.log .m{grid-column:1/-1;text-align:left}}${PANEL_V2_CSS}`,
  html: `<a class="skip-link" href="#workspace">Ir al panel</a>
<div id="intro" role="dialog" aria-modal="true" tabindex="-1" aria-label="Presentación de IsPanel">${PANEL_CIRCUIT}<div class="intro-in"><div id="intro-signature"><span class="brand-is">Is</span><span>Panel</span></div><span class="intro-line"></span><span class="intro-sub">Tu universo, en buenas manos</span></div><button class="btn btn-sm" id="skip-intro" type="button">Saltar presentación</button></div>
<header class="topbar"><div class="container topbar-row"><a class="brand" href="/" aria-label="IsPanel"><span class="brand-is">Is</span><span class="brand-name">Panel</span></a><span class="tag">Tu espacio privado</span><span class="sp"></span>
<div class="tools"><button class="btn btn-sm" type="button" data-action="refresh" title="Actualizar métricas y solicitudes">${ICON_REFRESH}<span class="btn-text">Actualizar</span></button>
<button class="btn btn-sm btn-icon theme-btn" type="button" data-action="theme" aria-label="Cambiar modo claro / oscuro">${ICON_MOON}${ICON_SUN}</button><a class="btn btn-sm" href="/logout">Salir</a></div></div></header>
<main class="container" id="workspace"><div class="workspace-heading"><div><p class="eyebrow">Inicio · CV Online · IsAcademy</p><h1 id="workspace-title">Tu universo, de un vistazo.</h1><p id="workspace-description">Lo que necesita tu atención y cómo evolucionan tus webs.</p></div><span class="private-label"><span aria-hidden="true">◈</span> Solo para ti</span></div>
<nav class="workspace-tabs" role="tablist" aria-label="Secciones de IsPanel">${[['overview','Resumen','◈'],['contacts','Contactos','✉'],['traffic','Tráfico','◎'],['system','Sistema','⌘']].map(([key,label,icon],i)=>`<button type="button" role="tab" id="tab-${key}" data-view="${key}" aria-controls="view-${key}" aria-selected="${i===0}" tabindex="${i===0?'0':'-1'}"><span class="tab-icon" aria-hidden="true">${icon}</span>${label}${key==='contacts'?'<span id="inbox-badge" class="inbox-badge"></span>':''}</button>`).join('')}</nav>
<div class="controls"><div class="periods" role="group" aria-label="Periodo"><button class="btn btn-sm" type="button" data-days="7">7 días</button><button class="btn btn-sm" type="button" data-days="30">30 días</button><button class="btn btn-sm" type="button" data-days="90">90 días</button><button class="btn btn-sm" type="button" data-action="custom">Personalizado</button></div>
<div class="site-pick"><button class="btn" id="site-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="site-menu"><span class="sb"><span class="sb-name">Todas las webs</span><span class="sb-url"></span></span></button>
<div id="site-menu" role="menu" hidden>${Object.entries(SITES).map(([k,[name,href]])=>`<div class="site-opt"><button type="button" role="menuitemradio" aria-checked="false" data-site="${k}"><b>${name}</b><small>${href?href.replace(/^https:\/\//,''):'Inicio, CV Online e IsAcademy juntas'}</small><span data-n="${k}"></span></button>${href?`<a href="${href}" target="_blank" rel="noopener" aria-label="Abrir ${name} en una pestaña nueva">${ICON_LINK}</a>`:'<span></span>'}</div>`).join('')}</div></div></div>
<form id="custom" hidden><label for="custom-n">Ver los últimos</label><input id="custom-n" type="number" min="1" max="180" step="1" value="14" inputmode="numeric"><select id="custom-u" aria-label="Unidad"><option value="1">días</option><option value="7">semanas</option><option value="30">meses</option></select><button class="btn btn-sm btn-primary" type="submit">Aplicar</button><p id="custom-msg" role="alert"></p></form>
<div class="data-meta"><p id="range">Cargando…</p><p id="fresh" aria-live="polite"></p></div><div id="source-health" class="source-health" aria-label="Estado de las fuentes"></div><p id="error" role="status" hidden></p>
<div data-panel-view="overview" id="view-overview" role="tabpanel" aria-labelledby="tab-overview">
<section class="attention card"><div class="attention-icon" aria-hidden="true">✉</div><div><p class="eyebrow">Tu próxima acción</p><h2 id="attention-title">Actualizando tu bandeja…</h2><p id="attention-copy">Las solicitudes nuevas y en seguimiento aparecerán aquí.</p></div><button class="btn btn-primary btn-arrow" type="button" data-view="contacts">Ver contactos</button></section>
<section class="kpis" id="kpis" aria-label="Resumen de tráfico"></section>
<section class="card" data-sites-only><h2>Tendencia por web <small>visitas por día</small></h2><p class="hint">Una mirada a cada web. Pulsa su nombre para abrirla.</p><ul class="trends" id="trends"></ul></section>
<section class="card" id="highlights-card"><h2>Lo más destacado</h2><ul class="insights short" id="insights"></ul><button class="btn btn-sm more" type="button" data-action="more" hidden>Ver todo lo destacado</button></section>
<section class="card report-card"><div><p class="eyebrow">Tu resumen privado</p><h2>Informe por correo</h2><p class="hint" id="report-copy">Últimos 7 días de las tres webs, contactos pendientes y estado de las fuentes.</p><p class="note" id="report-schedule">Consultando programación…</p><p class="note" id="report-last">Consultando último resultado…</p></div><div class="report-actions"><a class="btn btn-arrow" href="/api/reports/preview" target="_blank" rel="noopener">Ver informe</a><button class="btn btn-primary btn-arrow" type="button" data-action="report-send" id="report-send" aria-describedby="report-availability" disabled>Enviármelo ahora</button><button class="btn btn-sm" type="button" data-action="report-refresh">Actualizar estado</button></div><p class="note" id="report-availability">Comprobando la disponibilidad del envío manual…</p><p id="report-feedback" role="status" aria-live="polite"></p></section>
<p class="note" id="notification-note">Las solicitudes se conservan durante 90 días.</p></div>
<div data-panel-view="contacts" id="view-contacts" role="tabpanel" aria-labelledby="tab-contacts" hidden>
<div id="contact-kpis" class="contact-kpis"><div><span class="k">Por atender</span><b>—</b></div><div><span class="k">En seguimiento</span><b>—</b></div><div><span class="k">Resueltas</span><b>—</b></div><div><span class="k">Solicitudes</span><b>—</b></div></div>
<section class="card inbox"><div class="inbox-heading"><div><h2>Tu bandeja</h2><p class="hint" id="contact-count">Cargando solicitudes…</p></div><span class="retention-label">90 días de conservación</span></div>
<div class="inbox-controls"><label class="search-field"><span class="sr-only">Buscar contactos</span><span aria-hidden="true">⌕</span><input id="contact-search" type="search" maxlength="200" placeholder="Nombre, email o mensaje" autocomplete="off"></label><label><span class="sr-only">Estado del contacto</span><select id="contact-status"><option value="">Todos los estados</option><option value="new">Nuevos</option><option value="following">En seguimiento</option><option value="resolved">Resueltos</option><option value="archived">Archivados</option></select></label><button class="btn btn-sm" data-action="contact-retry" type="button">Actualizar bandeja</button></div>
<p id="contact-error" class="form-notice" role="status" hidden></p><div id="contact-list" aria-busy="true"><p class="empty">Abriendo tu bandeja…</p></div><button class="btn btn-sm load-more" id="contact-more" data-action="contact-more" type="button" hidden>Ver más solicitudes</button>
<p class="inbox-footer">Filtrada por la web y el periodo seleccionados, hasta un máximo de 90 días. Los datos anteriores a su activación permanecen en tu correo.</p></section></div>
<div data-panel-view="traffic" id="view-traffic" role="tabpanel" aria-labelledby="tab-traffic" hidden>
<div class="contact-kpis" id="traffic-kpis"><div><span class="k">Registros recibidos</span><b>—</b></div><div><span class="k">Direcciones de red</span><b>—</b></div><div><span class="k">Con ubicación</span><b>—</b></div><div><span class="k">Bots verificados</span><b>—</b></div></div>
<div class="geo-source"><span id="map-source-label" class="eyebrow">Registro privado · 30 días</span><div class="seg" role="group" aria-label="Fuente del mapa"><button class="btn btn-sm" type="button" data-map-source="activity" aria-pressed="true">Registros</button><button class="btn btn-sm" type="button" data-map-source="analytics" aria-pressed="false">Analítica agregada</button></div></div>
<div class="mapgrid"><section class="card geo-card"><h2>Tu alcance en el mundo <span class="maphead"><small id="map-count"></small><span class="seg" role="group" aria-label="Ver el mapa por"><button class="btn btn-sm" type="button" data-mapmode="countries" aria-pressed="true">Países</button><button class="btn btn-sm" type="button" data-mapmode="cities" aria-pressed="false">Ciudades</button></span></span></h2><div id="map"><p class="empty">El mapa se carga al abrir esta sección…</p></div><div class="map-legend"><span>Menor actividad</span><i></i><i></i><i></i><span>Mayor</span><small>Arrastrar · zoom +/− · Inicio para volver</small></div><p class="note" id="map-note"></p></section><section class="card"><h2 id="places-title">Países</h2><p class="hint" id="places-hint"></p><div id="countries"></div><p class="map-selection" id="map-selection" aria-live="polite"></p></section></div>
<section class="card activity-log" id="traffic-log"><div class="inbox-heading"><div><h2>Registro de actividad</h2><p class="hint" id="traffic-count">Consultando registros…</p></div><span class="retention-label">30 días de conservación</span></div><p class="note" id="traffic-coverage"></p><div class="activity-controls"><label class="search-field"><span>Buscar en el registro</span><input id="traffic-search" type="search" maxlength="200" placeholder="IP, ciudad, operador o ruta" autocomplete="off"></label><label><span>País</span><select id="traffic-country"><option value="">Todos los países</option></select></label><label><span>ASN</span><input id="traffic-asn" type="text" inputmode="numeric" maxlength="10" placeholder="Número ASN" autocomplete="off"></label><button class="btn btn-sm" type="button" data-action="traffic-retry">Actualizar registro</button><button class="btn btn-sm" type="button" data-action="traffic-clear">Limpiar filtros</button></div><p id="traffic-error" class="form-notice" role="status" hidden></p><div id="traffic-list" aria-busy="true"><p class="empty">Consultando registros…</p></div><button class="btn btn-sm load-more" id="traffic-more" type="button" data-action="traffic-more" hidden>Ver más registros</button></section>
<div class="grid2"><section class="card"><h2>Principales redes y operadores</h2><p class="hint">Las diez primeras organizaciones por registros recibidos.</p><div id="traffic-networks"><p class="empty">Pendiente de consulta.</p></div></section><section class="card"><h2>Protocolos de conexión</h2><p class="hint">Protocolo que Cloudflare observó en las señales recibidas.</p><div id="traffic-protocols"><p class="empty">Pendiente de consulta.</p></div></section></div>
<p id="approx" class="note">Histórico de Web Analytics · Cloudflare puede estimar estos recuentos. Su medida de visitas y vistas es independiente del registro recibido.</p>
<section class="card"><h2>Visitas por día</h2><p class="hint">Usa el puntero o las flechas del teclado sobre la gráfica para consultar cada día.</p><div id="chart"></div><div class="legend"><span><i></i>Visitas</span><span><i class="v2"></i>Páginas vistas</span></div></section>
<div class="grid2"><section class="card" data-sites-only><h2>Por web</h2><p class="hint">Reparto de las visitas entre tus tres webs.</p><div id="sites"></div></section><section class="card"><h2>Dispositivo</h2><p class="hint">Ordenador, móvil o tableta.</p><div id="devices"></div></section><section class="card"><h2>De dónde vienen</h2><p class="hint">Origen declarado por el navegador. Algunos enlaces pueden aparecer como acceso directo.</p><div id="sources"></div></section><section class="card"><h2>Páginas más vistas</h2><p class="hint">Las rutas a revisar también pueden proceder de pruebas propias; no demuestran un ataque.</p><div id="pages"></div></section><section class="card"><h2>Navegador</h2><p class="hint">Familias de navegadores, agrupadas.</p><div id="browsers"></div></section><section class="card"><h2>Sistema operativo</h2><p class="hint">Distribución agregada de sistemas.</p><div id="systems"></div></section></div></div>
<div data-panel-view="system" id="view-system" role="tabpanel" aria-labelledby="tab-system" hidden>
<section class="card"><h2>Formularios</h2><p class="hint">Resultados de las peticiones. Aceptar un correo no acredita entrega ni lectura.</p><div class="table-wrap" id="forms"></div></section><section class="card"><h2>Acceso y actividad</h2><p class="hint">Tus accesos a IsPanel y peticiones que necesitan contexto.</p><div id="security"></div></section>
<section class="card" id="quick"><h2>Accesos rápidos</h2><p class="hint">Tus webs y los servicios que las mueven.</p><div class="links"><a class="btn btn-sm btn-arrow" href="${SITE}/" target="_blank" rel="noopener">Inicio</a><a class="btn btn-sm btn-arrow" href="${SITE}/cv/" target="_blank" rel="noopener">CV Online</a><a class="btn btn-sm btn-arrow" href="${SITE}/isacademy/" target="_blank" rel="noopener">IsAcademy</a><a class="btn btn-sm btn-arrow" href="https://dash.cloudflare.com/" target="_blank" rel="noopener">Cloudflare</a><a class="btn btn-sm btn-arrow" href="https://resend.com/emails" target="_blank" rel="noopener">Resend</a><a class="btn btn-sm btn-arrow" href="https://github.com/ismael-sarmiento" target="_blank" rel="noopener">GitHub</a></div><p class="note">El registro detallado y las fichas de contacto se consultan únicamente en esta sesión privada.</p></section></div>
<p class="foot">IsPanel · un espacio privado para cuidar tu universo · actualización cada 5 minutos mientras está abierto · fechas en hora de Canarias con su desfase GMT</p></main>
<dialog id="contact-detail" aria-labelledby="detail-title"><div class="detail-top"><span class="eyebrow">Solicitud de contacto</span><button class="btn btn-sm btn-icon" type="button" data-action="close-detail" aria-label="Cerrar solicitud">×</button></div><h2 id="detail-title">Solicitud</h2><p id="detail-meta" class="note"></p><div id="detail-body" hidden><div class="detail-actions"><a class="btn btn-primary btn-arrow" id="detail-email" href="mailto:">Responder por correo</a><a class="btn" id="detail-phone" href="tel:" hidden>Llamar</a></div><div class="detail-toolbar"><label for="detail-state">Seguimiento</label><select id="detail-state"><option value="new">Nuevo</option><option value="following">En seguimiento</option><option value="resolved">Resuelto</option><option value="archived">Archivado</option></select><span id="detail-notification" class="retention-label"></span></div><h3 class="sub">Datos de la solicitud</h3><dl id="detail-fields"></dl><h3 class="sub">Mensaje</h3><p id="detail-message"></p><details class="network-disclosure"><summary>Datos de conexión disponibles</summary><dl id="detail-network" class="network-fields"></dl><p class="note">Ubicación aproximada facilitada por la red. El operador corresponde al ASN de la conexión.</p></details><p class="note">Responder o llamar abre tu aplicación. Actualiza el seguimiento cuando lo hayas atendido.</p><p class="note" id="detail-context"></p><p class="note" id="detail-expiry"></p></div><p id="detail-feedback" role="status"></p></dialog>
<dialog id="traffic-detail" aria-labelledby="event-title"><div class="detail-top"><span class="eyebrow">Registro de actividad</span><button class="btn btn-sm btn-icon" type="button" data-action="close-event" aria-label="Cerrar registro">×</button></div><h2 id="event-title">Registro</h2><p class="note" id="event-meta"></p><div id="event-content" hidden><dl id="event-fields" class="network-fields"></dl><p class="note">Datos observados en una señal recibida por el Worker. Ubicación de red aproximada.</p></div><p id="event-feedback" role="status"></p></dialog>`,
}, `(${panelClient})(${JSON.stringify(SITES)}, ${JSON.stringify(MAP_URL)}, ${JSON.stringify(MAP_SRI)}, ${JSON.stringify(ISO)}, ${JSON.stringify(`${SITE}/assets/ds/signature.js?v=20261026a`)}, ${decodeWorldCountries}, ${requestSessionRevocation})`));

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname;
    try {
      if (path === '/login' && req.method === 'POST') return sendLink(req, env, url);
      if (path === '/login') return req.method === 'GET' ? (await authed(req, env)) ? redirect('/') : loginPage() : json({ error: 'method' }, 405, { Allow: 'GET, POST' });
      if (path === '/auth') {
        if (req.method !== 'GET') return json({ error: 'method' }, 405, { Allow: 'GET' });
        if (!(await validLink(env, url.searchParams.get('t')))) return loginPage('El enlace no es válido, ya se usó o ha caducado. Pide uno nuevo.');
        await remember(env, req, 'access');
        return redirect('/', { 'Set-Cookie': `${COOKIE}=${await signSession(env)}; Path=/; Max-Age=${SESSION_MS / 1000}; HttpOnly; Secure; SameSite=Lax` });
      }
      if (path === '/logout') return req.method === 'GET' ? redirect('/login', { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` }) : json({ error: 'method' }, 405, { Allow: 'GET' });
      if (path === '/logout-all') {
        if (req.method !== 'POST') return json({ error: 'method' }, 405, { Allow: 'POST' });
        if (req.headers.get('Origin') !== url.origin || !(await authed(req, env))) return json({ ok: false }, 403);
        const changed = await authStore(env).prepare('UPDATE panel_auth_state SET epoch = ? WHERE id = 1')
          .bind(crypto.randomUUID().replaceAll('-', '')).run();
        if (Number(changed.meta?.changes) !== 1) throw new Error('session_unavailable');
        return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
      }
      if (path === '/api/data') {
        if (!(await authed(req, env))) return json({ error: 'auth' }, 401);
        return req.method === 'GET' ? data(req, env, url) : json({ error: 'method' }, 405, { Allow: 'GET' });
      }
      if(path.startsWith('/api/reports/')){
        if(!(await authed(req,env)))return json({error:'auth'},401);
        try{return await reports(req,env,url);}catch{return json({error:'reports_unavailable'},503);}
      }
      if (path === '/api/contacts' || /^\/api\/contacts\/[^/]+$/.test(path)) {
        if (!(await authed(req, env))) return json({ error: 'auth' }, 401);
        const id = path === '/api/contacts' ? null : path.slice('/api/contacts/'.length);
        return contacts(req, env, url, id);
      }
      if (path === '/api/traffic/summary' || path === '/api/traffic/events' || /^\/api\/traffic\/events\/[^/]+$/.test(path)) {
        if (!(await authed(req, env))) return json({ error: 'auth' }, 401);
        const id = path.startsWith('/api/traffic/events/') ? path.slice('/api/traffic/events/'.length) : null;
        return traffic(req, env, url, path === '/api/traffic/summary' ? 'summary' : 'events', id);
      }
      if (path === '/') return req.method === 'GET' ? (await authed(req, env)) ? panelPage() : redirect('/login') : json({ error: 'method' }, 405, { Allow: 'GET' });
      if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
      return new Response('Not found', { status: 404, headers: secure(new Headers({ 'Content-Type': 'text/plain' }), 'x') });
    } catch {
      // Unavailable auth/revocation storage never degrades to an accepted session or reveals service details.
      if (path.startsWith('/api/')) return json({ error: 'session_unavailable' }, 503);
      if (path === '/login' && req.method === 'POST') return json({ ok: false, message: 'unavailable' }, 503);
      const page = loginPage('El acceso está temporalmente indisponible. Inténtalo de nuevo en unos minutos.');
      return new Response(page.body, { status: 503, headers: page.headers });
    }
  },
  async scheduled(event, env) {
    // Read boundaries work without cron. Purge all three tables even when capture flags have been disabled.
    // The production cron and D1 migrations are configured separately, after the local visual review is accepted.
    if (!env.CONTACTS_DB) return;
    const now = Date.now();
    await env.CONTACTS_DB.batch([
      env.CONTACTS_DB.prepare('DELETE FROM contacts WHERE expires_at <= ?').bind(now),
      env.CONTACTS_DB.prepare('DELETE FROM traffic_events WHERE expires_at <= ?').bind(now),
      env.CONTACTS_DB.prepare('DELETE FROM panel_link_tokens WHERE expires_at <= ?').bind(now),
      env.CONTACTS_DB.prepare('DELETE FROM panel_reports WHERE expires_at <= ?').bind(now),
    ]);
    const scheduled=Number(event?.scheduledTime);
    if(env.REPORTS_ENABLED==='true'&&reportConfigured(env)&&Number.isFinite(scheduled)&&scheduled<=now+300000&&scheduled>=now-DAY&&reportClock(scheduled).due){
      await deliverReport(new Request(PANEL_URL),env,'weekly','weekly:'+reportClock(scheduled).date);
    }
  },
};
