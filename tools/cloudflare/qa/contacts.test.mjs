// Local contracts for the two Workers. Every fetch is replaced: this suite cannot send mail or reach Cloudflare.
// Run with Node 24+: node --test tools/cloudflare/qa/contacts.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import formsWorker from '../isa-forms.js';
import panelWorker, { decodeWorldCountries, reportClock, renderPanelReport } from '../isa-panel.js';

const DAY = 86400000;
const ORIGIN = 'https://ismael-sarmiento.github.io';
const PANEL = 'https://ispanel.example';
const FORMS = 'https://isa-forms.example';
const SECRET = 'local-qa-signing-key-not-a-production-secret';
const schema = (await Promise.all(['0001_contacts.sql', '0002_panel_activity.sql', '0003_panel_reports.sql'].map(name => readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')))).join('\n');

test('shared contact form: stored requests survive email failure and legacy success remains compatible', async () => {
  const source = (await readFile(new URL('../../../assets/ds/contact.js', import.meta.url), 'utf8')).replaceAll('export function ', 'function ');
  for (const notification of ['accepted', 'failed', 'unknown', 'legacy', 'storage_error']) {
    let submit, callback, resets = 0;
    const classes = new Set();
    const status = { textContent: '', className: '', classList: { add: value => classes.add(value) } };
    const button = { disabled: false, textContent: '' };
    const form = {
      elements: {}, appendChild() {}, querySelectorAll: () => [], reset() { resets++; },
      querySelector: selector => selector === '.f-status' ? status : button,
      addEventListener(type, handler) { if (type === 'submit') submit = handler; },
    };
    const payload = notification === 'legacy' ? { success: 'true' }
      : notification === 'storage_error' ? { success: 'false' }
      : { success: 'true', stored: true, notification };
    runInNewContext(source + '\ninitContactForm({form, texts:()=>tx, buildEmail:async()=>({})});', {
      form, tx: { ok: 'received', saved: 'saved, email unconfirmed', error: 'failed', send: 'send' },
      location: { origin: ORIGIN, pathname: '/cv/' }, setTimeout() {},
      document: { createElement: () => ({}), head: { appendChild(script) { script.onload(); } } },
      window: { turnstile: { render(_box, options) { callback = options.callback; return 1; }, reset() {}, execute() { callback('mock-token'); } } },
      fetch: async () => ({ ok: notification !== 'storage_error', status: 503, json: async () => payload }),
    });
    await submit({ preventDefault() {} });
    assert.equal(status.textContent, notification === 'storage_error' ? 'failed' : ['failed', 'unknown'].includes(notification) ? 'saved, email unconfirmed' : 'received');
    assert.equal(resets, notification === 'storage_error' ? 0 : 1);
    assert.equal(classes.has(notification === 'storage_error' ? 'err' : 'ok'), true);
    assert.equal(button.disabled, false);
  }
});

class MemoryKV {
  values = new Map();
  async get(key, type) {
    const entry = this.values.get(key);
    if (!entry || entry.expires && entry.expires <= Date.now()) return null;
    return type === 'json' ? JSON.parse(entry.value) : entry.value;
  }
  async put(key, value, options = {}) {
    this.values.set(key, { value: String(value), expires: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null });
  }
  async delete(key) { this.values.delete(key); }
}

// D1's prepared-statement/result shapes, backed by real SQLite constraints and atomic batches.
class MemoryD1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.sqlite.exec(schema); }
  prepare(sql) {
    const native = this.sqlite.prepare(sql);
    let values = [];
    const result = () => {
      if (/^\s*(?:SELECT|WITH|PRAGMA)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
        return { success: true, results: native.all(...values).map(row => ({ ...row })), meta: { changes: 0 } };
      }
      const out = native.run(...values);
      return { success: true, results: [], meta: { changes: Number(out.changes), last_row_id: Number(out.lastInsertRowid) } };
    };
    const statement = {
      bind(...args) { values = args; return statement; },
      async first(column) { const row = native.get(...values); return row ? column ? row[column] : { ...row } : null; },
      async all() { return result(); },
      async run() { return result(); },
      _execute: result,
    };
    return statement;
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try {
      const results = statements.map(statement => statement._execute());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  async exec(sql) { this.sqlite.exec(sql); return { count: 1, duration: 0 }; }
  rows() { return this.sqlite.prepare('SELECT * FROM contacts ORDER BY created_at DESC, id DESC').all().map(row => ({ ...row })); }
  close() { this.sqlite.close(); }
}

function database(t) { const db = new MemoryD1(); t.after(() => db.close()); return db; }
function env(db, extra = {}) {
  const events = [], views = [];
  return {
    CONTACTS_ENABLED: 'true', TRAFFIC_ENABLED: 'true', CONTACTS_DB: db, PANEL_KV: new MemoryKV(), PANEL_SECRET: SECRET, PANEL_EMAIL: 'owner@example.test',
    ALLOWED_ORIGIN: ORIGIN, ALLOWED_HOSTS: 'ismael-sarmiento.github.io', FORM_TO: 'owner@example.test',
    TURNSTILE_SECRET: 'mock-turnstile', RESEND_API_KEY: 'mock-resend', ACCOUNT_ID: 'mock-account',
    CF_API_TOKEN: 'mock-analytics', SITE_TAG: 'mock-site',
    FORM_EVENTS: { writeDataPoint: point => events.push(point) },
    SITE_VIEWS: { writeDataPoint: point => views.push(point) },
    _events: events, _views: views, ...extra,
  };
}
function submission(overrides = {}) {
  return {
    Nombre: 'Persona de prueba', Email: 'persona@example.test', Empresa: 'Empresa de prueba',
    'Teléfono': '+34 600 123 456', Mensaje: 'Quiero hablar sobre una plataforma de datos.',
    _replyto: 'persona@example.test', _subject: 'Contacto desde CV Online', _page: `${ORIGIN}/cv/`,
    Idioma: 'Español', _honey: '', 'cf-turnstile-response': 'qa-turnstile-token', ...overrides,
  };
}
function formRequest(payload = submission(), extra = {}) {
  const { method = 'POST', origin = ORIGIN, contentType = 'application/json', cf, raw, ...rest } = extra;
  const headers = { Origin: origin, 'Content-Type': contentType, 'CF-Connecting-IP': '192.0.2.10',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) Chrome/120.0.0.0', ...rest.headers };
  const request = new Request(FORMS, { ...rest, method, headers,
    ...(['GET', 'HEAD', 'OPTIONS'].includes(method) ? {} : { body: raw ?? JSON.stringify(payload) }) });
  Object.defineProperty(request, 'cf', { value: cf || { country: 'ES', region: 'Canarias', city: 'Las Palmas',
    latitude: '28.1234', longitude: '-15.4321', timezone: 'Atlantic/Canary', asn: 64500, secretUnknownField: 'discard-me' } });
  return request;
}
function sessionCookie(epoch = '1', expires = Date.now() + DAY, secret = SECRET) {
  const signature = createHmac('sha256', secret).update(`session.${epoch}.${expires}`).digest('base64url');
  return `__Host-isa_panel=${epoch}.${expires}.${signature}`;
}
function hitRequest(payload = { p: '/cv/', r: 'https://example.test/article?private=value', l: 'es-ES' }, options = {}) {
  const request = formRequest(payload, options);
  const hit = new Request(`${FORMS}/hit`, request);
  Object.defineProperty(hit, 'cf', { value: request.cf });
  return hit;
}
function panelRequest(path = '/api/contacts', options = {}) {
  const { auth = true, method = 'GET', body, origin = PANEL, ...rest } = options;
  return new Request(`${PANEL}${path}`, { ...rest, method,
    headers: { ...(auth ? { Cookie: sessionCookie() } : {}), ...(method === 'PATCH' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...rest.headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}
function seed(db, overrides = {}) {
  const id = overrides.id || `c-${randomUUID()}`, now = Date.now();
  const created = overrides.created_at ?? (overrides.expires_at === undefined ? now - 60000 : overrides.expires_at - 90 * DAY);
  const row = {
    id, request_key: createHash('sha256').update(id).digest('hex'), created_at: created,
    expires_at: created + 90 * DAY, site: 'cv', page: `${ORIGIN}/cv/`, language: 'es', name: 'Persona de prueba',
    email: 'persona@example.test', phone: '', company: '', message: 'Consulta de ejemplo', details_json: '{}',
    context_json: '{}', status: 'new', notification_status: 'accepted', provider_id: 'qa-email', updated_at: now - 60000,
    ...overrides,
  };
  const keys = Object.keys(row);
  db.sqlite.prepare(`INSERT INTO contacts (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...Object.values(row));
  return row;
}
const responseJSON = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function aggregateFixture() {
  const day = new Date().toISOString().slice(0, 10), total = [{ count: 20, sum: { visits: 10 } }];
  return { total, daily: [{ count: 20, sum: { visits: 10 }, dimensions: { date: day } }],
    countries: [{ count: 20, sum: { visits: 10 }, dimensions: { countryName: 'ES' } }],
    sources: [{ count: 20, sum: { visits: 10 }, dimensions: { refererHost: 'example.test' } }],
    pages: [{ count: 20, sum: { visits: 10 }, dimensions: { requestPath: '/cv/' } }],
    devices: [], browsers: [], systems: [], site_inicio: total, site_cv: total, site_isacademy: total,
    daily_inicio: [], daily_cv: [], daily_isacademy: [] };
}
function network(t, options = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, ...init });
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      return responseJSON(options.turnstile || { success: true, hostname: 'ismael-sarmiento.github.io' });
    }
    if (url === 'https://api.resend.com/emails') {
      if (options.mailThrows) throw new Error('simulated transport failure');
      return responseJSON(options.mailBody || { id: 'qa-email-1' }, options.mailStatus || 200);
    }
    if (url === 'https://api.cloudflare.com/client/v4/graphql') {
      if (options.visitsFail) throw new Error('simulated analytics failure');
      if (options.previousFail && !/\bdaily:/.test(JSON.parse(init.body).query)) return responseJSON({ errors: [{ message: 'simulated comparison failure' }] });
      return responseJSON({ data: { viewer: { accounts: [options.aggregate || aggregateFixture()] } } });
    }
    if (url.endsWith('/analytics_engine/sql')) {
      const isForms = String(init.body).includes('isa_forms_events');
      const status = isForms ? options.formsStatus : options.citiesStatus;
      if (status) return responseJSON({ error: 'simulated source failure' }, status);
      return responseJSON({ data: isForms ? options.formRows || [{ site: 'cv', outcome: 'accepted', n: 2 }]
        : options.cityRows || [{ country: 'ES', region: 'Canarias', city: 'Las Palmas', lat: 28.1, lon: -15.4, n: 3 }] });
    }
    assert.fail(`Unexpected network request blocked: ${url}`);
  });
  return { calls, emails: () => calls.filter(call => call.url === 'https://api.resend.com/emails'),
    queries: () => calls.filter(call => call.url.endsWith('/analytics_engine/sql')).map(call => String(call.body)) };
}
async function json(response, status = 200) { assert.equal(response.status, status); return response.json(); }

function seedTraffic(db, overrides = {}) {
  const now = Date.now(), created = overrides.created_at ?? (overrides.expires_at === undefined ? now - 60000 : overrides.expires_at - 30 * DAY);
  const row = { id: `visit-${randomUUID()}`, created_at: created, expires_at: created + 30 * DAY, site: 'cv', page: '/cv/', referrer: 'example.test',
    context_json: JSON.stringify({ ip: '192.0.2.10', country: 'ES', region: 'Canarias', city: 'Las Palmas', latitude: 28.1, longitude: -15.4,
      asn: 64500, asOrganization: 'Demo network', device: 'desktop', httpProtocol: 'HTTP/2', browser: 'Chrome', os: 'macOS' }), ...overrides };
  const columns = Object.keys(row);
  db.sqlite.prepare(`INSERT INTO traffic_events (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(row));
  return row;
}
const trafficRows = db => db.sqlite.prepare('SELECT * FROM traffic_events ORDER BY created_at DESC, id DESC').all().map(row => ({ ...row }));
function loginRequest(payload = { token: 'qa-turnstile-token' }, overrides = {}) {
  return panelRequest('/login', { auth: false, method: 'POST', body: payload,
    headers: { Origin: PANEL, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, ...overrides });
}
function linkToken(expires = Date.now() + 15 * 60000, nonce = randomUUID(), secret = SECRET) {
  return `${expires}.${nonce}.${createHmac('sha256', secret).update(`link.${expires}.${nonce}`).digest('base64url')}`;
}
function seedLink(db, token, overrides = {}) {
  const expires = Number(token.split('.')[0]);
  const row = { token_hash: createHash('sha256').update(token).digest('base64url'), created_at: expires - 15 * 60000,
    expires_at: expires, used_at: null, ...overrides };
  db.sqlite.prepare('INSERT INTO panel_link_tokens (token_hash,created_at,expires_at,used_at) VALUES (?,?,?,?)').run(...Object.values(row));
  return row;
}

test('forms: feature flag keeps legacy mail-only submissions working', async t => {
  const net = network(t), e = env(undefined, { CONTACTS_ENABLED: 'false' });
  const body = await json(await formsWorker.fetch(formRequest(), e));
  assert.equal(body.success, 'true'); assert.equal(body.message, 'sent');
  assert.equal(net.emails().length, 1); assert.equal(body.stored, undefined);
});

test('forms: origin, preflight, HEAD and malformed bodies do not reach mail or storage', async t => {
  const db = database(t), e = env(db), net = network(t);
  assert.equal((await formsWorker.fetch(formRequest(undefined, { method: 'OPTIONS' }), e)).status, 204);
  assert.equal((await formsWorker.fetch(formRequest(undefined, { method: 'OPTIONS', origin: 'https://other.example' }), e)).status, 403);
  assert.equal((await formsWorker.fetch(formRequest(undefined, { method: 'HEAD' }), e)).status, 405);
  assert.equal((await formsWorker.fetch(formRequest(undefined, { origin: 'https://other.example' }), e)).status, 403);
  assert.equal((await formsWorker.fetch(formRequest(undefined, { raw: '{' }), e)).status, 400);
  assert.equal((await formsWorker.fetch(formRequest([], {}), e)).status, 400);
  assert.equal((await formsWorker.fetch(formRequest(undefined, { raw: 'x'.repeat(10001) }), e)).status, 413);
  assert.equal(db.rows().length, 0); assert.equal(net.emails().length, 0);
});

test('forms: honeypot and failed Turnstile discard contacts', async t => {
  const db = database(t), e = env(db), net = network(t, { turnstile: { success: false } });
  await json(await formsWorker.fetch(formRequest(submission({ _honey: 'bot' })), e));
  await json(await formsWorker.fetch(formRequest(), e), 403);
  assert.equal(db.rows().length, 0); assert.equal(net.emails().length, 0);
});

test('forms: invalid visible fields, source and reply-to are rejected', async t => {
  const db = database(t), e = env(db), net = network(t);
  for (const patch of [{ Nombre: '' }, { Nombre: 'x'.repeat(81) }, { Email: 'broken', _replyto: 'broken' },
    { Mensaje: '' }, { Mensaje: 'x'.repeat(2001) }, { _replyto: 'someone-else@example.test' }, { _page: 'https://other.example/cv/' }]) {
    const result = await formsWorker.fetch(formRequest(submission(patch)), e);
    assert.equal(result.status, 400, `Rejected invalid fields: ${Object.keys(patch).join(', ')}`);
  }
  assert.equal(db.rows().length, 0); assert.equal(net.emails().length, 0);
});

test('forms: stored contact expires exactly after 90 days and keeps permitted context only', async t => {
  const db = database(t), e = env(db), net = network(t);
  const body = await json(await formsWorker.fetch(formRequest(submission({ Unknown: 'private-unknown-field' })), e));
  assert.equal(body.success, 'true'); assert.equal(body.stored, true); assert.equal(body.message, 'stored');
  assert.equal(body.notification, 'accepted'); assert.equal(body.id, undefined);
  const [row] = db.rows();
  assert.equal(row.expires_at - row.created_at, 90 * DAY);
  assert.equal(row.site, 'cv'); assert.equal(row.status, 'new'); assert.equal(row.notification_status, 'accepted');
  assert.equal(row.email, 'persona@example.test'); assert.equal(row.name, 'Persona de prueba');
  assert.equal(net.emails().length, 1);
  const stored = JSON.stringify(row), events = JSON.stringify(e._events);
  assert.equal(JSON.parse(row.context_json).ip, '192.0.2.10');
  for (const forbidden of ['qa-turnstile-token', 'Macintosh; Intel', 'discard-me', 'private-unknown-field']) assert.ok(!stored.includes(forbidden), `Not persisted: ${forbidden}`);
  for (const pii of [row.email, row.name, row.message, row.phone, row.company]) if (pii) assert.ok(!events.includes(pii), `No personal field in aggregate analytics: ${pii}`);
  assert.ok(!net.emails()[0].body.includes('private-unknown-field'));
});

test('forms: existing IsAcademy open-class payload accepts optional message and preserves its details', async t => {
  const db = database(t), e = env(db); network(t);
  const payload = submission({ _page: `${ORIGIN}/isacademy/`, 'Interés': 'Aula abierta (gratuita)', 'Edad o nivel': 'Adulto', Mensaje: '', Resumen: 'Quiero asistir al aula abierta.' });
  await json(await formsWorker.fetch(formRequest(payload), e));
  const [row] = db.rows();
  assert.equal(row.site, 'isacademy'); assert.match(row.details_json, /Aula abierta/); assert.match(row.details_json, /Adulto/);
});

test('forms: repeated concurrent payload produces one contact and one notification', async t => {
  const db = database(t), e = env(db), net = network(t);
  const replies = await Promise.all(Array.from({ length: 3 }, () => formsWorker.fetch(formRequest(), e)));
  const bodies = await Promise.all(replies.map(response => json(response)));
  assert.equal(db.rows().length, 1); assert.equal(net.emails().length, 1);
  assert.equal(bodies.filter(body => body.duplicate === true).length, 2);
  assert.ok(bodies.every(body => body.stored === true && body.success === 'true'));
});

test('forms: a repeated payload outside the deduplication window can become a new request', async t => {
  const db = database(t), e = env(db), net = network(t);
  await json(await formsWorker.fetch(formRequest(), e));
  const created = Date.now() - 16 * 60000;
  db.sqlite.prepare('UPDATE contacts SET created_at = ?, expires_at = ?').run(created, created + 90 * DAY);
  await json(await formsWorker.fetch(formRequest(), e));
  assert.equal(db.rows().length, 2); assert.equal(net.emails().length, 2);
});

test('forms: enabled storage must exist and fail before attempting email', async t => {
  const net = network(t);
  for (const db of [undefined, { prepare() { throw new Error('storage unavailable'); }, async batch() { throw new Error('storage unavailable'); } }]) {
    const body = await json(await formsWorker.fetch(formRequest(), env(db)), 503);
    assert.equal(body.success, 'false'); assert.equal(body.message, 'storage');
  }
  assert.equal(net.emails().length, 0);
});

test('forms: failed notification keeps the successfully stored request', async t => {
  const db = database(t), e = env(db); network(t, { mailStatus: 503 });
  const body = await json(await formsWorker.fetch(formRequest(), e));
  assert.equal(body.stored, true); assert.equal(body.notification, 'failed');
  const [row] = db.rows(); assert.equal(row.notification_status, 'failed'); assert.equal(row.provider_id, null);
});

test('forms: uncertain transport outcome keeps stored contact without an automatic resend', async t => {
  const db = database(t), e = env(db), net = network(t, { mailThrows: true });
  const body = await json(await formsWorker.fetch(formRequest(), e));
  assert.equal(body.notification, 'unknown'); assert.equal(db.rows()[0].notification_status, 'unknown');
  const duplicate = await json(await formsWorker.fetch(formRequest(), e));
  assert.equal(duplicate.duplicate, true); assert.equal(net.emails().length, 1);
});

test('forms: a successful mail response without provider id is not reported as accepted', async t => {
  const db = database(t); network(t, { mailBody: {} });
  const body = await json(await formsWorker.fetch(formRequest(), env(db)));
  assert.equal(body.notification, 'unknown'); assert.equal(db.rows()[0].notification_status, 'unknown');
});

test('panel: session signature, expiry and revocation protect every contacts endpoint', async t => {
  const db = database(t), row = seed(db), e = env(db); network(t);
  for (const request of [panelRequest('/api/contacts', { auth: false }), panelRequest(`/api/contacts/${row.id}`, { auth: false }),
    panelRequest(`/api/contacts/${row.id}`, { auth: false, method: 'PATCH', body: { status: 'resolved' } }),
    panelRequest('/api/contacts', { headers: { Cookie: sessionCookie('1', Date.now() - 1) } }),
    panelRequest('/api/contacts', { headers: { Cookie: sessionCookie('1', Date.now() + DAY, 'wrong-secret') } })]) {
    await json(await panelWorker.fetch(request, e), 401);
  }
  await e.PANEL_KV.put('session-epoch', '2');
  await json(await panelWorker.fetch(panelRequest(), e), 401);
});

test('panel: missing or unavailable revocation storage fails closed for every contacts operation', async t => {
  const db = database(t), row = seed(db), net = network(t);
  for (const kv of [undefined, { async get() { throw new Error('revocation store unavailable'); } }]) {
    const e = env(db, { PANEL_KV: kv });
    for (const request of [panelRequest('/api/contacts'), panelRequest(`/api/contacts/${row.id}`),
      panelRequest(`/api/contacts/${row.id}`, { method: 'PATCH', body: { status: 'resolved' } })]) {
      const body = await json(await panelWorker.fetch(request, e), 503);
      assert.equal(body.error, 'session_unavailable'); assert.equal(body.items, undefined); assert.equal(body.item, undefined);
    }
  }
  assert.equal(db.rows()[0].status, 'new'); assert.equal(net.calls.length, 0);
});

test('panel: feature disabled and unavailable storage are explicit source states', async t => {
  network(t);
  const disabled = await json(await panelWorker.fetch(panelRequest(), env(undefined, { CONTACTS_ENABLED: 'false' })), 503);
  assert.equal(disabled.error, 'contacts_disabled'); assert.equal(disabled.enabled, false);
  const unavailable = await json(await panelWorker.fetch(panelRequest(), env(undefined)), 503);
  assert.equal(unavailable.error, 'contacts_unavailable');
});

test('panel: list exposes structured detail while keeping request hash private and response uncached', async t => {
  const db = database(t), e = env(db), payload = '<img src=x onerror=alert(1)>';
  const row = seed(db, { name: payload, message: '<script>alert(1)</script>', details_json: JSON.stringify({ 'Interés': 'Datos' }), context_json: JSON.stringify({ country: 'ES' }) });
  const net = network(t), response = await panelWorker.fetch(panelRequest(), e);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Type'), /^application\/json/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  const body = await json(response);
  assert.equal(body.items[0].name, payload); assert.equal(body.items[0].message, row.message);
  assert.deepEqual(body.items[0].details, { 'Interés': 'Datos' }); assert.deepEqual(body.items[0].context, { country: 'ES' });
  assert.equal(body.items[0].request_key, undefined); assert.equal(body.items[0].details_json, undefined);
  assert.equal(body.summary.total, 1); assert.equal(body.retentionDays, 90);
  assert.equal(net.calls.length, 0); assert.equal(e.PANEL_KV.values.size, 0);
});

test('panel: pagination remains stable when contacts share the same timestamp', async t => {
  const db = database(t), e = env(db), timestamp = Date.now() - 10000; network(t);
  for (const id of ['contact-a', 'contact-b', 'contact-c']) seed(db, { id, created_at: timestamp });
  const first = await json(await panelWorker.fetch(panelRequest('/api/contacts?limit=2'), e));
  assert.deepEqual(first.items.map(item => item.id), ['contact-c', 'contact-b']); assert.ok(first.nextCursor);
  const second = await json(await panelWorker.fetch(panelRequest(`/api/contacts?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`), e));
  assert.deepEqual(second.items.map(item => item.id), ['contact-a']); assert.equal(second.nextCursor, null);
  assert.equal(first.summary.total, 3); assert.equal(second.summary.total, 3);
});

test('panel: web, state, period and literal search filters combine with expiry', async t => {
  const db = database(t), e = env(db); network(t);
  const wanted = seed(db, { name: 'Ana 100%_datos', created_at: Date.now() - 10000 });
  seed(db, { name: 'Ana similar', status: 'following' });
  seed(db, { name: 'Ana 100%_datos', site: 'isacademy', page: `${ORIGIN}/isacademy/` });
  seed(db, { name: 'Ana 100%_datos', created_at: Date.now() - 3 * DAY });
  seed(db, { name: 'Ana 100%_datos', expires_at: Date.now() - 1 });
  const query = new URLSearchParams({ site: 'cv', status: 'new', days: '1', q: '100%_datos' });
  const body = await json(await panelWorker.fetch(panelRequest(`/api/contacts?${query}`), e));
  assert.deepEqual(body.items.map(item => item.id), [wanted.id]); assert.equal(body.summary.total, 1);
  const injection = await json(await panelWorker.fetch(panelRequest(`/api/contacts?q=${encodeURIComponent("' OR 1=1 --")}`), e));
  assert.equal(injection.items.length, 0);
});

test('panel: searches longer than D1 LIKE limits still match literal text', async t => {
  const db = database(t), e = env(db); network(t);
  const search = 'consulta '.repeat(12).trim(), wanted = seed(db, { message: `Inicio ${search} final` });
  const body = await json(await panelWorker.fetch(panelRequest(`/api/contacts?q=${encodeURIComponent(search)}`), e));
  assert.deepEqual(body.items.map(item => item.id), [wanted.id]);
});

test('panel: summary counts pending states and notification failures without loading messages', async t => {
  const db = database(t), e = env(db); network(t);
  const oldest = Date.now() - 2 * DAY;
  seed(db, { created_at: oldest });
  seed(db, { status: 'following', site: 'isacademy', notification_status: 'failed' });
  seed(db, { status: 'resolved' }); seed(db, { status: 'archived', site: 'inicio' });
  const body = await json(await panelWorker.fetch(panelRequest('/api/contacts?summary=1'), e));
  assert.deepEqual(body.items, []); assert.equal(body.nextCursor, null);
  assert.deepEqual(body.summary, { total: 4, new: 1, following: 1, resolved: 1, archived: 1,
    oldestPendingAt: oldest, sites: { inicio: 1, cv: 2, isacademy: 1 }, notificationFailed: 1 });
});

test('panel: malformed filters and pagination tokens are rejected', async t => {
  const db = database(t), e = env(db); network(t);
  for (const query of ['site=other', 'status=other', 'days=0', 'days=91', 'days=1.5', 'limit=0', 'limit=51', 'cursor=%25', `q=${'x'.repeat(201)}`]) {
    const body = await json(await panelWorker.fetch(panelRequest(`/api/contacts?${query}`), e), 400);
    assert.equal(body.error, 'invalid_filters', query);
  }
});

test('panel: detail reads preserve message formatting and tolerate non-object optional JSON', async t => {
  const db = database(t), e = env(db), row = seed(db, { message: 'Primera línea\n\nSegunda línea', details_json: '"unexpected string"', context_json: '[]' }); network(t);
  const body = await json(await panelWorker.fetch(panelRequest(`/api/contacts/${row.id}`), e));
  assert.equal(body.item.message, row.message); assert.deepEqual(body.item.details, {}); assert.deepEqual(body.item.context, {});
});

test('panel: status changes require the panel origin and JSON without extra fields', async t => {
  const db = database(t), e = env(db), row = seed(db); network(t);
  const path = `/api/contacts/${row.id}`;
  await json(await panelWorker.fetch(panelRequest(path, { method: 'PATCH', origin: 'https://other.example', body: { status: 'resolved' } }), e), 403);
  await json(await panelWorker.fetch(panelRequest(path, { method: 'PATCH', headers: { Origin: '' }, body: { status: 'resolved' } }), e), 403);
  await json(await panelWorker.fetch(panelRequest(path, { method: 'PATCH', headers: { 'Content-Type': 'text/plain' }, body: { status: 'resolved' } }), e), 415);
  for (const body of [{ status: 'unknown' }, { status: 'resolved', email: 'changed@example.test' }, [], '{']) {
    await json(await panelWorker.fetch(panelRequest(path, { method: 'PATCH', body }), e), 400);
  }
  await json(await panelWorker.fetch(panelRequest(path, { method: 'PATCH', body: 'x'.repeat(1025) }), e), 413);
  assert.equal(db.rows()[0].status, 'new');
  const updated = await json(await panelWorker.fetch(panelRequest(path, { method: 'PATCH', body: { status: 'following' } }), e));
  assert.equal(updated.item.status, 'following'); assert.equal(updated.item.email, row.email); assert.equal(updated.item.notification_status, row.notification_status);
});

test('panel: expired contacts cannot be listed, opened or changed before the scheduled deletion', async t => {
  const db = database(t), e = env(db), row = seed(db, { expires_at: Date.now() - 1000 }); network(t);
  const list = await json(await panelWorker.fetch(panelRequest(), e)); assert.equal(list.items.length, 0); assert.equal(list.summary.total, 0);
  await json(await panelWorker.fetch(panelRequest(`/api/contacts/${row.id}`), e), 404);
  await json(await panelWorker.fetch(panelRequest(`/api/contacts/${row.id}`, { method: 'PATCH', body: { status: 'archived' } }), e), 404);
  assert.equal(db.rows().length, 1);
});

test('panel: unsupported contact operations fail without mutation', async t => {
  const db = database(t), e = env(db), row = seed(db); network(t);
  await json(await panelWorker.fetch(panelRequest(`/api/contacts/${row.id}`, { method: 'DELETE' }), e), 405);
  await json(await panelWorker.fetch(panelRequest('/api/contacts', { method: 'PATCH', body: { status: 'resolved' } }), e), 405);
  assert.equal(db.rows()[0].status, 'new');
});

test('panel: scheduled purge removes expired contacts even when new capture is disabled', async t => {
  const db = database(t), e = env(db, { CONTACTS_ENABLED: 'false' }); network(t);
  seed(db, { expires_at: Date.now() - DAY }); const active = seed(db);
  const work = [], context = { waitUntil: promise => work.push(promise) };
  await panelWorker.scheduled({ scheduledTime: Date.now(), cron: '0 3 * * *' }, e, context);
  await Promise.all(work);
  assert.deepEqual(db.rows().map(row => row.id), [active.id]);
});

test('panel: forms and cities analytics use the selected web, with aggregate-only cache', async t => {
  const db = database(t), e = env(db), net = network(t);
  seed(db, { name: 'Nombre privado único', email: 'private-only@example.test', message: 'Mensaje privado único' });
  const body = await json(await panelWorker.fetch(panelRequest('/api/data?days=7&site=cv&fresh=1'), e));
  assert.ok(net.queries().every(query => /AND blob1 = 'cv'/.test(query)));
  assert.equal(body.forms.rows[0].site, 'cv'); assert.equal(body.sourceHealth.forms.status, 'ok'); assert.equal(body.partial, false);
  assert.ok(Array.isArray(body.sources), 'Referrer ranking retains its existing array contract');
  const cached = JSON.stringify([...e.PANEL_KV.values]);
  for (const pii of ['Nombre privado único', 'private-only@example.test', 'Mensaje privado único']) assert.ok(!cached.includes(pii));
});

test('panel: a failed analytics source keeps successful sources and never becomes a zero', async t => {
  const e = env(undefined); network(t, { visitsFail: true });
  const body = await json(await panelWorker.fetch(panelRequest('/api/data?days=7&site=cv&fresh=1'), e));
  assert.equal(body.partial, true); assert.equal(body.sourceHealth.visits.status, 'error');
  assert.equal(body.total.visits, null); assert.equal(body.total.views, null);
  assert.equal(body.sourceHealth.forms.status, 'ok'); assert.equal(body.forms.rows[0].n, 2);
  assert.equal(body.sourceHealth.cities.status, 'ok');
});

test('panel: failed previous period never turns into a misleading zero comparison', async t => {
  const e = env(undefined); network(t, { previousFail: true });
  const body = await json(await panelWorker.fetch(panelRequest('/api/data?days=7&site=cv&fresh=1'), e));
  assert.equal(body.sourceHealth.visits.status, 'ok'); assert.equal(body.total.visits, 10);
  assert.equal(body.comparison.status, 'error'); assert.equal(body.previous.visits, null); assert.equal(body.previous.views, null);
  assert.equal(body.partial, true); assert.equal(body.sourceHealth.forms.status, 'ok');
});

test('panel: empty analytics and failed analytics remain distinguishable', async t => {
  const e = env(undefined); network(t, { formsStatus: 422, cityRows: [] });
  const body = await json(await panelWorker.fetch(panelRequest('/api/data?days=7&fresh=1'), e));
  assert.equal(body.sourceHealth.forms.status, 'error'); assert.equal(body.sourceHealth.cities.status, 'empty'); assert.equal(body.partial, true);
});

test('panel: recent snapshots are labelled stale and old snapshots are not silently reused', async t => {
  const e = env(undefined), net = network(t);
  const initial = await json(await panelWorker.fetch(panelRequest('/api/data?days=7&site=cv&fresh=1'), e));
  assert.equal(initial.sourceHealth.forms.status, 'ok');
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    if (String(input).endsWith('/analytics_engine/sql')) return responseJSON({ error: 'offline' }, 503);
    return responseJSON({ data: { viewer: { accounts: [aggregateFixture()] } } });
  });
  const stale = await json(await panelWorker.fetch(panelRequest('/api/data?days=7&site=cv&fresh=1'), e));
  assert.equal(stale.sourceHealth.forms.status, 'stale'); assert.equal(stale.forms.rows[0].n, 2); assert.equal(stale.stale, true);
  const key = 'snapshot:data:v2:7:cv', saved = await e.PANEL_KV.get(key, 'json');
  for (const source of Object.values(saved)) source.generated = new Date(Date.now() - 2 * DAY).toISOString();
  await e.PANEL_KV.put(key, JSON.stringify(saved));
  const expired = await json(await panelWorker.fetch(panelRequest('/api/data?days=7&site=cv&fresh=1'), e));
  assert.equal(expired.sourceHealth.forms.status, 'error'); assert.deepEqual(expired.forms.rows, []);
  assert.ok(net.calls.length > 0);
});

test('traffic capture: disabled flag preserves anonymous analytics without D1 details', async t => {
  const db = database(t), e = env(db, { TRAFFIC_ENABLED: 'false' }), net = network(t);
  assert.equal((await formsWorker.fetch(hitRequest(), e)).status, 204);
  assert.equal(trafficRows(db).length, 0); assert.equal(e._views.length, 1); assert.equal(net.calls.length, 0);
  assert.ok(!JSON.stringify(e._views).includes('192.0.2.10'));
  assert.ok(!JSON.stringify(e._views).includes('Macintosh; Intel'));
});

test('traffic capture: exact 30 days, safe page and hostname-only referrer', async t => {
  const db = database(t), e = env(db), net = network(t);
  await formsWorker.fetch(hitRequest({ p: '/cv/?private=discard#fragment', r: 'https://example.test/private/path?q=discard#fragment', l: 'es-ES' }), e);
  const [row] = trafficRows(db); assert.ok(row);
  assert.equal(row.expires_at - row.created_at, 30 * DAY); assert.equal(row.page, '/cv/');
  assert.equal(row.site, 'cv'); assert.equal(row.referrer, 'example.test');
  const context = JSON.parse(row.context_json);
  assert.equal(context.ip, '192.0.2.10'); assert.equal(context.language, 'es-ES');
  assert.ok(!JSON.stringify(row).includes('discard')); assert.ok(!JSON.stringify(row).includes('secretUnknownField'));
  assert.equal(net.calls.length, 0); assert.equal(e.PANEL_KV.values.size, 0);
});

test('traffic capture: trusted edge metadata preserves zero and false, never forwarded spoof values', async t => {
  const db = database(t), e = env(db); network(t);
  const cf = { country: 'ES', region: 'Canarias', regionCode: 'CN', city: 'Las Palmas', continent: 'EU', postalCode: '35001',
    latitude: '0', longitude: '0', timezone: 'Atlantic/Canary', asn: 64500, asOrganization: 'Documentation network',
    colo: 'MAD', httpProtocol: 'HTTP/3', tlsVersion: 'TLSv1.3', tlsCipher: 'AEAD-AES128-GCM-SHA256',
    clientTcpRtt: 0, clientQuicRtt: 0, botManagement: { score: 0, verifiedBot: false }, secretUnknownField: 'private-discard' };
  await formsWorker.fetch(hitRequest(undefined, { cf, headers: { 'CF-Connecting-IP': '2001:db8::123', 'X-Forwarded-For': '203.0.113.88', 'CF-Ray': '0123456789abcdef-MAD' } }), e);
  const context = JSON.parse(trafficRows(db)[0].context_json);
  for (const key of ['latitude', 'longitude', 'clientTcpRtt', 'clientQuicRtt', 'botScore']) assert.equal(context[key], 0, key);
  assert.equal(context.verifiedBot, false); assert.equal(context.ip, '2001:db8::123'); assert.equal(context.asn, 64500);
  assert.equal(context.rayId, '0123456789abcdef-MAD'); assert.equal(context.regionCode, 'CN');
  assert.ok(!JSON.stringify(context).includes('203.0.113.88')); assert.ok(!JSON.stringify(context).includes('private-discard'));
  assert.ok(!JSON.stringify(e._views).includes('2001:db8::123'));
});

test('traffic capture: missing fields do not become invented location or bot classification', async t => {
  const db = database(t), e = env(db); network(t);
  await formsWorker.fetch(hitRequest(undefined, { cf: {}, headers: { 'CF-Connecting-IP': 'invalid-ip', 'CF-Ray': '<script>bad</script>', 'User-Agent': '' } }), e);
  const context = JSON.parse(trafficRows(db)[0].context_json);
  for (const key of ['ip', 'latitude', 'longitude', 'asn', 'botScore', 'verifiedBot', 'rayId']) assert.equal(context[key], undefined, key);
});

test('traffic capture: invalid origins, methods, oversized bodies and unsafe paths create no signals', async t => {
  const db = database(t), e = env(db), net = network(t);
  const requests = [hitRequest(undefined, { origin: 'https://untrusted.example' }), hitRequest(undefined, { method: 'GET' }),
    hitRequest(undefined, { method: 'HEAD' }), hitRequest(undefined, { raw: '{' }), hitRequest([], {}),
    hitRequest(undefined, { raw: JSON.stringify({ p: '/cv/', excess: 'x'.repeat(2000) }) }),
    ...['https://example.test/', '//example.test/', '/\\evil', '/cv/\npath', '/'.repeat(201)].map(p => hitRequest({ p }))];
  for (const request of requests) assert.ok([204, 403, 405].includes((await formsWorker.fetch(request, e)).status));
  assert.equal(trafficRows(db).length, 0); assert.equal(e._views.length, 0); assert.equal(net.calls.length, 0);
});

test('traffic capture: unavailable D1 never breaks the beacon or sends mail', async t => {
  const net = network(t);
  for (const db of [undefined, { prepare() { throw new Error('Unavailable'); } }]) {
    assert.equal((await formsWorker.fetch(hitRequest(), env(db))).status, 204);
  }
  assert.equal(net.calls.length, 0);
});

test('traffic API: every endpoint is private and missing KV or signing key fails closed', async t => {
  const db = database(t), row = seedTraffic(db), net = network(t);
  for (const path of ['/api/traffic/summary', '/api/traffic/events', '/api/traffic/events/' + row.id]) {
    await json(await panelWorker.fetch(panelRequest(path, { auth: false }), env(db)), 401);
    for (const overrides of [{ PANEL_KV: undefined }, { PANEL_KV: { get() { throw new Error('Unavailable'); } } }, { PANEL_SECRET: undefined }]) {
      const body = await json(await panelWorker.fetch(panelRequest(path), env(db, overrides)), 503);
      assert.equal(body.error, 'session_unavailable');
    }
  }
  assert.equal(net.calls.length, 0);
});

test('traffic API: disabled and unavailable storage are distinct from an empty history', async t => {
  network(t);
  for (const path of ['/api/traffic/summary', '/api/traffic/events']) {
    const disabled = await json(await panelWorker.fetch(panelRequest(path), env(undefined, { TRAFFIC_ENABLED: 'false' })), 503);
    assert.equal(disabled.error, 'traffic_disabled'); assert.equal(disabled.enabled, false);
    const unavailable = await json(await panelWorker.fetch(panelRequest(path), env(undefined)), 503);
    assert.equal(unavailable.error, 'traffic_unavailable');
  }
});

test('traffic API: private detail remains literal, uncached and outside telemetry and KV', async t => {
  const db = database(t), e = env(db), row = seedTraffic(db, { context_json: JSON.stringify({ ip: '2001:db8::beef',
    asOrganization: '<img src=x onerror=alert(1)>', verifiedBot: false, botScore: 0 }) });
  const net = network(t), response = await panelWorker.fetch(panelRequest('/api/traffic/events/' + row.id), e);
  assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  const body = await json(response); assert.equal(body.item.context.ip, '2001:db8::beef');
  assert.equal(body.item.context.asOrganization, '<img src=x onerror=alert(1)>');
  assert.equal(body.item.context.verifiedBot, false); assert.equal(body.item.context.botScore, 0);
  assert.equal(body.retentionDays, 30); assert.equal(body.item.context_json, undefined);
  assert.equal(e.PANEL_KV.values.size, 0); assert.equal(e._events.length, 0); assert.equal(e._views.length, 0); assert.equal(net.calls.length, 0);
});

test('traffic API: pagination handles equal timestamps without duplicates', async t => {
  const db = database(t), e = env(db), created_at = Date.now() - 10000; network(t);
  for (const id of ['event-a', 'event-b', 'event-c']) seedTraffic(db, { id, created_at });
  const first = await json(await panelWorker.fetch(panelRequest('/api/traffic/events?limit=2'), e));
  const second = await json(await panelWorker.fetch(panelRequest('/api/traffic/events?limit=2&cursor=' + encodeURIComponent(first.nextCursor)), e));
  assert.deepEqual(first.items.map(item => item.id), ['event-c', 'event-b']);
  assert.deepEqual(second.items.map(item => item.id), ['event-a']); assert.equal(second.nextCursor, null);
});

test('traffic API: country, site, ASN and literal search filters combine safely', async t => {
  const db = database(t), e = env(db); network(t);
  const wanted = seedTraffic(db, { page: '/cv/100%_data', context_json: JSON.stringify({ country: 'ES', asn: 64500, ip: '192.0.2.77', asOrganization: '100%_Data network' }) });
  seedTraffic(db, { site: 'inicio' }); seedTraffic(db, { context_json: JSON.stringify({ country: 'ES', asn: 64501 }) });
  seedTraffic(db, { context_json: JSON.stringify({ country: 'PT', asn: 64500 }) });
  const query = new URLSearchParams({ site: 'cv', country: 'ES', asn: '64500', q: '100%_Data' });
  const body = await json(await panelWorker.fetch(panelRequest('/api/traffic/events?' + query), e));
  assert.deepEqual(body.items.map(item => item.id), [wanted.id]);
  const injection = await json(await panelWorker.fetch(panelRequest('/api/traffic/events?q=' + encodeURIComponent("' OR 1=1 --")), e));
  assert.equal(injection.items.length, 0);
});

test('traffic API: invalid filters, cursors and writes fail without data changes', async t => {
  const db = database(t), e = env(db), row = seedTraffic(db); network(t);
  for (const query of ['site=other', 'country=ESP', 'asn=-1', 'asn=1.5', 'days=0', 'days=31', 'limit=0', 'limit=51', 'cursor=%25', 'q=' + 'x'.repeat(201)]) {
    const body = await json(await panelWorker.fetch(panelRequest('/api/traffic/events?' + query), e), 400);
    assert.equal(body.error, 'invalid_filters', query);
  }
  await json(await panelWorker.fetch(panelRequest('/api/traffic/events/' + row.id, { method: 'DELETE' }), e), 405);
  assert.equal(trafficRows(db).length, 1);
});

test('traffic API: expired events are hidden in list, summary and detail before physical purge', async t => {
  const db = database(t), e = env(db), expired = seedTraffic(db, { expires_at: Date.now() - 1000 }); network(t);
  assert.deepEqual((await json(await panelWorker.fetch(panelRequest('/api/traffic/events'), e))).items, []);
  assert.equal((await json(await panelWorker.fetch(panelRequest('/api/traffic/summary'), e))).summary.events, 0);
  await json(await panelWorker.fetch(panelRequest('/api/traffic/events/' + expired.id), e), 404);
  assert.equal(trafficRows(db).length, 1);
});

test('traffic API: summary preserves null-island locations and missing bot classification', async t => {
  const db = database(t), e = env(db); network(t);
  for (const verifiedBot of [false, true]) seedTraffic(db, { context_json: JSON.stringify({ ip: '192.0.2.1', country: 'ES',
    city: 'Las Palmas', region: 'Canarias', latitude: 0, longitude: 0, verifiedBot, botScore: verifiedBot ? 99 : 0 }) });
  seedTraffic(db, { context_json: '{}' });
  const body = await json(await panelWorker.fetch(panelRequest('/api/traffic/summary'), e));
  assert.equal(body.summary.events, 3); assert.equal(body.summary.networkAddresses, 1); assert.equal(body.summary.withLocation, 2);
  assert.equal(body.summary.knownBots, 1); assert.equal(body.summary.unclassifiedBots, 2); // Cloudflare score 0 means not computed.
  assert.equal(body.places[0].lat, 0); assert.equal(body.places[0].lon, 0); assert.equal(body.places[0].n, 2);
  assert.equal(body.summary.bySite.cv, 3); assert.equal(body.retentionDays, 30); assert.equal(e.PANEL_KV.values.size, 0);
});

test('traffic API: map cap is disclosed without losing overall totals', async t => {
  const db = database(t), e = env(db); network(t);
  for (let index = 0; index < 505; index++) seedTraffic(db, { context_json: JSON.stringify({ country: 'ES', city: 'Synthetic ' + index, latitude: 28 + index / 10000, longitude: -15 }) });
  const body = await json(await panelWorker.fetch(panelRequest('/api/traffic/summary'), e));
  assert.equal(body.summary.events, 505); assert.equal(body.summary.withLocation, 505);
  assert.equal(body.places.length, 500); assert.equal(body.placesMeta.groups, 505);
  assert.equal(body.placesMeta.mappedEvents, 505); assert.equal(body.placesMeta.truncated, true);
});

test('activity schema and cron: exact expiry and flag-independent cleanup cover every table', async t => {
  const db = database(t), e = env(db, { CONTACTS_ENABLED: 'false', TRAFFIC_ENABLED: 'false' }); network(t);
  assert.throws(() => seedTraffic(db, { expires_at: Date.now() + DAY, created_at: Date.now() - 1000 }), /CHECK/);
  seedTraffic(db, { expires_at: Date.now() - 1 }); const active = seedTraffic(db);
  seed(db, { expires_at: Date.now() - 1 }); const activeContact = seed(db);
  seedLink(db, linkToken(Date.now() - 1000)); seedLink(db, linkToken());
  const pending = []; await panelWorker.scheduled({ scheduledTime: Date.now(), cron: '0 3 * * *' }, e, { waitUntil: promise => pending.push(promise) }); await Promise.all(pending);
  assert.deepEqual(trafficRows(db).map(row => row.id), [active.id]); assert.deepEqual(db.rows().map(row => row.id), [activeContact.id]);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM panel_link_tokens').get().n, 1);
});

test('access: link is sent only to configured owner and only its 15-minute hash is persisted', async t => {
  const db = database(t), e = env(db), net = network(t, { turnstile: { success: true, hostname: 'ispanel.example' } });
  const body = await json(await panelWorker.fetch(loginRequest({ token: 'qa-token', email: 'attacker@example.test' }), e)); assert.equal(body.ok, true);
  assert.equal(net.emails().length, 1); const mail = JSON.parse(net.emails()[0].body);
  assert.deepEqual(mail.to, ['owner@example.test']);
  const link = mail.text.match(/https:\/\/ispanel\.example\/auth\?t=([^\s]+)/); assert.ok(link);
  const token = link[1], pieces = token.split('.'); assert.equal(pieces.length, 3);
  assert.match(pieces[1], /^[0-9a-f-]{36}$/);
  assert.equal(pieces[2], createHmac('sha256', SECRET).update('link.' + pieces[0] + '.' + pieces[1]).digest('base64url'));
  const rows = db.sqlite.prepare('SELECT * FROM panel_link_tokens').all(); assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, createHash('sha256').update(token).digest('base64url'));
  assert.equal(rows[0].expires_at - rows[0].created_at, 15 * 60000); assert.equal(rows[0].used_at, null);
  assert.ok(!JSON.stringify(rows).includes(token)); assert.ok(!JSON.stringify([...e.PANEL_KV.values]).includes(token));
});

test('access: simultaneous use of one signed nonce grants exactly one session', async t => {
  const db = database(t), e = env(db), token = linkToken(); seedLink(db, token); network(t);
  const responses = await Promise.all(Array.from({ length: 6 }, () => panelWorker.fetch(panelRequest('/auth?t=' + token, { auth: false }), e)));
  assert.equal(responses.filter(response => response.headers.get('Set-Cookie')?.includes('__Host-isa_panel=')).length, 1);
  const success = responses.find(response => response.headers.get('Set-Cookie'));
  assert.match(success.headers.get('Set-Cookie'), /HttpOnly/); assert.match(success.headers.get('Set-Cookie'), /Secure/); assert.match(success.headers.get('Set-Cookie'), /SameSite=Lax/);
  assert.ok(db.sqlite.prepare('SELECT used_at FROM panel_link_tokens').get().used_at > 0);
});

test('access: altered, missing, old, expired and unpersisted links grant no session', async t => {
  const db = database(t), e = env(db); network(t);
  const expired = linkToken(Date.now() - 1000); seedLink(db, expired); const valid = linkToken(); seedLink(db, valid);
  const future = Date.now() + 15 * 60000, old = future + '.' + createHmac('sha256', SECRET).update('link.' + future).digest('base64url');
  const altered = valid.slice(0, -1) + (valid.endsWith('A') ? 'B' : 'A');
  for (const token of ['', expired, linkToken(), valid + 'extra', altered, old]) {
    const response = await panelWorker.fetch(panelRequest('/auth?t=' + encodeURIComponent(token), { auth: false }), e);
    assert.equal(response.headers.get('Set-Cookie'), null, token);
  }
});

test('access: missing stores or signing key fail closed before issuance or consumption', async t => {
  const db = database(t), token = linkToken(); seedLink(db, token);
  const net = network(t, { turnstile: { success: true, hostname: 'ispanel.example' } });
  for (const overrides of [{ CONTACTS_DB: undefined }, { PANEL_KV: undefined }, { PANEL_SECRET: undefined }, { PANEL_KV: { get() { throw new Error('Unavailable'); } } }]) {
    const e = env(db, overrides);
    assert.equal((await panelWorker.fetch(panelRequest('/auth?t=' + token, { auth: false }), e)).status, 503);
    assert.equal((await panelWorker.fetch(loginRequest(), e)).status, 503);
  }
  assert.equal(net.emails().length, 0); assert.equal(db.sqlite.prepare('SELECT used_at FROM panel_link_tokens').get().used_at, null);
});

test('traffic API: period and long literal searches stay compatible with D1 and filter summary alike', async t => {
  const db = database(t), e = env(db); network(t);
  const fragment = 'demostración_100% '.repeat(10).trim();
  const wanted = seedTraffic(db, { context_json: JSON.stringify({ ip: '192.0.2.99', country: 'ES', city: fragment }) });
  seedTraffic(db, { created_at: Date.now() - 20 * DAY, context_json: JSON.stringify({ ip: '192.0.2.99', country: 'ES', city: fragment }) });
  const params = new URLSearchParams({ days: '7', q: fragment });
  const list = await json(await panelWorker.fetch(panelRequest('/api/traffic/events?' + params), e));
  assert.deepEqual(list.items.map(item => item.id), [wanted.id]);
  assert.equal((await json(await panelWorker.fetch(panelRequest('/api/traffic/summary?' + params), e))).summary.events, 1);
  const ip = await json(await panelWorker.fetch(panelRequest('/api/traffic/events?days=7&q=192.0.2.99'), e)); assert.equal(ip.items.length, 1);
  const numericCursor = Buffer.from(JSON.stringify({ t: Date.now(), id: 123 })).toString('base64url');
  await json(await panelWorker.fetch(panelRequest('/api/traffic/events?cursor=' + numericCursor), e), 400);
});

test('traffic API: capped networks disclose truncation and unexpected stored context is discarded', async t => {
  const db = database(t), e = env(db); network(t);
  const wanted = seedTraffic(db, { context_json: JSON.stringify({ country: 'ES', asn: 64500, ip: '192.0.2.10', unrelatedSecret: 'must-not-escape', tlsVersion: {} }) });
  for (let index = 1; index < 102; index++) seedTraffic(db, { context_json: JSON.stringify({ asn: 64500 + index, asOrganization: 'Synthetic network ' + index }) });
  const summary = await json(await panelWorker.fetch(panelRequest('/api/traffic/summary'), e));
  assert.equal(summary.summary.events, 102); assert.equal(summary.networks.length, 100); assert.equal(summary.networksMeta.truncated, true);
  const detail = await json(await panelWorker.fetch(panelRequest('/api/traffic/events/' + wanted.id), e));
  assert.equal(detail.item.context.unrelatedSecret, undefined); assert.equal(detail.item.context.tlsVersion, undefined);
});

test('access: wrong origin, failed challenge, malformed input and missing recipient issue no link', async t => {
  const db = database(t), e = env(db), net = network(t);
  await json(await panelWorker.fetch(loginRequest(undefined, { headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' } }), e), 403);
  await json(await panelWorker.fetch(loginRequest(), e), 403);
  for (const body of [{}, [], '{', { token: '' }, { token: 'x'.repeat(2049) }]) await json(await panelWorker.fetch(loginRequest(body), e), 400);
  await json(await panelWorker.fetch(loginRequest(), env(db, { PANEL_EMAIL: undefined })), 503);
  assert.equal(net.emails().length, 0); assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM panel_link_tokens').get().n, 0);
});

const viewsSource = (await readFile(new URL('../../../assets/ds/views.js', import.meta.url), 'utf8')).replace('export function countView', 'function countView');
function clientSignals(options = {}) {
  const signals = [], navigator = { language: 'es-ES', sendBeacon: (url, payload) => signals.push({ url, payload: JSON.parse(payload) }), ...options.navigator };
  const context = { URL, navigator, location: { hostname: 'ismael-sarmiento.github.io', pathname: '/cv/', ...options.location },
    document: { referrer: 'https://example.test/private/path?q=secret#fragment', ...options.document } };
  for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(context, key, { get() { throw new Error('Client telemetry must not need storage'); } });
  runInNewContext(viewsSource + '\ncountView();countView();', context); return signals;
}
test('shared views: a single signal contains only path, referring origin and language', () => {
  const signals = clientSignals(); assert.equal(signals.length, 1);
  assert.deepEqual(signals[0].payload, { p: '/cv/', r: 'https://example.test', l: 'es-ES' });
  assert.match(signals[0].url, /^https:\/\/isa-forms\..*\/hit$/);
  assert.ok(!JSON.stringify(signals).includes('secret')); assert.ok(!JSON.stringify(signals).includes('/private/'));
});

test('shared views: privacy preferences, automation and non-published hosts suppress capture', () => {
  for (const options of [{ navigator: { doNotTrack: '1' } }, { navigator: { globalPrivacyControl: true } },
    { navigator: { webdriver: true } }, { location: { hostname: '127.0.0.1' } }, { location: { hostname: 'example.test' } }]) assert.equal(clientSignals(options).length, 0);
});

test('shared views: absent or malformed optional metadata stays empty and unsupported beacon is harmless', () => {
  for (const referrer of ['', 'not a URL', 'javascript:alert(1)']) {
    const [signal] = clientSignals({ navigator: { language: 'invalid_locale'.repeat(10) }, document: { referrer } });
    assert.equal(signal.payload.r, ''); assert.equal(signal.payload.l, '');
  }
  assert.deepEqual(clientSignals({ navigator: { sendBeacon: undefined } }), []);
});

test('map: USA mainland, Alaska and Hawaii stay in the western hemisphere; antimeridian is clipped per ring', async () => {
  const topo=JSON.parse(await readFile(new URL('../../../assets/maps/countries-50m.json',import.meta.url),'utf8'));
  const countries=decodeWorldCountries(topo),us=countries.find(c=>c.id==='840');
  const inside=(point,ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  for(const point of [[-100,40],[-150,65],[-155.5,19.6]])assert.ok(us.rings.some(r=>inside(point,r)),`USA includes ${point}`);
  assert.equal(us.rings.length,127);
  for(const code of ['840','643','242']){
    const rings=countries.find(c=>c.id===code).rings;
    assert.ok(rings.some(r=>r.some(p=>p[0]< -170)),code+' west of antimeridian');
    assert.ok(rings.some(r=>r.some(p=>p[0]>170)),code+' east of antimeridian');
    for(const ring of rings)for(let i=0;i<ring.length;i++){assert.ok(ring[i][0]>=-180-1e-8&&ring[i][0]<=180+1e-8);assert.ok(Math.abs(ring[i][0]-ring[(i+1)%ring.length][0])<=180);}
  }
});

test('reports: Canarias Monday at 09 remains stable across daylight saving changes', () => {
  for(const when of ['2026-01-12T09:00:00Z','2026-07-13T08:00:00Z','2026-10-26T09:00:00Z'])assert.equal(reportClock(Date.parse(when)).due,true,when);
  for(const when of ['2026-01-12T08:00:00Z','2026-07-13T09:00:00Z','2026-07-14T08:00:00Z','2026-07-13T08:01:00Z'])assert.equal(reportClock(Date.parse(when)).due,false,when);
});
test('aggregate map: missing coordinates are absent while valid zero coordinates survive',async t=>{
  const db=database(t),e=env(db);network(t,{cityRows:[{country:'ES',city:'No coordinates',lat:null,lon:null,n:2},{country:'GH',city:'Zero coordinates',lat:'0',lon:'0',n:1}]});
  const result=await json(await panelWorker.fetch(panelRequest('/api/data?days=7&site=all'),e));
  assert.equal(result.cities.rows[0].lat,null);assert.equal(result.cities.rows[0].lon,null);
  assert.equal(result.cities.rows[1].lat,0);assert.equal(result.cities.rows[1].lon,0);
});
const requestReport=(id=randomUUID(),extra={})=>panelRequest('/api/reports/send',{method:'POST',headers:{Origin:PANEL,'Content-Type':'application/json'},body:{requestId:id},...extra});
const reportRows=db=>db.sqlite.prepare('SELECT * FROM panel_reports').all();

test('reports: every read and send requires a session and revocation store', async t=>{
  const db=database(t),e=env(db,{REPORTS_ENABLED:'true'}),net=network(t);
  for(const path of ['/api/reports/status','/api/reports/preview','/api/reports/send']){
    assert.equal((await panelWorker.fetch(panelRequest(path,{auth:false}),e)).status,401);
    assert.equal((await panelWorker.fetch(panelRequest(path),{...e,PANEL_KV:undefined})).status,503);
    assert.equal((await panelWorker.fetch(panelRequest(path),{...e,PANEL_SECRET:undefined})).status,503);
  }assert.equal(net.emails().length,0);
});
test('reports: preview and status never send; disabled flag still permits a private preview',async t=>{
  const db=database(t),e=env(db),net=network(t);seed(db);seedTraffic(db);
  const status=await json(await panelWorker.fetch(panelRequest('/api/reports/status'),e));assert.equal(status.enabled,false);assert.equal(status.latest,null);
  const response=await panelWorker.fetch(panelRequest('/api/reports/preview'),e),html=await response.text();
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.match(html,/Conversaciones que merecen atención/);assert.match(html,/Últimos 7 días/);assert.match(html,/\/#contacts/);assert.ok(!html.includes('persona@example.test'));assert.ok(!html.includes('192.0.2.10'));
  assert.equal((await panelWorker.fetch(requestReport(),e)).status,503);assert.equal(net.emails().length,0);assert.equal(reportRows(db).length,0);
});
test('reports: same manual request concurrently sends once, to configured owner only',async t=>{
  const db=database(t),e=env(db,{REPORTS_ENABLED:'true'}),net=network(t),id=randomUUID();seed(db);seedTraffic(db);
  const results=await Promise.all(Array.from({length:6},()=>panelWorker.fetch(requestReport(id),e)));
  results.forEach(r=>assert.equal(r.status,200));assert.equal(net.emails().length,1);
  const payload=JSON.parse(net.emails()[0].body);assert.deepEqual(payload.to,['owner@example.test']);assert.ok(payload.html&&payload.text);assert.match(payload.html,/Pendientes en la bandeja activa/);assert.ok(!payload.html.includes('persona@example.test'));assert.ok(!payload.html.includes('192.0.2.10'));
  const row=reportRows(db)[0];assert.equal(row.status,'accepted');assert.equal(row.expires_at-row.created_at,30*DAY);assert.ok(row.payload_hash);assert.ok(!Object.keys(row).some(k=>/html|message|email|context/.test(k)));
  const second=await json(await panelWorker.fetch(requestReport(),e),429);assert.equal(second.error,'wait');assert.equal(net.emails().length,1);
  assert.ok(!JSON.stringify([...e.PANEL_KV.values.values()]).includes('persona@example.test'));
});
test('reports: invalid origin, body, method and missing recipient cannot send',async t=>{
  const db=database(t),e=env(db,{REPORTS_ENABLED:'true'}),net=network(t);
  assert.equal((await panelWorker.fetch(requestReport(randomUUID(),{headers:{Origin:'https://other.example','Content-Type':'application/json'}}),e)).status,403);
  assert.equal((await panelWorker.fetch(requestReport(randomUUID(),{headers:{Origin:PANEL,'Content-Type':'text/plain'}}),e)).status,415);
  assert.equal((await panelWorker.fetch(requestReport(randomUUID(),{body:{requestId:randomUUID(),to:'other@example.test'}}),e)).status,400);
  assert.equal((await panelWorker.fetch(requestReport(randomUUID(),{body:{requestId:'bad'}}),e)).status,400);
  assert.equal((await panelWorker.fetch(requestReport(randomUUID(),{body:' '.repeat(1025)}),e)).status,413);
  assert.equal((await panelWorker.fetch(panelRequest('/api/reports/send'),e)).status,405);
  assert.equal((await panelWorker.fetch(requestReport(),{...e,PANEL_EMAIL:undefined})).status,503);
  assert.equal(net.emails().length,0);
});
test('reports: rejected mail is failed; server uncertainty is never labelled accepted',async t=>{
  for(const [options,expected] of [[{mailStatus:422},'failed'],[{mailStatus:500},'unknown'],[{mailThrows:true},'unknown'],[{mailBody:{}},'unknown']]){
    await t.test(expected+' '+JSON.stringify(options),async t=>{const db=database(t),e=env(db,{REPORTS_ENABLED:'true'}),net=network(t,options),id=randomUUID();
      const result=await json(await panelWorker.fetch(requestReport(id),e));assert.equal(result.item.status,expected);
      await panelWorker.fetch(requestReport(id),e);assert.equal(net.emails().length,1);
    });
  }
});
test('reports: weekly schedule deduplicates both invocations and preserves daily purge when disabled',async t=>{
  const db=database(t),e=env(db,{REPORTS_ENABLED:'true'}),net=network(t),scheduled=Date.parse('2026-10-26T09:00:00Z');
  t.mock.method(Date,'now',()=>scheduled+120000);
  await Promise.all(Array.from({length:4},()=>panelWorker.scheduled({scheduledTime:scheduled},e)));
  assert.equal(net.emails().length,1);assert.equal(reportRows(db)[0].kind,'weekly');
  await panelWorker.scheduled({scheduledTime:Date.parse('2026-10-26T08:00:00Z')},e);assert.equal(net.emails().length,1);
  await panelWorker.scheduled({scheduledTime:Date.parse('2026-10-19T08:00:00Z')},e);assert.equal(net.emails().length,1);
  db.sqlite.prepare('UPDATE panel_reports SET created_at=?,expires_at=?').run(Date.now()-31*DAY,Date.now()-DAY);
  await panelWorker.scheduled({}, {...e,REPORTS_ENABLED:'false'});assert.equal(reportRows(db).length,0);
});
test('reports: abandoned attempts are unconfirmed and expired metadata is not exposed before purge',async t=>{
  const db=database(t),e=env(db,{REPORTS_ENABLED:'true'}),net=network(t),id=randomUUID();
  await panelWorker.fetch(requestReport(id),e);
  db.sqlite.prepare("UPDATE panel_reports SET status='sending',updated_at=?").run(Date.now()-180000);
  const state=await json(await panelWorker.fetch(panelRequest('/api/reports/status'),e));assert.equal(state.latest.status,'unknown');
  db.sqlite.prepare('UPDATE panel_reports SET created_at=?,expires_at=?').run(Date.now()-31*DAY,Date.now()-DAY);
  assert.equal((await json(await panelWorker.fetch(panelRequest('/api/reports/status'),e))).latest,null);
  assert.equal((await panelWorker.fetch(requestReport(id),e)).status,429);assert.equal(net.emails().length,1);
});
test('reports: source failures remain labelled and external strings are escaped in email HTML',async t=>{
  const db=database(t),e=env(db),net=network(t,{visitsFail:true,formsStatus:500,citiesStatus:500});
  const response=await panelWorker.fetch(panelRequest('/api/reports/preview'),e),body=await response.text();assert.match(body,/Fuente no disponible|no disponible/);assert.ok(!body.includes('persona@example.test'));assert.equal(net.emails().length,0);
  const now=Date.now(),d={generated:now,period:{since:now-7*DAY,until:now},contacts:{status:'disabled'},traffic:{status:'disabled'},aggregate:{range:{since:'2026-10-12',until:'2026-10-19'},total:{visits:1,views:2},sites:{},sources:[{key:'<script>alert(1)</script>',visits:1}],pages:[],devices:[],sourceHealth:{visits:{status:'ok'}}}};
  const rendered=renderPanelReport(d);assert.ok(!rendered.html.includes('<script>'));assert.match(rendered.html,/&lt;script&gt;/);assert.match(rendered.text,/<script>/);
});
