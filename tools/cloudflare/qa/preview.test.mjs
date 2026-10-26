// Exercise the local adapter over loopback; never contact the production Workers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreview } from './preview.mjs';

const localFetch = globalThis.fetch;
test('public preview routes the universe without exposing panel endpoints or private files', async t => {
  const preview = createPreview({ port: 0, publicOnly: true });
  const origin = await preview.start();
  try {
    for (const [path, text] of [['/', 'Ismael'], ['/cv/', 'Arquitectura y liderazgo técnico'], ['/isacademy/', 'IsAcademy'], ['/privacy/', 'Privacidad']]) {
      await t.test(path, async () => {
        const response = await localFetch(origin + path);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /text\/html/);
        assert.ok((await response.text()).includes(text));
        assert.equal(response.headers.get('cache-control'), 'no-store');
      });
    }
    await t.test('shared assets and HEAD', async () => {
      const response = await localFetch(origin + '/assets/ds/ds.js', { method: 'HEAD' });
      assert.equal(response.status, 200);
      assert.equal(await response.text(), '');
    });
    await t.test('private files and panel APIs stay unavailable', async () => {
      for (const path of ['/api/contacts', '/api/traffic', '/login', '/cv/.private/PROJECT_CONTEXT.md', '/isacademy/AGENTS.md', '/assets/%2e%2e%2ftools/build.py']) {
        assert.equal((await localFetch(origin + path)).status, 404, path);
      }
    });
    await t.test('public POST cannot send or store anything', async () => {
      for (const path of ['/', '/cv/', '/api/reports/send', '/__preview/forms']) {
        assert.equal((await localFetch(origin + path, { method: 'POST', body: '{}' })).status, 405, path);
      }
    });
  } finally { await preview.close(); }
});

test('default preview retains the synthetic panel', async () => {
  const preview = createPreview({ port: 0 });
  const origin = await preview.start();
  try {
    const response = await localFetch(origin);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /IsPanel/);
  } finally { await preview.close(); }
});
