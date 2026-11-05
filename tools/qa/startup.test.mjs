import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../../assets/ds/startup.js', import.meta.url), 'utf8');
function fixture({ body = true, focused = false, theme = null } = {}) {
  const classes = new Set(['i18n-wait', 'sig-handoff']);
  const bodyClasses = new Set(['intro-open', 'entering']);
  const timers = new Map(), listeners = new Map();
  let timerId = 0, removed = 0, focusCount = 0;
  const list = set => ({ add: (...v) => v.forEach(x => set.add(x)), remove: (...v) => v.forEach(x => set.delete(x)) });
  const intro = { hidden: false, contains: () => focused };
  const title = { setAttribute() {}, focus(options) { assert.equal(options.preventScroll, true); focusCount++; } };
  const document = {
    documentElement: { classList: list(classes), dataset: {} },
    body: body ? { classList: list(bodyClasses) } : null,
    activeElement: {},
    getElementById: () => body ? intro : null,
    querySelector: () => title,
    querySelectorAll: () => body ? [{ remove() { removed++; } }] : [],
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name),
  };
  const context = {
    document, Set, Object, localStorage: { getItem: () => theme },
    setTimeout(fn, ms) { assert.equal(ms, 10000); timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  runInNewContext(source, context);
  return { context, api: context.isaStartup, classes, bodyClasses, intro, timers, listeners,
    expire() { [...timers.values()].forEach(fn => fn()); },
    focusCount: () => focusCount, removed: () => removed };
}

test('head guard enables enhancement synchronously and exposes a frozen API', () => {
  const f = fixture();
  assert.ok(f.classes.has('js')); assert.ok(Object.isFrozen(f.api)); assert.equal(f.timers.size, 1);
});
test('saved theme is restored before startup and survives recovery; invalid choices are ignored', () => {
  for (const theme of ['light', 'dark', 'invalid', null]) {
    const f = fixture({ theme }); f.expire();
    assert.equal(f.context.document.documentElement.dataset.theme, ['light', 'dark'].includes(theme) ? theme : undefined);
  }
});
test('ready cancels the deadline and entry listener without changing the normal page', () => {
  const f = fixture(); assert.equal(f.api.ready(), true); f.expire();
  assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
  assert.ok(f.classes.has('js')); assert.equal(f.intro.hidden, false);
});
test('deadline exposes static content, drops blockers and removes temporary signature copies', () => {
  const f = fixture(); f.expire();
  assert.equal(f.api.isFailed(), true); assert.equal(f.classes.size, 0);
  assert.equal(f.bodyClasses.size, 0); assert.equal(f.intro.hidden, true); assert.equal(f.removed(), 1);
});
test('entry failure recovers immediately; unrelated image/optional script errors do not', () => {
  const f = fixture();
  f.listeners.get('error')({ target: { matches: () => false } });
  assert.equal(f.api.isFailed(), false);
  f.listeners.get('error')({ target: { matches: selector => selector === 'script[data-startup-entry]' } });
  assert.equal(f.api.isFailed(), true);
});
test('recovery is final and idempotent, including after an earlier ready', () => {
  const f = fixture(); let calls = 0; f.api.onFailure(() => calls++);
  f.api.ready(); f.api.fail(); f.api.fail(); assert.equal(f.api.ready(), false);
  assert.equal(calls, 1); assert.equal(f.removed(), 1); assert.equal(f.classes.has('js'), false);
});
test('one faulty cleanup does not prevent releasing the remaining isolation', () => {
  const f = fixture(); let released = false;
  f.api.onFailure(() => { throw new Error('fixture'); }); f.api.onFailure(() => { released = true; });
  f.api.fail(); assert.equal(released, true); assert.equal(f.intro.hidden, true);
});
test('completed intros can unregister their cleanup; late registration is cleaned immediately', () => {
  const f = fixture(); let calls = 0; const off = f.api.onFailure(() => calls++);
  off(); f.api.fail(); assert.equal(calls, 0);
  f.api.onFailure(() => calls++); assert.equal(calls, 1);
});
test('only focus held by the hidden intro is handed to the page title', () => {
  for (const focused of [true, false]) { const f = fixture({ focused }); f.api.fail(); assert.equal(f.focusCount(), focused ? 1 : 0); }
});
test('a deadline before body parsing remains safe and final', () => {
  const f = fixture({ body: false }); f.expire(); assert.equal(f.api.isFailed(), true); assert.equal(f.api.ready(), false);
});
test('an accidentally duplicated embedded guard does not replace the original state or deadline', () => {
  const f = fixture(); runInNewContext(source, f.context); assert.equal(f.context.isaStartup, f.api); assert.equal(f.timers.size, 1);
});
