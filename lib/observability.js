/* ============================================================
   observability.js — Metrics collection for request durations,
   error rates, and database query stats.
   ============================================================ */

const MAX_SAMPLES = 1000;
const ERROR_WINDOW_MS = 60 * 1000;

export const metrics = {
  requestDurations: [],
  errors: [],
  dbQueryTimings: [],
  dbConnectionErrors: 0,
  startTime: Date.now()
};

export function recordRequest(durationMs, status) {
  metrics.requestDurations.push({
    ts: Date.now(),
    duration: durationMs,
    status: status
  });
  if (metrics.requestDurations.length > MAX_SAMPLES) {
    metrics.requestDurations = metrics.requestDurations.slice(-MAX_SAMPLES);
  }
  if (status >= 500) {
    recordError('http_' + status);
  }
}

export function recordError(code) {
  metrics.errors.push({ ts: Date.now(), code: code || 'unknown' });
  if (metrics.errors.length > MAX_SAMPLES) {
    metrics.errors = metrics.errors.slice(-MAX_SAMPLES);
  }
}

export function recordDbQuery(durationMs, statement) {
  metrics.dbQueryTimings.push({
    ts: Date.now(),
    duration: durationMs,
    statement: statement
  });
  if (metrics.dbQueryTimings.length > MAX_SAMPLES) {
    metrics.dbQueryTimings = metrics.dbQueryTimings.slice(-MAX_SAMPLES);
  }
}

export function recordDbConnectionError() {
  metrics.dbConnectionErrors += 1;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}

export function getStats() {
  const now = Date.now();
  const durations = metrics.requestDurations.map(r => r.duration);
  const recentErrors = metrics.errors.filter(e => now - e.ts < ERROR_WINDOW_MS);
  const recentRequests = metrics.requestDurations.filter(r => now - r.ts < ERROR_WINDOW_MS);

  return {
    uptime: now - metrics.startTime,
    requests: {
      total: metrics.requestDurations.length,
      recent: recentRequests.length,
      errorRate: recentRequests.length ? Number((recentErrors.length / recentRequests.length).toFixed(4)) : 0,
      durations: {
        min: durations.length ? Math.min(...durations) : 0,
        max: durations.length ? Math.max(...durations) : 0,
        avg: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        p95: percentile(durations, 0.95),
        p99: percentile(durations, 0.99)
      }
    },
    errors: {
      total: metrics.errors.length,
      recent: recentErrors.length,
      recentCodes: recentErrors.reduce((acc, e) => {
        acc[e.code] = (acc[e.code] || 0) + 1;
        return acc;
      }, {})
    },
    database: {
      queryCount: metrics.dbQueryTimings.length,
      slowQueries: metrics.dbQueryTimings.filter(q => q.duration > 500).length,
      connectionErrors: metrics.dbConnectionErrors,
      queryDurations: {
        min: metrics.dbQueryTimings.length ? Math.min(...metrics.dbQueryTimings.map(q => q.duration)) : 0,
        max: metrics.dbQueryTimings.length ? Math.max(...metrics.dbQueryTimings.map(q => q.duration)) : 0,
        avg: metrics.dbQueryTimings.length ? Math.round(metrics.dbQueryTimings.reduce((a, b) => a + b.duration, 0) / metrics.dbQueryTimings.length) : 0
      }
    }
  };
}
