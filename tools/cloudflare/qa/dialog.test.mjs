import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = (await readFile(new URL('../../../assets/ds/ds.js', import.meta.url), 'utf8'))
  .replace(/^import .*;$/gm, '').replaceAll('export ', '');
function fixture() {
  const doc = { body: { children: [] }, activeElement: null };
  const element = (attributes = {}) => {
    const attrs = new Map(Object.entries(attributes)), events = new Map();
    return { tagName: 'DIV', inert: false, disabled: false, tabIndex: 0, visible: true, hiddenControl: false,
      getAttribute: key => attrs.get(key) ?? null, setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key),
      addEventListener: (key, fn) => events.set(key, fn), removeEventListener: (key, fn) => { if (events.get(key) === fn) events.delete(key); },
      contains: () => false, closest: () => null, getClientRects() { return this.visible ? [{}] : []; },
      focus() { doc.activeElement = this; }, events,
    };
  };
  const dialog = element({ role: 'region' }), first = element(), last = element(), hidden = element();
  hidden.hiddenControl = true;
  dialog.querySelectorAll = () => [first, hidden, last];
  const page = element(), preexisting = element(); preexisting.inert = true;
  doc.body.children = [page, dialog, preexisting];
  const api = runInNewContext(source + '\n({isolateDialog,releaseDialog})', {
    document: doc, matchMedia: () => ({ matches: false }), getComputedStyle: el => ({ visibility: el.hiddenControl ? 'hidden' : 'visible' }),
  });
  const tab = shiftKey => {
    let prevented = false;
    dialog.events.get('keydown')({ key: 'Tab', shiftKey, preventDefault() { prevented = true; } });
    return prevented;
  };
  return { ...api, doc, dialog, first, last, page, preexisting, tab };
}

test('intro keyboard cycles both directions and excludes invisible controls', () => {
  const h = fixture(); h.isolateDialog(h.dialog);
  h.last.focus(); assert.equal(h.tab(false), true); assert.equal(h.doc.activeElement, h.first);
  assert.equal(h.tab(true), true); assert.equal(h.doc.activeElement, h.last);
  h.first.focus(); assert.equal(h.tab(false), false);
});
test('intro isolation releases only its own inert state and restores original semantics', () => {
  const h = fixture(); h.isolateDialog(h.dialog);
  assert.equal(h.page.inert, true); assert.equal(h.dialog.getAttribute('aria-modal'), 'true');
  h.releaseDialog(h.dialog); h.releaseDialog(h.dialog);
  assert.equal(h.page.inert, false); assert.equal(h.preexisting.inert, true);
  assert.equal(h.dialog.getAttribute('role'), 'region'); assert.equal(h.dialog.getAttribute('aria-modal'), null);
  assert.equal(h.dialog.events.size, 0);
});
test('intro isolation can be renewed without leaving duplicate listeners or locking the page', () => {
  const h = fixture(); h.isolateDialog(h.dialog); h.isolateDialog(h.dialog);
  assert.equal(h.dialog.events.size, 1); h.releaseDialog(h.dialog); assert.equal(h.page.inert, false);
});
test('an intro with no available controls keeps keyboard focus on its own root', () => {
  const h = fixture(); h.dialog.querySelectorAll = () => [];
  h.isolateDialog(h.dialog); assert.equal(h.tab(false), true); assert.equal(h.doc.activeElement, h.dialog);
});
