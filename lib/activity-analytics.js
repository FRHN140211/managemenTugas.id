import { query } from './database.js';
import { verifyNeonToken } from './neon-auth.js';

const VALID_RANGES = new Set(['7d', '30d', '90d', '12m', 'year']);
const EVENT_TYPES = [
  'tugas_dibuat', 'tugas_diubah', 'tugas_selesai', 'tugas_dihapus',
  'laporan_dibuat', 'laporan_diubah', 'laporan_dikirim', 'laporan_dihapus',
  'pengingat_dibuat', 'pengingat_diubah', 'pengingat_selesai', 'pengingat_dihapus',
  'login'
];

function addDays(date, amount) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function validateTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('id-ID', { timeZone: timezone }).format(0);
  } catch {
    const error = new Error('Zona waktu aktivitas tidak valid.');
    error.code = 'ACTIVITY_TIMEZONE_INVALID';
    throw error;
  }
}

function eventRangeFilter(alias, startParameter, endParameter, timezoneParameter) {
  return `${alias}.created_at >= ($${startParameter}::date::timestamp AT TIME ZONE $${timezoneParameter})` +
    ` AND ${alias}.created_at < ($${endParameter}::date::timestamp AT TIME ZONE $${timezoneParameter})`;
}

function eventUserFilter(alias, parameter) {
  return `($${parameter}::text IS NULL OR ${alias}.user_id = $${parameter})`;
}

function taskUserFilter(alias, parameter) {
  return `($${parameter}::text IS NULL OR ${alias}.created_by = $${parameter})`;
}

