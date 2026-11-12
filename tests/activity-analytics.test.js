import test from 'node:test';
import assert from 'node:assert/strict';
import { getActivitySummary, recordProxySignIn } from '../lib/activity-analytics.js';
import { handleApiRequest } from '../lib/api.js';

function activityQuery(statement, parameters = []) {
  if (statement.includes('(now() AT TIME ZONE')) return [{ today: '2026-11-05' }];
  if (statement.includes('SELECT id FROM users WHERE id = $1 AND account_status')) {
    return [{ id: parameters[0] }];
  }
  if (statement.includes('SELECT id, name FROM users WHERE account_status')) {
    return [{ id: 'user-1', name: 'Farah Aulia' }];
  }
  if (statement.includes('current_total')) {
    return [{
      current_total: 24,
      current_completed: 4,
      previous_total: 18,
      previous_completed: 3,
      on_time: 3
    }];
  }
  if (statement.includes('FROM tasks t')) {
    return [{ total: 8, not_started: 2, in_progress: 2, completed: 3, overdue: 1 }];
  }
  if (statement.includes('GROUP BY (e.created_at AT TIME ZONE')) {
    return [{ date: '2026-11-05', count: 2 }];
  }
  if (statement.includes('date_trunc(')) {
    return [
      { period: 'current', date: '2026-11-01', count: 24 },
      { period: 'previous', date: '2026-10-01', count: 18 }
    ];
  }
  if (statement.includes('extract(isodow')) return [{ day: 4, count: 4 }];
  if (statement.includes('extract(hour')) return [{ hour: 9, count: 6 }];
  if (statement.includes('GROUP BY e.event_type')) return [{ event_type: 'tugas_selesai', count: 4 }];
  if (statement.includes('LEFT JOIN users u')) {
    return Array.from({ length: 13 }, (_, index) => ({
      id: index + 1,
      user_id: 'user-1',
      user_name: 'Farah Aulia',
      event_type: 'tugas_selesai',
      entity_type: 'task',
      entity_id: `task-${index + 1}`,
      title: 'Tugas ' + (index + 1),
      deadline: '2026-11-10',
      created_at: '2026-11-05T02:00:00.000Z'
    }));
  }
  if (statement.includes('JOIN users u')) {
    return [{ id: 'user-1', name: 'Farah Aulia', total: 24, completed: 4 }];
  }
  assert.fail('Unexpected activity query: ' + statement);
}

test('activity summary aggregates data in Jakarta time and returns bounded dashboard data', async () => {
  const statements = [];
  const executeQuery = async (statement, parameters) => {
    statements.push({ statement, parameters });
    return activityQuery(statement, parameters);
  };
  const response = await getActivitySummary(
    { id: 'owner-1', role: 'owner' },
    new URLSearchParams('rentang=30d'),
    executeQuery
  );

  assert.equal(response.status, 200);
  const { data } = response.body;
  assert.equal(data.timezone, 'Asia/Jakarta');
  assert.equal(data.kpi.total, 24);
  assert.equal(data.kpi.previousTotal, 18);
  assert.equal(data.kpi.onTimeRate, 75);
  assert.equal(data.heatmap.total, 2);
  assert.equal(data.recent.length, 12);
  assert.equal(data.recentHasMore, true);
  assert.equal(data.recentOffset, 12);
  assert.equal(data.users[0].name, 'Farah Aulia');
  assert.equal(data.ranking[0].completed, 4);
  assert.equal(JSON.stringify(data).includes('email'), false);
  assert.ok(statements.some(({ statement, parameters }) =>
    statement.includes('AT TIME ZONE') && parameters.includes('Asia/Jakarta')));
  const trend = statements.find(({ statement }) => statement.includes('date_trunc('));
  assert.match(trend.statement, /CASE WHEN e\.created_at >= \(\$2::date::timestamp AT TIME ZONE \$5\)/);
  assert.match(trend.statement, /date_trunc\(\$6, e\.created_at AT TIME ZONE \$5\)/);
  assert.equal(trend.parameters[4], 'Asia/Jakarta');
  assert.equal(trend.parameters[5], 'day');
});

test('user cannot request another account activity through the authenticated endpoint', async () => {
  const statements = [];
  const response = await handleApiRequest({
    method: 'GET',
    url: 'https://app.example.test/api/activity/summary?rentang=30d&userId=user-2',
    headers: { host: 'app.example.test', authorization: 'Bearer test-token' }
  }, {
    verifyToken: async () => ({
      sub: 'auth-user-1',
      email: 'user@example.test',
      emailVerified: true
    }),
    query: async (statement) => {
      statements.push(statement);
      if (statement.includes('FROM users WHERE auth_subject')) {
        return [{
          id: 'user-1',
          auth_subject: 'auth-user-1',
          name: 'Pengguna',
          email: 'user@example.test',
          role: 'user',
          account_status: 'Aktif'
        }];
      }
      return [];
    }
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.equal(statements.some((statement) => statement.includes('FROM activity_events')), false);
});

test('only a successful email sign-in response can record a verified login event', async () => {
  const statements = [];
  const dependencies = {
    verifyToken: async (token) => token === 'verified'
      ? { sub: 'auth-user-1', email: 'user@example.test', emailVerified: true }
      : null,
    query: async (statement, parameters) => {
      statements.push({ statement, parameters });
      if (statement.includes('SELECT id FROM users')) return [{ id: 'user-1' }];
      return [];
    }
  };
  const request = {
    method: 'POST',
    url: 'https://app.example.test/api/neon-auth/sign-in/email',
    headers: { host: 'app.example.test' }
  };

  assert.equal(await recordProxySignIn(request, {
    status: 401,
    headers: { 'set-auth-jwt': 'verified' }
  }, dependencies), false);
  assert.equal(statements.length, 0);

  assert.equal(await recordProxySignIn(request, {
    status: 200,
    headers: { 'set-auth-jwt': 'verified' }
  }, dependencies), true);
  assert.equal(statements.at(-1).parameters[1], 'login');
  assert.equal(statements.at(-1).parameters[2], 'session');
});

test('activity filters reject invalid ranges before running event queries', async () => {
  let eventQueries = 0;
  const response = await getActivitySummary(
    { id: 'owner-1', role: 'owner' },
    new URLSearchParams('rentang=year&tahun=2027'),
    async (statement) => {
      if (statement.includes('(now() AT TIME ZONE')) return [{ today: '2026-11-05' }];
      eventQueries++;
      return [];
    }
  );
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_RANGE');
  assert.equal(eventQueries, 0);
});

test('analytics events can be recorded when request IP metadata is unavailable', async () => {
  let inserted;
  const response = await handleApiRequest({
    method: 'POST',
    url: 'https://app.example.test/api/analytics',
    headers: { host: 'app.example.test' },
    body: { name: 'page_view' }
  }, {
    transaction: async (statements) => {
      inserted = statements;
      return [];
    }
  });

  assert.equal(response.status, 200);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].parameters[9], 'ip_anonymous');
});
