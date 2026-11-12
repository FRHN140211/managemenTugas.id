import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const sourcePath = process.env.I18N_SOURCE
  || new URL('../assets/js/i18n.js', import.meta.url);
const source = readFileSync(sourcePath, 'utf8');
const appSourcePath = process.env.APP_SOURCE
  || new URL('../assets/js/app.js', import.meta.url);
const appSource = readFileSync(appSourcePath, 'utf8');
const moduleSource = readFileSync(new URL('../assets/js/views-modul.js', import.meta.url), 'utf8');
const componentsSource = readFileSync(new URL('../assets/js/components.js', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../assets/js/views-dashboard.js', import.meta.url), 'utf8');
const activitySource = readFileSync(new URL('../assets/js/views-activity.js', import.meta.url), 'utf8');
const locales = {
  id: JSON.parse(readFileSync(new URL('../assets/locales/id.json', import.meta.url), 'utf8')),
  en: JSON.parse(readFileSync(new URL('../assets/locales/en.json', import.meta.url), 'utf8'))
};

function createRuntime({ storedLocale, language, storageThrows = false }) {
  const values = new Map();
  if (storedLocale !== null) values.set('MT.locale', storedLocale);
  const requests = [];
  const translations = {
    id: { greeting: 'Halo {n}, {n}!' },
    en: { greeting: 'Hello {n}, {n}!' }
  };
  const localStorage = {
    getItem(key) {
      if (storageThrows) throw new Error('Storage unavailable');
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (storageThrows) throw new Error('Storage unavailable');
      values.set(key, String(value));
    }
  };
  const window = { MT: {} };
  const fetch = (url) => {
    requests.push(url);
    const locale = /\/([^/]+)\.json$/.exec(url)?.[1];
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(translations[locale] || {})
    });
  };

  runInNewContext(source, {
    window,
    localStorage,
    navigator: { language, userLanguage: language },
    fetch
  });

  return {
    i18n: window.MT.i18n,
    t: window.MT.t,
    requests,
    storedLocale: () => localStorage.getItem('MT.locale')
  };
}

test('init uses a valid stored English locale', async () => {
  const runtime = createRuntime({ storedLocale: 'en', language: 'en-US' });
  await runtime.i18n.init();

  assert.equal(runtime.i18n.getLocale(), 'en');
  assert.equal(runtime.storedLocale(), 'en');
  assert.deepEqual(runtime.requests, ['assets/locales/en.json']);
});

test('init uses a valid stored Indonesian locale', async () => {
  const runtime = createRuntime({ storedLocale: 'id', language: 'en-US' });
  await runtime.i18n.init();

  assert.equal(runtime.i18n.getLocale(), 'id');
  assert.equal(runtime.storedLocale(), 'id');
  assert.deepEqual(runtime.requests, ['assets/locales/id.json']);
});

test('init defaults to Indonesian for invalid or missing storage regardless of browser language', async () => {
  for (const storedLocale of ['xx', null]) {
    const runtime = createRuntime({ storedLocale, language: 'en-US' });
    await runtime.i18n.init();

    assert.equal(runtime.i18n.getLocale(), 'id');
    assert.equal(runtime.storedLocale(), 'id');
    assert.deepEqual(runtime.requests, ['assets/locales/id.json']);
  }
});

test('init falls back safely when browser storage is unavailable', async () => {
  const runtime = createRuntime({ storedLocale: null, language: 'en-US', storageThrows: true });
  await runtime.i18n.init();

  assert.equal(runtime.i18n.getLocale(), 'id');
  assert.equal(runtime.t('greeting', { n: 'Nia' }), 'Halo Nia, Nia!');
});

