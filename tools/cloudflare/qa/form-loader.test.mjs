// Shared form loading contracts. The DOM, clock, challenge and network are substituted; no external requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = (await readFile(new URL('../../../assets/ds/contact.js', import.meta.url), 'utf8'))
  .replaceAll('export function ', 'function ');
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

function fixture() {
  const scripts = [], timers = new Map(), requests = [], callbacks = new Map();
  const cleared = [];
  let now = 0, nextTimer = 0, nextWidget = 0;
  const window = {};
  const init = runInNewContext(source + '\ninitContactForm', {
    AbortController, window, location: { origin: 'https://example.test', pathname: '/cv/' },
    document: {
      createElement: tag => ({ tag, remove() { this.removed = true; } }),
      head: { appendChild(script) { scripts.push(script); } },
    },
    setTimeout(callback, ms) { const id = ++nextTimer; timers.set(id, { callback, at: now + ms, ms }); return id; },
    clearTimeout(id) { cleared.push(id); timers.delete(id); },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ success: 'true', stored: true, notification: 'accepted' }) };
    },
  });
  function form(id = 'fixture') {
    const listeners = {}, classes = new Set();
    const status = { textContent: '', className: '', classList: { add: value => classes.add(value) } };
    const button = { disabled: false, textContent: '' };
    const fields = [
      { name: 'message', type: 'textarea', value: 'Keep this draft.' },
      { name: 'privacy', type: 'checkbox', checked: true, value: 'accepted' },
    ];
    for (const field of fields) Object.assign(field, {
      closest: () => ({ querySelector: () => null }), getAttribute: () => null, removeAttribute() {},
    });
    const node = {
      id, elements: Object.fromEntries(fields.map(field => [field.name, field])), resets: 0, appendChild() {},
      querySelector: selector => selector === '.f-status' ? status : button,
      querySelectorAll: () => fields,
      addEventListener(type, callback) { listeners[type] = callback; },
      reset() { node.resets++; fields[0].value = ''; fields[1].checked = false; },
    };
    init({ form: node, texts: () => ({ send: 'Send', sending: 'Sending', error: 'Failed', ok: 'Received' }),
      buildEmail: async () => ({ Mensaje: fields[0].value }) });
    return { node, fields, status, button, classes,
      submit: () => listeners.submit({ preventDefault() {} }), warm: () => listeners.focusin(),
    };
  }
  function succeed(index = scripts.length - 1) {
    window.turnstile = {
      render(_box, options) { const id = ++nextWidget; callbacks.set(id, options.callback); return id; },
      reset() {}, execute(id) { callbacks.get(id)(`mock-token-${id}`); },
    };
    scripts[index].onload();
  }
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const entry = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, timer] = entry;
      now = timer.at; timers.delete(id); timer.callback();
    }
    now = end;
  }
  return { scripts, timers, requests, cleared, form, succeed, advance };
}

function assertPreserved(form) {
  assert.equal(form.fields[0].value, 'Keep this draft.');
  assert.equal(form.fields[1].checked, true);
  assert.equal(form.node.resets, 0);
  assert.equal(form.button.disabled, false);
  assert.equal(form.button.textContent, 'Send');
  assert.equal(form.status.textContent, 'Failed');
  assert.equal(form.classes.has('err'), true);
}

test('form script: silent load stops at ten seconds, preserves fields and allows only manual retry', async () => {
  const h = fixture(), f = h.form();
  const pending = f.submit(); await flush();
  const lateLoad = h.scripts[0].onload;
  assert.deepEqual([...h.timers.values()].map(timer => timer.ms), [10_000]);
  h.advance(9_999); await flush();
  assert.equal(f.button.disabled, true);
  assert.equal(h.requests.length, 0);
  h.advance(1); await pending;
  assertPreserved(f);
  assert.equal(h.scripts[0].removed, true);
  assert.equal(h.scripts[0].onload, null);
  assert.equal(h.scripts[0].onerror, null);
  assert.equal(h.timers.size, 0);
  h.advance(60_000); await flush();
  assert.equal(h.requests.length, 0);
  assert.equal(h.scripts.length, 1);
  const retry = f.submit(); await flush();
  assert.equal(h.scripts.length, 2);
  lateLoad(); await flush();
  assert.equal(f.button.disabled, true);
  assert.equal(h.requests.length, 0);
  h.succeed(); await retry;
  assert.equal(h.requests.length, 1);
  assert.equal(JSON.parse(h.requests[0].options.body).Mensaje, 'Keep this draft.');
  assert.equal(f.node.resets, 1);
  assert.equal(f.status.textContent, 'Received');
});

test('form script: load without the API does not poison the next manual attempt', async () => {
  const h = fixture(), f = h.form();
  const pending = f.submit(); await flush();
  h.scripts[0].onload(); await pending;
  assertPreserved(f);
  assert.equal(h.timers.size, 0);
  assert.equal(h.requests.length, 0);
  const retry = f.submit(); await flush();
  assert.equal(h.scripts.length, 2);
  h.succeed(); await retry;
  assert.equal(h.requests.length, 1);
});

test('form script: network failure releases its attempt and stale callbacks cannot clear its replacement', async () => {
  const h = fixture(), f = h.form();
  const pending = f.submit(); await flush();
  const lateError = h.scripts[0].onerror;
  lateError(); await pending;
  assertPreserved(f);
  assert.equal(h.scripts[0].removed, true);
  assert.equal(h.timers.size, 0);
  const retry = f.submit(); await flush();
  lateError(); await flush();
  const other = h.form('other'); other.warm(); await flush();
  assert.equal(h.scripts.length, 2);
  h.succeed(); await retry;
  assert.equal(h.requests.length, 1);
});

test('form script: concurrent forms share one load, cancel its deadline and reuse the successful API', async () => {
  const h = fixture(), first = h.form('first'), second = h.form('second');
  first.warm(); second.warm();
  const submissions = [first.submit(), second.submit()]; await flush();
  assert.equal(h.scripts.length, 1);
  const [[timerId, timer]] = [...h.timers];
  assert.equal(timer.ms, 10_000);
  const lateTimeout = timer.callback;
  h.succeed(); await Promise.all(submissions);
  assert.equal(h.cleared.includes(timerId), true);
  assert.equal(h.timers.has(timerId), false);
  assert.equal(h.requests.length, 2);
  assert.equal(h.scripts[0].removed, undefined);
  lateTimeout();
  const third = h.form('third');
  await third.submit();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.requests.length, 3);
  assert.equal(third.status.textContent, 'Received');
});