export async function writeActivityEvent(
  executeQuery,
  { userId, eventType, entityType, entityId = null, metadata = {} }
) {
  if (!EVENT_TYPES.includes(eventType) ||
      !['task', 'report', 'reminder', 'session'].includes(entityType)) {
    throw new TypeError('Jenis event aktivitas tidak valid.');
  }
  try {
    await executeQuery(
      `INSERT INTO activity_events (user_id, event_type, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [userId || null, eventType, entityType, entityId, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Activity analytics event could not be recorded.', {
      code: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
    });
  }
}

export async function recordSuccessfulLogin(token, dependencies = {}) {
  if (typeof token !== 'string' || !token) return false;
  const verifyToken = dependencies.verifyToken || verifyNeonToken;
  const executeQuery = dependencies.query || query;
  const payload = await verifyToken(token);
  if (!payload || payload.emailVerified !== true) return false;
  const users = await executeQuery(
    `SELECT id FROM users
      WHERE account_status = 'Aktif'
        AND (auth_subject = $1 OR (auth_subject IS NULL AND lower(email) = lower($2)))
      LIMIT 1`,
    [payload.sub, payload.email]
  );
  if (!users[0]) return false;
  await writeActivityEvent(executeQuery, {
    userId: users[0].id,
    eventType: 'login',
    entityType: 'session'
  });
  return true;
}

export function recordProxySignIn(request, result, dependencies = {}) {
  const method = String(request.method || 'GET').toUpperCase();
  const pathname = new URL(request.url || '/', 'http://' + (request.headers.host || 'localhost')).pathname;
  if (method !== 'POST' || pathname !== '/api/neon-auth/sign-in/email' ||
      result.status < 200 || result.status >= 300) {
    return Promise.resolve(false);
  }
  const token = result.headers && result.headers['set-auth-jwt'];
  return recordSuccessfulLogin(typeof token === 'string' ? token : '', dependencies);
}

function rangeFor(range, today, year) {
  if (!VALID_RANGES.has(range)) return { error: 'Rentang aktivitas tidak valid.' };
  let start;
  let end = addDays(today, 1);
  if (range === 'year') {
    const currentYear = Number(today.slice(0, 4));
    if (!Number.isInteger(year) || year < 2000 || year > currentYear) {
      return { error: 'Tahun aktivitas tidak valid.' };
    }
    start = `${year}-01-01`;
    end = `${year + 1}-01-01`;
  } else {
    const days = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }[range];
    start = addDays(today, -(days - 1));
  }
  const length = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  return {
    range,
    start,
    end,
    previousStart: addDays(start, -length),
    previousEnd: start,
    granularity: range === '12m' || range === 'year' ? 'month' : 'day'
  };
}

function validId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

function mapRecent(row) {
  return {
    id: String(row.id),
    userId: row.user_id,
    name: row.user_name || null,
    type: row.event_type,
    entity: row.entity_type,
    entityId: row.entity_id,
    title: row.title || '',
    deadline: row.deadline || null,
    createdAt: row.created_at
  };
}

export async function getActivitySummary(user, searchParams, executeQuery = query) {
  const timezone = process.env.ACTIVITY_TIMEZONE || 'Asia/Jakarta';
  validateTimezone(timezone);

  const requestedUserId = searchParams.get('userId') || null;
  if (user.role !== 'owner' && requestedUserId && requestedUserId !== user.id) {
    return {
      status: 403,
      body: { ok: false, error: { code: 'FORBIDDEN', message: 'User hanya dapat melihat aktivitasnya sendiri.' } },
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    };
  }
  const selectedUserId = user.role === 'owner' ? requestedUserId : user.id;
  if (selectedUserId && !validId(selectedUserId)) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_USER', message: 'Filter pengguna tidak valid.' } },
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    };
  }

  const rangeKey = searchParams.get('rentang') || '12m';
  const yearText = searchParams.get('tahun');
  const year = yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  if ((rangeKey === 'year' && (!yearText || year === null)) ||
      (rangeKey !== 'year' && yearText)) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_RANGE', message: 'Tahun hanya dapat dipakai untuk rentang tahun kalender.' } },
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    };
  }

  const todayRows = await executeQuery(
    `SELECT (now() AT TIME ZONE $1)::date::text AS today`,
    [timezone]
  );
  const today = todayRows[0]?.today;
  if (!validDate(today)) throw new Error('Tanggal lokal database tidak valid.');
  const range = rangeFor(rangeKey, today, year);
  if (range.error) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_RANGE', message: range.error } },
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    };
  }

  if (selectedUserId) {
    const users = await executeQuery(
      `SELECT id FROM users WHERE id = $1 AND account_status = 'Aktif' LIMIT 1`,
      [selectedUserId]
    );
    if (!users[0]) {
      return {
        status: 404,
        body: { ok: false, error: { code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan.' } },
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      };
    }
  }

  const activityStart = addDays(today, -364);
  const activityEnd = addDays(today, 1);
  const filterCurrent = eventRangeFilter('e', 2, 3, 5);
  const filterCurrentShort = eventRangeFilter('e', 2, 3, 4);
  const userFilter = eventUserFilter('e', 1);
  const currentParams = [selectedUserId, range.start, range.end, range.previousStart, timezone];
  const recentOffsetText = searchParams.get('offset') || '0';
  if (!/^(0|[1-9]\d*)$/.test(recentOffsetText) || Number(recentOffsetText) > 5000) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_OFFSET', message: 'Posisi aktivitas tidak valid.' } },
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    };
  }

  const [
    totalsRows,
    taskStatusRows,
    heatmapRows,
    trendRows,
    weekdayRows,
    hourRows,
    eventTypeRows,
    recentRows,
    teamUsers,
    teamRows
  ] = await Promise.all([
    executeQuery(
      `SELECT
         count(*) FILTER (WHERE ${filterCurrent})::int AS current_total,
         count(*) FILTER (WHERE ${filterCurrent} AND e.event_type = 'tugas_selesai')::int AS current_completed,
         count(*) FILTER (WHERE e.created_at >= ($4::date::timestamp AT TIME ZONE $5)
                           AND e.created_at < ($2::date::timestamp AT TIME ZONE $5))::int AS previous_total,
         count(*) FILTER (WHERE e.created_at >= ($4::date::timestamp AT TIME ZONE $5)
                           AND e.created_at < ($2::date::timestamp AT TIME ZONE $5)
                           AND e.event_type = 'tugas_selesai')::int AS previous_completed,
         count(*) FILTER (WHERE ${filterCurrent} AND e.event_type = 'tugas_selesai'
                           AND e.metadata ? 'deadline'
                           AND e.created_at < (((e.metadata->>'deadline')::date + 1)::timestamp AT TIME ZONE $5))::int AS on_time
       FROM activity_events e
      WHERE ${userFilter}
        AND e.created_at >= ($4::date::timestamp AT TIME ZONE $5)
        AND e.created_at < ($3::date::timestamp AT TIME ZONE $5)`,
      currentParams
    ),
    executeQuery(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE status = 'Belum Dimulai' AND deadline >= $5::date)::int AS not_started,
         count(*) FILTER (WHERE status = 'Sedang Dikerjakan' AND deadline >= $5::date)::int AS in_progress,
         count(*) FILTER (WHERE status = 'Selesai')::int AS completed,
         count(*) FILTER (WHERE status <> 'Selesai' AND deadline < $5::date)::int AS overdue
       FROM tasks t
      WHERE ${taskUserFilter('t', 1)}
        AND t.created_at >= ($2::date::timestamp AT TIME ZONE $4)
        AND t.created_at < ($3::date::timestamp AT TIME ZONE $4)`,
      [selectedUserId, range.start, range.end, timezone, today]
    ),
    executeQuery(
      `SELECT (e.created_at AT TIME ZONE $4)::date::text AS date, count(*)::int AS count
       FROM activity_events e
      WHERE ${userFilter}
        AND ${eventRangeFilter('e', 2, 3, 4)}
      GROUP BY (e.created_at AT TIME ZONE $4)::date
      ORDER BY date`,
      [selectedUserId, activityStart, activityEnd, timezone]
    ),
    executeQuery(
      `SELECT
         CASE WHEN e.created_at >= ($2::date::timestamp AT TIME ZONE $5) THEN 'current' ELSE 'previous' END AS period,
         date_trunc($6, e.created_at AT TIME ZONE $5)::date::text AS date,
         count(*)::int AS count
       FROM activity_events e
      WHERE ${userFilter}
        AND e.created_at >= ($3::date::timestamp AT TIME ZONE $5)
        AND e.created_at < ($4::date::timestamp AT TIME ZONE $5)
      GROUP BY period, date
      ORDER BY period, date`,
      [selectedUserId, range.start, range.previousStart, range.end, timezone, range.granularity]
    ),
    executeQuery(
      `SELECT extract(isodow FROM e.created_at AT TIME ZONE $4)::int AS day, count(*)::int AS count
       FROM activity_events e
      WHERE ${userFilter} AND ${filterCurrentShort}
      GROUP BY day ORDER BY day`,
      [selectedUserId, range.start, range.end, timezone]
    ),
    executeQuery(
      `SELECT extract(hour FROM e.created_at AT TIME ZONE $4)::int AS hour, count(*)::int AS count
       FROM activity_events e
      WHERE ${userFilter} AND ${filterCurrentShort}
      GROUP BY hour ORDER BY hour`,
      [selectedUserId, range.start, range.end, timezone]
    ),
    executeQuery(
      `SELECT e.event_type, count(*)::int AS count
       FROM activity_events e
      WHERE ${userFilter} AND ${filterCurrentShort}
      GROUP BY e.event_type ORDER BY count DESC, e.event_type`,
      [selectedUserId, range.start, range.end, timezone]
    ),
    executeQuery(
      `SELECT e.id, e.user_id, u.name AS user_name, e.event_type, e.entity_type, e.entity_id,
              e.metadata->>'name' AS title, e.metadata->>'deadline' AS deadline,
              e.created_at::text AS created_at
       FROM activity_events e
       LEFT JOIN users u ON u.id = e.user_id
      WHERE ${userFilter} AND ${eventRangeFilter('e', 2, 3, 4)}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 13 OFFSET $5`,
      [selectedUserId, range.start, range.end, timezone, Number(searchParams.get('offset') || 0)]
    ),
    user.role === 'owner'
      ? executeQuery(`SELECT id, name FROM users WHERE account_status = 'Aktif' ORDER BY name, id`)
      : Promise.resolve([]),
    user.role === 'owner' && !selectedUserId
      ? executeQuery(
          `SELECT u.id, u.name, count(e.id)::int AS total,
                  count(*) FILTER (WHERE e.event_type = 'tugas_selesai')::int AS completed
             FROM activity_events e
             JOIN users u ON u.id = e.user_id
            WHERE ${filterCurrent}
            GROUP BY u.id, u.name
            ORDER BY total DESC, u.name
            LIMIT 5`,
          [null, range.start, range.end, null, timezone]
        )
      : Promise.resolve([])
  ]);

  const totals = totalsRows[0] || {};
  const taskStatus = taskStatusRows[0] || {};
  const currentTotal = Number(totals.current_total) || 0;
  const currentCompleted = Number(totals.current_completed) || 0;
  const completedTasks = Number(taskStatus.completed) || 0;
  const taskTotal = Number(taskStatus.total) || 0;
  const selectedDay = searchParams.get('hari');
  let dayItems = [];
  if (selectedDay) {
    if (!validDate(selectedDay) || selectedDay < activityStart || selectedDay >= activityEnd) {
      return {
        status: 400,
        body: { ok: false, error: { code: 'INVALID_DATE', message: 'Tanggal aktivitas tidak valid.' } },
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      };
    }
    const dayRows = await executeQuery(
      `SELECT e.id, e.user_id, u.name AS user_name, e.event_type, e.entity_type, e.entity_id,
              e.metadata->>'name' AS title, e.metadata->>'deadline' AS deadline,
              e.created_at::text AS created_at
       FROM activity_events e
       LEFT JOIN users u ON u.id = e.user_id
      WHERE ${userFilter}
        AND e.created_at >= ($2::date::timestamp AT TIME ZONE $4)
        AND e.created_at < (($2::date + 1)::timestamp AT TIME ZONE $4)
      ORDER BY e.created_at DESC, e.id DESC LIMIT 50`,
      [selectedUserId, selectedDay, null, timezone]
    );
    dayItems = dayRows.map(mapRecent);
  }

  return {
    status: 200,
    body: {
      ok: true,
      data: {
        timezone,
        today,
        range: {
          key: range.range, start: range.start, end: range.end,
          previousStart: range.previousStart, previousEnd: range.previousEnd,
          granularity: range.granularity
        },
        selectedUserId,
        users: teamUsers.map((item) => ({ id: item.id, name: item.name })),
        ranking: teamRows.map((item) => ({
          id: item.id, name: item.name, total: Number(item.total), completed: Number(item.completed)
        })),
        kpi: {
          total: currentTotal,
          previousTotal: Number(totals.previous_total) || 0,
          completed: currentCompleted,
          previousCompleted: Number(totals.previous_completed) || 0,
          completionRate: taskTotal ? Math.round((completedTasks / taskTotal) * 100) : 0,
          onTimeRate: currentCompleted ? Math.round((Number(totals.on_time) / currentCompleted) * 100) : 0
        },
        tasks: {
          total: taskTotal,
          notStarted: Number(taskStatus.not_started) || 0,
          inProgress: Number(taskStatus.in_progress) || 0,
          completed: completedTasks,
          overdue: Number(taskStatus.overdue) || 0
        },
        heatmap: {
          start: activityStart,
          end: today,
          total: heatmapRows.reduce((total, item) => total + Number(item.count), 0),
          daily: heatmapRows.map((item) => ({ date: item.date, count: Number(item.count) }))
        },
        trend: {
          granularity: range.granularity,
          current: trendRows.filter((item) => item.period === 'current').map((item) => ({
            date: item.date, count: Number(item.count)
          })),
          previous: trendRows.filter((item) => item.period === 'previous').map((item) => ({
            date: item.date, count: Number(item.count)
          }))
        },
        weekdays: weekdayRows.map((item) => ({ day: Number(item.day), count: Number(item.count) })),
        hours: hourRows.map((item) => ({ hour: Number(item.hour), count: Number(item.count) })),
        eventTypes: eventTypeRows.map((item) => ({ type: item.event_type, count: Number(item.count) })),
        recent: recentRows.slice(0, 12).map(mapRecent),
        recentHasMore: recentRows.length > 12,
        recentOffset: Number(recentOffsetText) + Math.min(recentRows.length, 12),
        selectedDay,
        dayItems
      }
    },
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  };
}
