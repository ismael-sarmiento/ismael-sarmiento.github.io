// Run the actual entry points with controlled module resolution: failed/late Alan must not gate core startup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const files = {
  home: new URL('../../assets/hub.js', import.meta.url),
  cv: new URL('../../../cv/js/app.js', import.meta.url),
  academy: new URL('../../../isacademy/js/app.js', import.meta.url),
};
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function fixture(site, { failed = false, lang = 'en', delayLanguage = false, missingGuard = false } = {}) {
  const calls = [], warnings = [], options = [];
  let resolveModule, rejectModule, resolveLanguage;
  const dependency = new Promise((resolve, reject) => { resolveModule = resolve; rejectModule = reject; });
  const language = delayLanguage ? new Promise(resolve => { resolveLanguage = resolve; }) : Promise.resolve();
  const data = { es: { assistant: { name: 'Español' }, faq: [], steps: [] }, en: { assistant: { name: 'English' }, faq: [], steps: [] } };
  const intro = { hidden: false };
  const i18n = { start: () => language, lang: () => lang, onChange() {} };
  const startup = { isFailed: () => failed, ready() { calls.push('ready'); }, fail() { failed = true; calls.push('fail'); } };
  const document = {
    body: { classList: { contains: () => false } }, documentElement: { classList: { add() {}, remove() { calls.push('static-fallback'); } }, dataset: {} },
    getElementById: id => id === 'intro' ? intro : { textContent: JSON.stringify(data) },
    querySelectorAll: () => [], addEventListener() {}, querySelector: () => null,
  };
  const context = {
    document, URL, URLSearchParams, Date, console: { warn: text => warnings.push(text) },
    isaStartup: missingGuard ? undefined : startup, createI18n: () => i18n,
    location: { search: '', hash: '', pathname: '/', origin: 'https://example.test' },
    loadModule: () => { calls.push('import'); return dependency; },
    MutationObserver: class { observe() {} },
    initDesignSystem: () => calls.push('core'), initIntro: () => calls.push('intro'),
    initView() {}, initNav: () => calls.push('nav'), initPdfLinks() {}, initContact() {}, initTimeline() {},
    escapeForeignFrame: () => false, initTheme() {}, countView() {},
    setLang: () => language, detectLang: () => lang, currentLang: () => lang, onLangChange() {},
    renderSections() {}, renderForm() {}, observeReveals() {}, exportPrerenderIfAsked() {},
    initForm: () => calls.push('form'), initConsole() {}, runIntro: async () => calls.push('intro'),
    initFabTuck: () => calls.push('tuck'), openAcademy() {}, startLessons() {}, toggleTheme() {}, nextFact() {},
    openConsole() {}, runCode() {}, debugCode() {}, stopCode() {}, resetConsole() {}, renderSamples() {}, refreshLessons() {},
    $: () => intro, $$: () => [], scrollBehavior() {}, setInterest() {},
  };
  const source = (await readFile(files[site], 'utf8')).replace(/^import [^\n]*\n/gm, '')
    .replaceAll('import.meta.url', JSON.stringify('https://example.test/app.js?v=test')).replace(/\bimport\(/g, 'loadModule(');
  runInNewContext(source, context);
  await flush();
  const module = {
    createAssistant: config => { options.push(config); return { tuck() {}, refresh() {} }; }, faqMatcher: () => () => {},
    initAssistant: () => calls.push('assistant'), refreshAssistant() {},
  };
  return { calls, warnings, options, startup, intro, reject: () => rejectModule(new Error('intentionally unavailable')),
    resolve: () => resolveModule(module), resolveLanguage: () => resolveLanguage?.(), flush };
}

for (const site of Object.keys(files)) {
  test(`${site}: core and intro become ready without waiting for Alan; failed Alan stays optional`, async () => {
    const f = await fixture(site);
    assert.ok(f.calls.includes('ready')); assert.ok(f.calls.includes('intro')); assert.ok(f.calls.includes('import'));
    f.reject(); await f.flush(); assert.equal(f.startup.isFailed(), false); assert.equal(f.warnings.length, 1);
  });
  test(`${site}: Alan arriving after recovery cannot create a new widget`, async () => {
    const f = await fixture(site); f.startup.fail(); f.resolve(); await f.flush();
    assert.equal(f.calls.includes('assistant'), false); assert.equal(f.options.length, 0);
  });
  test(`${site}: an entry arriving after the deadline does not initialise the page`, async () => {
    const f = await fixture(site, { failed: true }); assert.deepEqual(f.calls, []);
  });
  test(`${site}: an absent inline guard leaves static content rather than an unwired overlay`, async () => {
    const f = await fixture(site, { missingGuard: true }); assert.deepEqual(f.calls, ['static-fallback']); assert.equal(f.intro.hidden, true);
  });
  test(`${site}: a dictionary arriving after recovery does not activate the intro`, async () => {
    const f = await fixture(site, { delayLanguage: true }); f.startup.fail(); f.resolveLanguage(); await f.flush();
    assert.equal(f.calls.includes('intro'), false); assert.equal(f.calls.includes('import'), false);
  });
}
test('Inicio: late Alan starts in the current language', async () => {
  const f = await fixture('home', { lang: 'en' }); f.resolve(); await f.flush(); assert.equal(f.options[0].name, 'English');
});
