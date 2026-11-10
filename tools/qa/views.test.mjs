// The anonymous page signal for IsPanel (assets/ds/views.js): which pages send it, and what it carries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = (await readFile(new URL('../../assets/ds/views.js', import.meta.url), 'utf8')).replace('export function', 'function');

function visit({ host = 'isuniverse.dev', path = '/', referrer = '', dnt = null, gpc = false, webdriver = false, calls = 1 } = {}) {
  const sent = [];
  const navigator = {
    webdriver, doNotTrack: dnt, globalPrivacyControl: gpc, language: 'es-ES',
    sendBeacon: (url, body) => { sent.push({ url, body: JSON.parse(body) }); return true; },
  };
  const context = { location: { hostname: host, pathname: path }, navigator, document: { referrer }, URL, JSON };
  runInNewContext(`${source}\nfor (let i = 0; i < ${calls}; i++) countView();`, context);
  return sent;
}

test('IsGame (/game/) is counted like every other site (F11)', () => {
  const [hit, ...rest] = visit({ path: '/game/', referrer: 'https://isuniverse.dev/academy/' });
  assert.equal(rest.length, 0);
  assert.match(hit.url, /^https:\/\/isa-forms\.[a-z0-9-]+\.workers\.dev\/hit$/);
  assert.deepEqual(hit.body, { p: '/game/', r: 'https://isuniverse.dev', l: 'es-ES' });
});

test('the old /isgame/ only redirects, so it is never counted (no double visit)', () => {
  assert.equal(visit({ path: '/isgame/' }).length, 0);
  assert.equal(visit({ path: '/isgame' }).length, 0);
  assert.equal(visit({ path: '/isgames/' }).length, 1, 'only the exact old folder is skipped');
});

test('one signal per document, and only on the published site', () => {
  assert.equal(visit({ path: '/profile/', calls: 3 }).length, 1);
  for (const host of ['localhost', '127.0.0.1', 'ismael-sarmiento.github.io']) assert.equal(visit({ host }).length, 0, host);
});

test('Do Not Track, Global Privacy Control and automated browsers send nothing', () => {
  assert.equal(visit({ dnt: '1' }).length, 0);
  assert.equal(visit({ gpc: true }).length, 0);
  assert.equal(visit({ webdriver: true }).length, 0);
});
