// Local visual adapter for the exact Workers. No production authentication or network code is changed.
// Node 24+: node tools/cloudflare/qa/preview.mjs --port 8788
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash, createHmac } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import panelWorker from '../isa-panel.js';
import formsWorker from '../isa-forms.js';

const DAY = 86400000;
const SITE = 'https://ismael-sarmiento.github.io';
const SECRET = 'local-preview-signing-key-never-use-in-production';
const SCENARIOS = ['normal', 'intro', 'many', 'empty', 'partial', 'error', 'slow', 'disabled', 'mail-failed', 'mail-unknown'];
const LABELS = { normal: 'Con datos', intro: 'Repetir presentación', many: '1500 señales', empty: 'Sin datos', partial: 'Datos parciales', error: 'Fuentes caídas', slow: 'Respuesta lenta', disabled: 'Captura desactivada', 'mail-failed':'Correo rechazado', 'mail-unknown':'Correo sin confirmar' };
const ASSETS = resolve(fileURLToPath(new URL('../../../assets/', import.meta.url)));
const PUBLIC_ROOTS = { inicio: resolve(ASSETS, '..'), cv: resolve(ASSETS, '../../cv'), isacademy: resolve(ASSETS, '../../isacademy') };
const schema = (await Promise.all(['0001_contacts.sql', '0002_panel_activity.sql', '0003_panel_reports.sql'].map(name => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')))).join('\n');
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

class MemoryKV {
  values = new Map();
  async get(key, type) {
    const item = this.values.get(key);
    if (!item || item.expires && item.expires <= Date.now()) return null;
    return type === 'json' ? JSON.parse(item.value) : item.value;
  }
  async put(key, value, options = {}) {
    this.values.set(key, { value: String(value), expires: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null });
  }
  async delete(key) { this.values.delete(key); }
}

// The D1 contract is exercised against SQLite, including migration constraints and transactional batches.
class MemoryD1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.sqlite.exec(schema); }
  prepare(sql) {
    const native = this.sqlite.prepare(sql);
    let values = [];
    const execute = () => {
      if (/^\s*(?:SELECT|WITH|PRAGMA)\b/i.test(sql) || /\bRETURNING\b/i.test(sql))
        return { success: true, results: native.all(...values).map(row => ({ ...row })), meta: { changes: 0 } };
      const result = native.run(...values);
      return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    };
    const statement = {
      bind(...args) { values = args; return statement; },
      async first(column) { const row = native.get(...values); return row ? column ? row[column] : { ...row } : null; },
      async all() { return execute(); }, async run() { return execute(); }, _execute: execute,
    };
    return statement;
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try { const results = statements.map(statement => statement._execute()); this.sqlite.exec('COMMIT'); return results; }
    catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  async exec(sql) { this.sqlite.exec(sql); return { count: 1, duration: 0 }; }
  close() { if (!this.closed) { this.sqlite.close(); this.closed = true; } }
}

const DEMO_CONTACTS = [
  { name: 'Demo Ana · plataforma de datos', email: 'ana.demo@example.com', phone: '+12025550148', company: 'Demo Datos', site: 'cv', age: .08,
    message: 'Hola, Ismael. Estamos valorando una plataforma de datos con gobierno y calidad.\n¿Podemos comentar el alcance y los próximos pasos?',
    status: 'new', notification_status: 'accepted', context: { country: 'ES', region: 'Canarias', city: 'Las Palmas de Gran Canaria', latitude: 28.1, longitude: -15.4, browser: 'Chrome', os: 'macOS' } },
  { name: 'Demo Bruno · clases de Python', email: 'bruno.demo@example.com', site: 'isacademy', age: .5,
    message: 'Quiero reforzar Python para un proyecto universitario. Me vendrían bien clases por la tarde y ejercicios prácticos.',
    status: 'new', notification_status: 'failed', details: { interest: 'Python', level: 'Universidad' },
    context: { country: 'ES', region: 'Madrid', city: 'Madrid', latitude: 40.4, longitude: -3.7, browser: 'Safari', os: 'iOS' } },
  { name: 'Demo Carla · colaboración', email: 'carla.demo@example.com', company: 'Demo Salud', site: 'cv', age: 2,
    message: 'Me interesa explorar una colaboración sobre interoperabilidad clínica y calidad del dato. ¿Tienes disponibilidad la semana que viene?',
    status: 'following', notification_status: 'accepted', context: { country: 'DE', region: 'Berlin', city: 'Berlin', latitude: 52.5, longitude: 13.4, browser: 'Firefox', os: 'Windows' } },
  { name: 'Demo Diego · aula abierta', email: 'diego.demo@example.com', site: 'isacademy', age: 4,
    message: '', status: 'new', notification_status: 'unknown', details: { interest: 'Aula abierta (gratuita)', level: 'Bachillerato' },
    context: { country: 'MX', region: 'Ciudad de México', city: 'Ciudad de México', latitude: 19.4, longitude: -99.1, browser: 'Chrome', os: 'Android' } },
  { name: 'Demo Eva · SQL aplicado', email: 'eva.demo@example.com', site: 'isacademy', age: 8,
    message: 'Busco mejorar consultas SQL y entender cómo organizar un modelo analítico. Mi nivel actual es intermedio.',
    status: 'following', notification_status: 'accepted', details: { interest: 'SQL', level: 'Profesional · intermedio' },
    context: { country: 'CO', region: 'Bogotá', city: 'Bogotá', latitude: 4.7, longitude: -74.1, browser: 'Edge', os: 'Windows' } },
  { name: 'Demo Félix · arquitectura', email: 'felix.demo@example.com', company: 'Demo Ingeniería', site: 'cv', age: 14,
    message: 'Gracias por la conversación. Quedamos en revisar la propuesta cuando cerremos el alcance interno.',
    status: 'resolved', notification_status: 'accepted', context: { country: 'PT', region: 'Lisboa', city: 'Lisboa', latitude: 38.7, longitude: -9.1, browser: 'Safari', os: 'macOS' } },
  { name: 'Demo Gala · consulta general', email: 'gala.demo@example.com', site: 'inicio', age: 25,
    message: 'Ejemplo de una solicitud archivada. Este texto y sus datos son ficticios; sirve para revisar los filtros del panel.',
    status: 'archived', notification_status: 'pending', context: { country: 'US', region: 'New York', city: 'New York', latitude: 40.7, longitude: -74, browser: 'Other', os: 'Other' } },
];

function seed(db, scene) {
  if (scene === 'empty') return;
  const now = Date.now();
  for (const [index, demo] of DEMO_CONTACTS.entries()) {
    const created = now - Math.round(demo.age * DAY), id = `demo-contact-${index + 1}`;
    const row = { id, request_key: createHash('sha256').update(id).digest('hex'), created_at: created, expires_at: created + 90 * DAY,
      site: demo.site, page: `${SITE}${demo.site === 'inicio' ? '/' : `/${demo.site}/`}`, language: index === 2 ? 'en' : 'es',
      name: demo.name, email: demo.email, phone: demo.phone || '', company: demo.company || '', message: demo.message,
      details_json: JSON.stringify({ summary: 'Solicitud ficticia para la revisión visual de IsPanel.', subject: `Demostración: ${demo.name}`, ...demo.details }),
      context_json: JSON.stringify(index === 6 ? { country: 'US' } : { ...demo.context, ip: `192.0.2.${index + 10}`, regionCode: index === 0 ? 'CN' : undefined,
        continent: ['ES','DE','PT'].includes(demo.context.country) ? 'EU' : demo.context.country === 'CO' ? 'SA' : 'NA',
        postalCode: index === 0 ? '35001' : undefined, timezone: index === 0 ? 'Atlantic/Canary' : undefined,
        asn: 64500 + index, asOrganization: `Red de demostración ${index + 1}`, colo: ['MAD', 'MAD', 'FRA', 'MEX', 'BOG', 'LIS'][index],
        httpProtocol: index % 2 ? 'HTTP/2' : 'HTTP/3', tlsVersion: 'TLSv1.3', tlsCipher: 'AEAD-AES128-GCM-SHA256',
        ...(index % 2 ? { clientTcpRtt: 28 + index } : { clientQuicRtt: 12 + index }),
        device: index === 1 || index === 3 ? 'mobile' : 'desktop', language: index === 2 ? 'en-GB' : 'es-ES',
        botScore: index === 0 ? 99 : undefined, verifiedBot: index === 0 ? false : undefined, rayId: `000000000000000${index}-${index === 2 ? 'FRA' : 'MAD'}` }), status: demo.status, notification_status: demo.notification_status,
      provider_id: demo.notification_status === 'accepted' ? `demo-provider-${index + 1}` : null, updated_at: created };
    const keys = Object.keys(row);
    db.sqlite.prepare(`INSERT INTO contacts (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...Object.values(row));
  }
  seedTraffic(db, scene, now);
}

// Synthetic signals only: RFC 5737 / RFC 3849 documentation networks, no visitor identity.
const DEMO_PLACES = [
  ['ES', 'Canarias', 'Las Palmas de Gran Canaria', 28.12, -15.43, 'Atlantic/Canary', 'MAD'],
  ['ES', 'Madrid', 'Madrid', 40.42, -3.7, 'Europe/Madrid', 'MAD'],
  ['DE', 'Berlin', 'Berlin', 52.52, 13.4, 'Europe/Berlin', 'FRA'],
  ['MX', 'Ciudad de México', 'Ciudad de México', 19.43, -99.13, 'America/Mexico_City', 'MEX'],
  ['CO', 'Bogotá', 'Bogotá', 4.71, -74.07, 'America/Bogota', 'BOG'],
  ['PT', 'Lisboa', 'Lisboa', 38.72, -9.14, 'Europe/Lisbon', 'LIS'],
  ['US', 'New York', 'New York', 40.71, -74.01, 'America/New_York', 'EWR'],
  ['JP', 'Tokyo', 'Tokyo', 35.68, 139.69, 'Asia/Tokyo', 'NRT'],
  ['AU', 'New South Wales', 'Sydney', -33.87, 151.21, 'Australia/Sydney', 'SYD'],
  ['ZA', 'Western Cape', 'Cape Town', -33.92, 18.42, 'Africa/Johannesburg', 'CPT'],
  ['BR', 'São Paulo', 'São Paulo', -23.55, -46.63, 'America/Sao_Paulo', 'GRU'],
  ['GB', 'England', 'London', 51.51, -.13, 'Europe/London', 'LHR'],
];
function seedTraffic(db, scene, now) {
  const count = scene === 'many' ? 1500 : 42;
  const insert = db.sqlite.prepare('INSERT INTO traffic_events (id,created_at,expires_at,site,page,referrer,context_json) VALUES (?,?,?,?,?,?,?)');
  for (let index = 0; index < count; index++) {
    const place = DEMO_PLACES[index % DEMO_PLACES.length], site = ['cv', 'inicio', 'isacademy'][index % 3];
    const created = now - (index + 1) * Math.floor(29 * DAY / count), complete = index % 11 !== 0;
    const context = complete ? { ip: index % 7 === 0 ? `2001:db8::${(index + 1).toString(16)}` : `${['192.0.2', '198.51.100', '203.0.113'][index % 3]}.${index % 200 + 1}`,
      country: place[0], region: place[1], city: place[2],
      latitude: place[3] + (scene === 'many' ? (index % 41 - 20) / 100 : 0),
      longitude: place[4] + (scene === 'many' ? (index % 37 - 18) / 100 : 0), timezone: place[5],
      asn: 64500 + index % 5, asOrganization: `Operador de demostración ${index % 5 + 1}`, colo: place[6],
      httpProtocol: index % 2 ? 'HTTP/2' : 'HTTP/3', tlsVersion: 'TLSv1.3', tlsCipher: 'AEAD-AES128-GCM-SHA256',
      ...(index % 2 ? { clientTcpRtt: index % 7 === 0 ? 0 : 15 + index % 120 } : { clientQuicRtt: 5 + index % 60 }),
      browser: ['Chrome', 'Safari', 'Firefox', 'Edge'][index % 4], os: ['macOS', 'iOS', 'Windows', 'Android'][index % 4],
      device: index % 4 % 2 ? 'mobile' : 'desktop', language: place[0] === 'ES' ? 'es-ES' : 'en-US',
      botScore: index % 5 === 0 ? 0 : index % 5 === 1 ? undefined : 99,
      verifiedBot: index % 5 === 0 ? true : index % 5 === 1 ? undefined : false,
      rayId: `${index.toString(16).padStart(16, '0')}-${place[6]}` } : { country: place[0], browser: 'Other' };
    insert.run(`demo-traffic-${String(index + 1).padStart(4, '0')}`, created, created + 30 * DAY, site,
      site === 'inicio' ? '/' : `/${site}/`, ['', 'linkedin.com', 'github.com', 'www.google.com'][index % 4], JSON.stringify(context));
  }
}

const portion = (total, weights) => {
  const sum = weights.reduce((a, b) => a + b, 0), values = weights.map(weight => Math.floor(total * weight / sum));
  for (let left = total - values.reduce((a, b) => a + b, 0), i = 0; left > 0; left--, i++) values[i % values.length]++;
  return values;
};
const dayString = value => new Date(value).toISOString().slice(0, 10);
function fixtureDays(from, until, site) {
  const today = Date.parse(dayString(Date.now())), start = Date.parse(from), end = Date.parse(until), records = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start > 181 * DAY) return records;
  for (let stamp = start; stamp <= end; stamp += DAY) {
    const age = Math.round((today - stamp) / DAY), cycle = ((age % 30) + 30) % 30;
    const visits = (4 + Number(cycle < 27)) * (age >= 30 ? .8 : 1), views = (14 + Number(cycle < 10)) * (age >= 30 ? .8 : 1);
    const allVisits = Math.round(visits), allViews = Math.round(views);
    const sites = ['inicio', 'cv', 'isacademy'], index = sites.indexOf(site);
    records.push({ day: dayString(stamp), visits: index < 0 ? allVisits : portion(allVisits, [35, 40, 25])[index],
      views: index < 0 ? allViews : portion(allViews, [35, 40, 25])[index] });
  }
  return records;
}
const groupRow = (visits, views, dimension, key) => ({ count: views, sum: { visits }, ...(dimension ? { dimensions: { [dimension]: key } } : {}) });

// Read the actual aliases, dates and dimensions emitted by the Worker, including its split current/previous ranges.
function graphFixture(query, scene) {
  const account = {}, groups = /([A-Za-z_][A-Za-z_0-9]*):\s*rumPageloadEventsAdaptiveGroups\(([\s\S]*?)\)\s*\{\s*count\s+sum\s*\{\s*visits\s*\}(?:\s*dimensions\s*\{\s*(\w+)\s*\})?\s*\}/g;
  for (const match of query.matchAll(groups)) {
    const [, alias, filter, dimension] = match;
    if (scene === 'empty') { account[alias] = []; continue; }
    const from = filter.match(/date_geq:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
    const until = filter.match(/date_leq:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
    const site = filter.includes('requestPath_like: "/cv/%"') ? 'cv' : filter.includes('requestPath_like: "/isacademy/%"') ? 'isacademy'
      : filter.includes('requestPath_notlike:') ? 'inicio' : 'all';
    const records = fixtureDays(from, until, site), visits = records.reduce((sum, record) => sum + record.visits, 0), views = records.reduce((sum, record) => sum + record.views, 0);
    if (!dimension) account[alias] = [groupRow(visits, views)];
    else if (dimension === 'date') account[alias] = records.map(record => groupRow(record.visits, record.views, 'date', record.day));
    else {
      const dimensions = {
        countryName: [['ES', 'MX', 'CO', 'US', 'DE', 'PT'], [59, 11, 10, 8, 7, 5]],
        refererHost: [['', 'www.linkedin.com', 'github.com', 'www.google.com'], [37, 31, 20, 12]],
        requestPath: [site === 'all' ? ['/', '/cv/', '/isacademy/'] : [site === 'inicio' ? '/' : `/${site}/`], site === 'all' ? [35, 40, 25] : [1]],
        deviceType: [['desktop', 'mobile', 'tablet'], [57, 39, 4]],
        userAgentBrowser: [['Chrome', 'Safari', 'Firefox', 'Edge'], [49, 26, 16, 9]],
        userAgentOS: [['Windows', 'macOS', 'Android', 'iOS', 'Linux'], [32, 29, 20, 15, 4]],
      };
      const [keys, weights] = dimensions[dimension] || [[], []], v = keys.length ? portion(visits, weights) : [], p = keys.length ? portion(views, weights) : [];
      account[alias] = keys.map((key, index) => groupRow(v[index], p[index], dimension, key));
    }
  }
  if (!Object.keys(account).length) throw new Error('Unsupported local GraphQL fixture query');
  return { data: { viewer: { accounts: [account] } } };
}

function analyticsFixture(sql, scene) {
  if (scene === 'empty') return { data: [] };
  const selected = sql.match(/AND blob1 = '(inicio|cv|isacademy)'/)?.[1], days = Number(sql.match(/INTERVAL '(\d+)' DAY/)?.[1] || 30);
  if (sql.includes('isa_forms_events')) {
    const rows = [];
    for (const site of ['inicio', 'cv', 'isacademy']) {
      if (selected && selected !== site) continue;
      const contacts = DEMO_CONTACTS.filter(contact => contact.site === site && contact.age < days);
      if (contacts.length) rows.push({ site, outcome: 'stored', n: contacts.length });
      for (const [state, outcome] of [['accepted', 'notification_accepted'], ['failed', 'notification_failed'], ['unknown', 'notification_unknown']]) {
        const n = contacts.filter(contact => contact.notification_status === state).length;
        if (n) rows.push({ site, outcome, n });
      }
      rows.push({ site, outcome: 'turnstile', n: site === 'cv' ? 3 : 1 }, { site, outcome: 'honeypot', n: 1 });
    }
    return { data: rows };
  }
  if (sql.includes('isa_site_views')) {
    const locations = [
      ['ES', 'Canarias', 'Las Palmas de Gran Canaria', 28.1, -15.4], ['ES', 'Madrid', 'Madrid', 40.4, -3.7],
      ['MX', 'Ciudad de México', 'Ciudad de México', 19.4, -99.1], ['CO', 'Bogotá', 'Bogotá', 4.7, -74.1],
      ['US', 'New York', 'New York', 40.7, -74], ['DE', 'Berlin', 'Berlin', 52.5, 13.4], ['PT', 'Lisboa', 'Lisboa', 38.7, -9.1],
    ];
    const total = fixtureDays(dayString(Date.now() - (days - 1) * DAY), dayString(Date.now()), selected || 'all').reduce((sum, record) => sum + record.views, 0);
    const counts = portion(total, [42, 21, 13, 8, 7, 6, 3]);
    return { data: locations.map(([country, region, city, lat, lon], index) => ({ country, region, city, lat, lon, n: counts[index] })) };
  }
  throw new Error('Unsupported local Analytics Engine fixture query');
}

function wait(milliseconds, signal) {
  return new Promise((resolveWait, reject) => {
    if (signal?.aborted) return reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolveWait(); }, milliseconds);
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal.reason || new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

const PREVIEW_CSS = `
.preview-banner{position:relative;z-index:61;padding:10px max(16px,calc((100% - 1240px)/2));background:var(--surface);border-bottom:1px solid var(--line);font:12px/1.5 var(--font-sans);color:var(--text-2)}
.preview-banner strong{color:var(--gold-text);font-weight:600}.preview-banner p{margin:0 0 6px}.preview-banner nav{display:flex;gap:6px 12px;flex-wrap:wrap}.preview-banner a{color:var(--text);text-underline-offset:3px}.preview-banner a[aria-current=page]{color:var(--gold-text);font-weight:600}.preview-banner small{display:block;margin-top:6px}
.panel-page #intro #skip-intro{top:auto;bottom:24px}
`;
function previewHTML(body, scene) {
  // This fixture alone ignores the one-time preference, so the owner can review the opening again.
  // Production Worker HTML and browser storage remain unchanged.
  if (scene === 'intro') body = body.replace("store.get('panel-opening-seen') === '1'", 'false');
  const links = SCENARIOS.map(name => `<a href="/__preview/scenario?name=${name}"${name === scene ? ' aria-current="page"' : ''}>${LABELS[name]}</a>`).join('');
  const banner = `<aside class="preview-banner" aria-label="Vista previa local"><p><strong>Vista local · datos ficticios · sin correos reales</strong> — escenario: ${esc(LABELS[scene])}.</p><nav aria-label="Escenarios de prueba">${links}<a href="/login">Ver acceso</a><a href="/">Volver al panel</a></nav><small>Los cambios de estado son locales. Reiniciar el servidor o cambiar de escenario restablece los ejemplos. La autenticación de producción se conserva; este adaptador firma solo las peticiones locales.</small></aside>`;
  if(!body.includes('</style>'))body=body.replace('</head>',`<style>${PREVIEW_CSS.replaceAll('var(--surface)','var(--surface,#141b40)').replaceAll('var(--line)','var(--line,#343b58)').replaceAll('var(--font-sans)','var(--font-sans,Arial,sans-serif)').replaceAll('var(--text-2)','var(--text-2,#d2d6e3)').replaceAll('var(--text)','var(--text,#f6f1e7)').replaceAll('var(--gold-text)','var(--gold-text,#e5b45e)')}</style></head>`);
  else body=body.replace('</style>', `${PREVIEW_CSS}</style>`);
  return body.replaceAll(`${SITE}/assets/`, '/assets/')
    .replace(/(<body\b[^>]*>)/, `$1${banner}`);
}

// Read-only copies for shared-component visual QA. Generated source files are never rewritten.
// Only known public paths are exposed; production mail endpoints are blocked by the preview-only CSP.
async function publicSiteFile(url) {
  const alias = url.pathname.match(/^\/__sites\/(inicio|cv|isacademy)\/?$/);
  const natural = url.pathname.match(/^\/(cv|isacademy)(\/.*)?$/);
  if (!alias && !natural && !/^\/(?:data|i18n)\//.test(url.pathname)) return null;
  const site = alias?.[1] || natural?.[1] || 'inicio', root = PUBLIC_ROOTS[site];
  let relative = alias ? 'index.html' : natural ? (natural[2] || '/').slice(1) || 'index.html' : url.pathname.slice(1);
  if (relative.endsWith('/')) relative += 'index.html';
  if (!/^(?:index\.html|en\/index\.html|(?:assets|css|js|i18n|data|articles)\/[^\\]*|[a-zA-Z0-9-]+\.pdf)$/.test(relative)
    || relative.split('/').some(part => part.startsWith('.') || part === '..')) return { status: 404, body: 'Public file not available' };
  const path = await realpath(resolve(root, relative)).catch(() => null);
  if (!path || !path.startsWith(root + sep) || !(await stat(path)).isFile()) return { status: 404, body: 'Public file not found' };
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf' }[extname(path)];
  if (!mime) return { status: 404, body: 'Public file type not available' };
  let body = await readFile(path);
  if (mime.startsWith('text/html')) {
    let html = body.toString().replace(/<script\b[^>]*src="https:\/\/static\.cloudflareinsights\.com\/[^"]*"[^>]*><\/script>/g, '');
    html = html.replace(/connect-src[^;"]*/, "connect-src 'self' https://cdn.jsdelivr.net");
    if (alias && site !== 'inicio') {
      html = html.replace(/(href|src)="((?:assets|css|js)\/)/g, '$1="/' + site + '/$2');
    }
    body = Buffer.from(html);
  }
  return { status: 200, mime, body };
}

export function createPreview({ port = 8788, host = '127.0.0.1' } = {}) {
  if (host !== '127.0.0.1' && host !== '::1') throw new Error('Preview must bind to loopback');
  const requestScope = new AsyncLocalStorage(), databases = new Set(), originalFetch = globalThis.fetch;
  let scene = 'normal', currentEnv, started = false, server;
  const reset = name => {
    scene = name;
    const db = new MemoryD1(); databases.add(db); seed(db, name);
    const events = [], views = [];
    currentEnv = { CONTACTS_ENABLED: name === 'disabled' ? 'false' : 'true', TRAFFIC_ENABLED: name === 'disabled' ? 'false' : 'true', REPORTS_ENABLED: name === 'disabled' ? 'false' : 'true',
      CONTACTS_DB: name === 'error' ? { prepare() { throw new Error('Simulated unavailable D1'); } } : db,
      PANEL_KV: new MemoryKV(), PANEL_SECRET: SECRET, PANEL_EMAIL: 'owner.demo@example.com', FORM_TO: 'owner.demo@example.com',
      ACCOUNT_ID: 'local-preview-account', SITE_TAG: 'local-preview-site', CF_API_TOKEN: 'local-preview-only',
      TURNSTILE_SECRET: 'local-preview-only', RESEND_API_KEY: 'local-preview-only',
      ALLOWED_ORIGIN: SITE, ALLOWED_HOSTS: 'ismael-sarmiento.github.io',
      FORM_EVENTS: { writeDataPoint: point => events.push(point) }, SITE_VIEWS: { writeDataPoint: point => views.push(point) } };
    currentEnv.PANEL_KV.put('access-log', JSON.stringify([{ t: Date.now() - 90 * 60000, kind: 'access', where: 'Ubicación de demostración', browser: 'Chrome · macOS' }]));
  };
  reset(scene);
  const network = async (input, options = {}) => {
    const url = String(input instanceof Request ? input.url : input), context = requestScope.getStore();
    if (!context) throw new Error('Network blocked outside a local preview request');
    const known = url === 'https://api.cloudflare.com/client/v4/graphql'
      || /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/local-preview-account\/analytics_engine\/sql$/.test(url)
      || url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify' || url === 'https://api.resend.com/emails';
    if (!known) throw new Error(`External network blocked by local preview: ${new URL(url).origin}`);
    if (context.scene === 'slow') {
      context.delay ||= wait(8000, AbortSignal.any([context.signal, ...(options.signal ? [options.signal] : [])]));
      await context.delay;
    }
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      const hostname = context.path === '/login' ? context.hostname : 'ismael-sarmiento.github.io';
      return json({ success: true, hostname });
    }
    if (url === 'https://api.resend.com/emails') {
      if(context.scene==='mail-failed')return json({error:'simulated_provider_rejection'},422);
      if(context.scene==='mail-unknown')throw new Error('Simulated unconfirmed email; nothing sent');
      return json({ id: 'demo-email-never-sent' });
    }
    if (context.scene === 'error') throw new Error('Simulated unavailable analytics');
    if (url.endsWith('/graphql')) return json(graphFixture(JSON.parse(options.body).query, context.scene));
    if (context.scene === 'partial' && String(options.body).includes('isa_forms_events')) return json({ error: 'Simulated Analytics Engine failure' }, 503);
    return json(analyticsFixture(String(options.body), context.scene));
  };
  server = createServer(async (incoming, outgoing) => {
    const abort = new AbortController();
    incoming.on('aborted', () => abort.abort());
    outgoing.on('close', () => { if (!outgoing.writableEnded) abort.abort(); });
    try {
      const address = server.address(), base = `http://${host === '::1' ? '[::1]' : host}:${address.port}`;
      const url = new URL(incoming.url, base);
      if (url.pathname === '/__preview/scenario') {
        const name = url.searchParams.get('name');
        if (!SCENARIOS.includes(name)) { outgoing.writeHead(400); outgoing.end('Unknown preview scenario'); return; }
        reset(name); outgoing.writeHead(303, { Location: '/', 'Cache-Control': 'no-store' }); outgoing.end(); return;
      }
      const siteAlias = url.pathname.match(/^\/__sites\/(cv|isacademy)\/?$/);
      if (siteAlias) { outgoing.writeHead(303, { Location: '/' + siteAlias[1] + '/' + url.search, 'Cache-Control': 'no-store' }); outgoing.end(); return; }
      const publicFile = await publicSiteFile(url);
      if (publicFile) {
        if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405, { Allow: 'GET, HEAD' }); outgoing.end(); return; }
        outgoing.writeHead(publicFile.status, { 'Content-Type': publicFile.mime || 'text/plain', 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' });
        outgoing.end(incoming.method === 'HEAD' ? undefined : publicFile.body); return;
      }
      if (url.pathname.startsWith('/assets/')) {
        if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405, { Allow: 'GET, HEAD' }); outgoing.end(); return; }
        const path = resolve(ASSETS, decodeURIComponent(url.pathname.slice('/assets/'.length)));
        const canonical = await realpath(path).catch(() => null);
        if (!canonical || !canonical.startsWith(`${ASSETS}${sep}`) || !(await stat(canonical)).isFile()) { outgoing.writeHead(404); outgoing.end('Asset not found'); return; }
        const mime = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }[extname(canonical)];
        if (!mime) { outgoing.writeHead(404); outgoing.end('Asset not supported'); return; }
        outgoing.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        outgoing.end(incoming.method === 'HEAD' ? undefined : await readFile(canonical)); return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) if (value != null && key !== 'host') headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      const env = currentEnv, activeScene = scene;
      if (url.pathname !== '/login') {
        const epoch = await env.PANEL_KV.get('session-epoch') || '1', expires = Date.now() + DAY;
        const signature = createHmac('sha256', SECRET).update(`session.${epoch}.${expires}`).digest('base64url');
        headers.set('Cookie', `__Host-isa_panel=${epoch}.${expires}.${signature}`);
      } else headers.delete('Cookie');
      let body;
      if (!['GET', 'HEAD'].includes(incoming.method)) {
        const chunks = []; let length = 0;
        for await (const chunk of incoming) { length += chunk.length; if (length > 128000) throw new Error('Preview request too large'); chunks.push(chunk); }
        body = Buffer.concat(chunks);
      }
      const request = new Request(url, { method: incoming.method, headers, body, signal: abort.signal });
      Object.defineProperty(request, 'cf', { value: { country: 'ES', region: 'Canarias', city: 'Ciudad de demostración', latitude: '28.1', longitude: '-15.4' } });
      const response = await requestScope.run({ scene: activeScene, path: url.pathname, hostname: url.hostname, signal: abort.signal }, async () => {
        if (activeScene === 'slow' && (url.pathname.startsWith('/api/contacts') || url.pathname.startsWith('/api/traffic'))) await wait(8000, abort.signal);
        return url.pathname.startsWith('/__preview/forms') || url.pathname === '/hit'
          ? formsWorker.fetch(request, env) : panelWorker.fetch(request, env);
      });
      const resultHeaders = Object.fromEntries(response.headers);
      let bytes;
      if (response.headers.get('Content-Type')?.includes('text/html')) {
        bytes = Buffer.from(previewHTML(await response.text(), activeScene));
        resultHeaders['content-security-policy'] = response.headers.get('Content-Security-Policy')
          .replace(/script-src[^;]*/, "$& 'self'").replace(/style-src[^;]*/, "$& 'self'").replace(/font-src[^;]*/, "$& 'self'").replace(/img-src[^;]*/, "$& 'self'");
      } else bytes = Buffer.from(await response.arrayBuffer());
      outgoing.writeHead(response.status, resultHeaders); outgoing.end(incoming.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (abort.signal.aborted || outgoing.destroyed) return;
      outgoing.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end(JSON.stringify({ error: 'preview_error', message: error.message }));
    }
  });
  return {
    server,
    async start() {
      if (started) throw new Error('Preview already started');
      started = true; globalThis.fetch = network;
      try { await new Promise((ready, reject) => { server.once('error', reject); server.listen(port, host, ready); }); }
      catch (error) { globalThis.fetch = originalFetch; started = false; for (const db of databases) db.close(); databases.clear(); throw error; }
      return `http://${host === '::1' ? '[::1]' : host}:${server.address().port}`;
    },
    async close() {
      if (started) { await new Promise((done, reject) => { server.close(error => error ? reject(error) : done()); server.closeAllConnections(); }); }
      if (globalThis.fetch === network) globalThis.fetch = originalFetch;
      for (const db of databases) db.close(); databases.clear(); started = false;
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write('Usage: node tools/cloudflare/qa/preview.mjs [--port 8788]\nLoopback only; synthetic data, in-memory storage and no real mail or Worker network requests.\n');
  } else {
    const port = args.length ? Number(args[1]) : 8788;
    if (args.length && (args.length !== 2 || args[0] !== '--port') || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port followed by a free TCP port');
    const preview = createPreview({ port });
    try {
      const address = await preview.start();
      process.stdout.write(`IsPanel local: ${address}\nVista local · datos ficticios · sin correos reales. Cambiar escenario o reiniciar restablece los ejemplos.\n`);
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await preview.close(); process.exit(0); });
    } catch (error) { process.stderr.write(`Preview not started: ${error.code === 'EADDRINUSE' ? `port ${port} is already in use; no process was stopped` : error.message}\n`); process.exitCode = 1; }
  }
}
