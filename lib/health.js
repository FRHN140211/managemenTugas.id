import { query } from './database.js';

const REQUIRED_COLUMNS = [
  ['users', 'id'], ['users', 'auth_subject'], ['users', 'name'], ['users', 'email'], ['users', 'password_hash'],
  ['users', 'role'], ['users', 'account_status'], ['users', 'created_at'], ['users', 'updated_at'],
  ['tasks', 'id'], ['tasks', 'name'], ['tasks', 'description'], ['tasks', 'deadline'],
  ['tasks', 'status'], ['tasks', 'created_by'], ['tasks', 'created_at'], ['tasks', 'updated_at'],
  ['reports', 'id'], ['reports', 'name'], ['reports', 'description'], ['reports', 'deadline'],
  ['reports', 'status'], ['reports', 'created_by'], ['reports', 'created_at'], ['reports', 'updated_at'],
  ['reminders', 'id'], ['reminders', 'name'], ['reminders', 'description'], ['reminders', 'deadline'],
  ['reminders', 'status'], ['reminders', 'created_by'], ['reminders', 'created_at'], ['reminders', 'updated_at'],
  ['sessions', 'session_hash'], ['sessions', 'user_id'], ['sessions', 'expires_at'], ['sessions', 'created_at'],
  ['login_rate_limits', 'bucket'], ['login_rate_limits', 'window_started_at'], ['login_rate_limits', 'attempts'],
  ['activity_logs', 'id'], ['activity_logs', 'actor_id'], ['activity_logs', 'action'],
  ['activity_logs', 'object_name'], ['activity_logs', 'module'], ['activity_logs', 'occurred_at']
];

function errorCode(error) {
  const pending = [error];
  const seen = new Set();
  while (pending.length) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (typeof current.code === 'string') return current.code;
    pending.push(current.cause, current.sourceError);
  }
  return '';
}

export function databaseHealthFailure(error) {
  const code = errorCode(error);
  if (code === 'DATABASE_NOT_CONFIGURED') {
    return {
      statusCode: 503,
      body: { ok: false, code, error: 'DATABASE_URL is not configured.' }
    };
  }
  if (code === 'DATABASE_URL_INVALID') {
    return {
      statusCode: 503,
      body: { ok: false, code, error: 'DATABASE_URL is invalid; a PostgreSQL connection URL is required.' }
    };
  }
  if (code === 'DATABASE_ENV_UNAVAILABLE') {
    return {
      statusCode: 503,
      body: { ok: false, code, error: 'Local database environment configuration could not be read.' }
    };
  }
  if (['42P01', '42703', '42704'].includes(code)) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        database: 'connected',
        code: 'DATABASE_SCHEMA_INCOMPLETE',
        error: 'Database schema is incomplete.'
      }
    };
  }

  const authenticationFailure = code.startsWith('28') ||
    /password authentication failed|authentication failed/i.test(error?.message || '');
  if (authenticationFailure) {
    return {
      statusCode: 503,
      body: { ok: false, code: 'DATABASE_AUTHENTICATION_FAILED', error: 'Database authentication failed.' }
    };
  }

  return {
    statusCode: 503,
    body: { ok: false, code: 'DATABASE_CONNECTION_FAILED', error: 'Database connection failed.' }
  };
}

export async function checkDatabase() {
  try {
    await query('SELECT 1');

    const requiredValues = REQUIRED_COLUMNS.map(([, column], index) =>
      `($${index * 2 + 1}, $${index * 2 + 2})`).join(', ');
    const missing = await query(
      `WITH required(table_name, column_name) AS (VALUES ${requiredValues})
       SELECT required.table_name, required.column_name
         FROM required
         LEFT JOIN information_schema.columns actual
           ON actual.table_schema = 'public'
          AND actual.table_name = required.table_name
          AND actual.column_name = required.column_name
        WHERE actual.column_name IS NULL
        ORDER BY required.table_name, required.column_name`,
      REQUIRED_COLUMNS.flat()
    );

    if (missing.length) {
      const details = missing.map((item) => `${item.table_name}.${item.column_name}`);
      if (process.env.NODE_ENV !== 'production') {
        console.error('Database schema health check failed:', details.join(', '));
      } else {
        console.error('Database schema health check failed.');
      }
      const body = {
        ok: false,
        database: 'connected',
        code: 'DATABASE_SCHEMA_INCOMPLETE',
        error: 'Database schema is incomplete.'
      };
      if (process.env.NODE_ENV !== 'production') body.missing = details;
      return { statusCode: 503, body };
    }

    return { statusCode: 200, body: { ok: true, database: 'connected' } };
  } catch (error) {
    const failure = databaseHealthFailure(error);
    console.error('Database health check failed:', failure.body.code);
    return failure;
  }
}

export async function handleHealthRequest(method = 'GET') {
  if (String(method).toUpperCase() !== 'GET') {
    return {
      statusCode: 405,
      body: {
        ok: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' }
      }
    };
  }
  return checkDatabase();
}
