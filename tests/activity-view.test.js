import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/js/views-activity.js', import.meta.url), 'utf8');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

test('activity dashboard renders aggregate panels and escapes event titles', async () => {
  const attributes = {};
  const root = {
    innerHTML: '',
    setAttribute(name, value) { attributes[name] = value; }
  };
  const data = {
    timezone: 'Asia/Jakarta',
    today: '2026-11-05',
    range: {
      key: '12m',
      start: '2025-11-06',
      end: '2026-11-06',
      previousStart: '2024-11-06',
      previousEnd: '2025-11-06',
      granularity: 'month'
    },
    selectedUserId: null,
    users: [{ id: 'user-1', name: 'Farah Aulia' }],
    ranking: [{ id: 'user-1', name: 'Farah Aulia', total: 24, completed: 4 }],
    kpi: {
      total: 24, previousTotal: 18, completed: 4, previousCompleted: 3, onTimeRate: 75
    },
    tasks: { total: 8, notStarted: 2, inProgress: 2, completed: 3, overdue: 1 },
    heatmap: {
      start: '2025-11-06',
      end: '2026-11-05',
      total: 1,
      daily: [{ date: '2026-11-05', count: 1 }]
    },
    trend: {
      granularity: 'month',
      current: [{ date: '2026-11-01', count: 24 }],
      previous: [{ date: '2025-11-01', count: 18 }]
    },
    weekdays: [{ day: 4, count: 4 }],
    hours: [{ hour: 9, count: 6 }],
    eventTypes: [{ type: 'tugas_selesai', count: 4 }],
    recent: [{
      id: '1',
      userId: 'user-1',
      name: 'Farah Aulia',
      type: 'tugas_selesai',
      entity: 'task',
      entityId: 'task-1',
      title: '<script>alert(1)</script>',
      deadline: '2026-11-10',
      createdAt: '2026-11-05T02:00:00.000Z'
    }],
    recentHasMore: false,
    recentOffset: 1,
    selectedDay: '',
    dayItems: []
  };
  const mt = {
    t: (key) => ({ 'nav.aktivitas': 'Aktivitas', 'breadcrumb.dashboard': 'Dashboard' }[key] || key),
    esc: escapeHtml,
    icon: () => '<svg aria-hidden="true"></svg>',
    inisial: () => 'FA',
    store: {
      adalahOwner: () => true,
      muatRingkasanAktivitas: async () => data
    },
    rute: {},
    aksi: {},
    modulHandler: {}
  };
  const document = {
    visibilityState: 'visible',
    addEventListener() {},
    getElementById(id) { return id === 'activity-dashboard-content' ? root : null; }
  };
  const window = { MT: mt, setInterval: () => 1, clearInterval() {} };
  runInNewContext(source, { window, document, location: { hash: '#/aktivitas' } });

  assert.match(mt.rute.aktivitas.render(), /<h2>Aktivitas<\/h2>/);
  mt.rute.aktivitas.setelah();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(attributes['aria-busy'], 'false');
  assert.match(root.innerHTML, /activity-heatmap-grid/);
  assert.match(root.innerHTML, /activity-kpis/);
  assert.match(root.innerHTML, /Kontribusi anggota/);
  assert.match(root.innerHTML, /Farah Aulia/);
  assert.match(root.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(root.innerHTML, /<script>alert\(1\)<\/script>/);
});