test('setLocale persists English and a new runtime keeps it after reload', async () => {
  const runtime = createRuntime({ storedLocale: 'id', language: 'id-ID' });
  await runtime.i18n.init();
  await runtime.i18n.setLocale('en');

  assert.equal(runtime.i18n.getLocale(), 'en');
  assert.equal(runtime.storedLocale(), 'en');
  assert.equal(runtime.t('greeting', { n: 'Nia' }), 'Hello Nia, Nia!');

  const reloaded = createRuntime({ storedLocale: runtime.storedLocale(), language: 'id-ID' });
  await reloaded.i18n.init();
  assert.equal(reloaded.i18n.getLocale(), 'en');
  assert.deepEqual(reloaded.requests, ['assets/locales/en.json']);
});

test('missing keys fall back to locale-aware labels instead of revealing raw keys and named parameters are replaced', async () => {
  const runtime = createRuntime({ storedLocale: 'id', language: 'en-US' });
  await runtime.i18n.init();

  assert.equal(runtime.t('missing.translation_key'), 'Indonesia fallback: translation key');
  assert.equal(runtime.t('greeting', { n: 'Nia' }), 'Halo Nia, Nia!');
});

test('the existing i18n.switch action rerenders after loading a locale', () => {
  assert.match(appSource, /MT\.aksi\['i18n\.switch'\]\s*=\s*function\s*\(ds\)\s*\{[\s\S]*?MT\.i18n\.setLocale\(locale\)\.then\(function\s*\(\)\s*\{[\s\S]*?MT\.renderRute\(\);/);
});

test('module labels are translated at render time after locale data is loaded', () => {
  let locale = 'id';
  const translationCalls = [];
  const dictionary = {
    id: {
      'tasks.label_entry': 'Tugas',
      'tasks.page_title': 'Manajemen Tugas',
      'detail.page_title': 'Detail {label}',
      'breadcrumb.dashboard': 'Dasbor',
      'breadcrumb.detail': 'Detail'
    },
    en: {
      'tasks.label_entry': 'Task',
      'tasks.page_title': 'Task Management',
      'detail.page_title': '{label} details',
      'breadcrumb.dashboard': 'Dashboard',
      'breadcrumb.detail': 'Details'
    }
  };
  const mt = {
    comp: { KONFIG_MODUL: { tasks: { status: [], labelNama: 'Nama', labelStatus: 'Status' } } },
    modulHandler: {},
    rute: {},
    aksi: {},
    penanganForm: {},
    t(key, params) {
      translationCalls.push({ locale, key });
      return Object.keys(params || {}).reduce(
        (value, name) => value.replaceAll(`{${name}}`, params[name]),
        dictionary[locale][key] || key
      );
    }
  };
  runInNewContext(moduleSource, { window: { MT: mt }, location: {} });
  mt.buatModul({
    koleksi: 'tasks',
    rute: 'tasks',
    ikon: 'tasks',
    labelEntri: 'tasks.label_entry',
    labelKata: 'tasks.label_entry',
    judulHalaman: 'tasks.page_title'
  });

  assert.equal(translationCalls.length, 0, 'registering the view must not translate before locale initialization');
  assert.equal(mt.rute.tasks.judul(), 'Manajemen Tugas');
  locale = 'en';
  assert.equal(mt.rute.tasks.judul(), 'Task Management');
  assert.equal(mt.rute.tasks.judul('task-1'), 'Task details');
  assert.deepEqual(Array.from(mt.rute.tasks.remah('task-1'), (item) => item.label), ['Dashboard', 'Task Management', 'Details']);
});

test('translated filter labels preserve the original values submitted to the API', () => {
  const mt = {
    icon: () => '',
    esc: (value) => String(value),
    t: (key) => key === 'toolbar.sort' ? 'Sort' : key
  };
  runInNewContext(componentsSource, { window: { MT: mt } });
  const html = mt.comp.toolbar({
    modul: 'tasks',
    cari: false,
    filter: [{
      nama: 'status',
      label: 'Status',
      opsi: [
        { nilai: 'Semua status', label: 'All statuses' },
        { nilai: 'Aktif', label: 'Active' }
      ],
      nilai: 'Semua status'
    }]
  });

  assert.match(html, /data-value="Semua status"[^>]*>[\s\S]*?<strong>All statuses<\/strong>/);
  assert.match(html, /data-value="Aktif"[^>]*>[\s\S]*?<strong>Active<\/strong>/);
  assert.match(html, /aria-selected="true"/);
});

test('the dashboard language switcher is not hidden for Indonesian users', () => {
  assert.match(appSource, /if \(langContainer && MT\.bahasaSwitcher\) \{/);
  assert.doesNotMatch(appSource, /getLocale\(\)\s*!==\s*'id'/);
});

test('dashboard labels and empty panels follow the active locale', () => {
  let locale = 'id';
  const mt = {
    t: (key, params) => Object.keys(params || {}).reduce(
      (value, name) => value.replaceAll(`{${name}}`, params[name]),
      locales[locale][key] || key
    ),
    esc: (value) => String(value),
    icon: () => '',
    formatWeekdayShort: () => 'Mon',
    store: {
      ringkasan: () => ({ tugas: { belum: 0, proses: 0, selesai: 0, total: 0 }, deadlineSegera: [] }),
      state: { completionTrend: [], priorityTasks: [], aktivitas: [], dashboardSummary: {} },
      penggunaAktif: () => ({ nama: '' }),
      adalahOwner: () => false
    },
    comp: { stateKosong: () => '<div class="empty"></div>' },
    rute: {}
  };
  runInNewContext(dashboardSource, { window: { MT: mt } });

  const indonesianHtml = mt.rute.dashboard.render();
  assert.match(indonesianHtml, /<h3>Akses cepat<\/h3>/);
  assert.match(indonesianHtml, /<h3>Agenda mendatang<\/h3>/);
  assert.match(indonesianHtml, /<p class="muted-sm">Grafik akan terisi setelah tugas diselesaikan\.<\/p><\/div><\/section><section class="panel">/);

  mt.store.state.completionTrend = [
    { date: '2026-01-05', count: 1 },
    { date: '2026-01-06', count: 2 }
  ];
  assert.match(mt.rute.dashboard.render(), /<span class="badge badge-neutral">Basis data<\/span>/);

  locale = 'en';
  const englishHtml = mt.rute.dashboard.render();
  assert.match(englishHtml, /<h3>Quick access<\/h3>/);
  assert.match(englishHtml, /<h3>Upcoming agenda<\/h3>/);
  assert.match(englishHtml, /<span class="badge badge-neutral">Database<\/span>/);
  assert.match(englishHtml, /<text x="28\.0" y="152" text-anchor="middle" class="chart-label">Mon<\/text>/);
  assert.doesNotMatch(englishHtml, /Akses cepat|Agenda mendatang|Tugas prioritas|Deadline mendatang/);
});

test('activity dashboard title and breadcrumb follow the active locale', () => {
  let locale = 'id';
  const mt = {
    t: (key) => locales[locale][key] || key,
    esc: (value) => String(value),
    icon: () => '',
    formatTanggalLengkap: () => 'date',
    store: { state: {}, adalahOwner: () => false },
    rute: {},
    aksi: {},
    modulHandler: {}
  };
  runInNewContext(activitySource, {
    window: { MT: mt },
    document: {
      getElementById: () => slot,
      addEventListener: () => {}
    }
  });

  assert.equal(mt.rute.aktivitas.judul(), 'Aktivitas');
  assert.deepEqual(Array.from(mt.rute.aktivitas.remah(), (item) => item.label), ['Dashboard', 'Aktivitas']);
  assert.match(mt.rute.aktivitas.render(), /<h2>Aktivitas<\/h2>/);

  locale = 'en';
  assert.equal(mt.rute.aktivitas.judul(), 'Activity');
  assert.deepEqual(Array.from(mt.rute.aktivitas.remah(), (item) => item.label), ['Dashboard', 'Activity']);
  assert.match(mt.rute.aktivitas.render(), /<h2>Activity<\/h2>/);
});
