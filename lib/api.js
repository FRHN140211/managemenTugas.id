import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OWNER_ADVISORY_LOCK_ID, query, transaction } from './database.js';
import { handleHealthRequest } from './health.js';
import { neonAuthCookieHeader, verifyNeonSession, verifyNeonToken } from './neon-auth.js';
import { exportTasks, exportReports, exportReminders, exportUsers } from './export-handlers.js';
import { getActivitySummary, writeActivityEvent } from './activity-analytics.js';

const PASSWORD_ROUNDS = 12;

const collections = {
  tasks: {
    table: 'tasks',
    label: 'tugas',
    module: 'Manajemen Tugas',
    statuses: ['Belum Dimulai', 'Sedang Dikerjakan', 'Selesai'],
    events: { created: 'tugas_dibuat', updated: 'tugas_diubah', completed: 'tugas_selesai', deleted: 'tugas_dihapus' },
    entity: 'task'
  },
  reports: {
    table: 'reports',
    label: 'laporan',
    module: 'Manajemen Laporan',
    statuses: ['Belum Dimulai', 'Sedang Dikerjakan', 'Selesai'],
    events: { created: 'laporan_dibuat', updated: 'laporan_diubah', completed: 'laporan_dikirim', deleted: 'laporan_dihapus' },
    entity: 'report'
  },
  reminders: {
    table: 'reminders',
    label: 'pengingat',
    module: 'Pengingat',
    statuses: ['Aktif', 'Nonaktif', 'Selesai'],
    events: { created: 'pengingat_dibuat', updated: 'pengingat_diubah', completed: 'pengingat_selesai', deleted: 'pengingat_dihapus' },
    entity: 'reminder'
  }
};

function fail(status, code, message, fields) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: {
      ok: false,
      error: Object.assign({ code, message }, fields ? { fields } : {})
    }
  };
}

function ok(data, status = 200, headers = {}) {
  return {
    status,
    body: { ok: true, data },
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, headers)
  };
}

function requestUrl(request) {
  return new URL(request.url || '/', 'http://' + (request.headers.host || 'localhost'));
}

function validCalendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function hashIp(ip) {
  if (!ip) return 'ip_anonymous';
  var hash = 0;
  for (var i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash |= 0;
  }
  return 'ip_' + Math.abs(hash).toString(36);
}

function validOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return request.headers['sec-fetch-site'] !== 'cross-site';
  try {
    const originHost = new URL(origin).host;
    const forwardedHost = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0].trim();
    return originHost === forwardedHost;
  } catch {
    return false;
  }
}

async function requestBody(request) {
  if (request.body !== undefined) {
    if (request.body !== null && typeof request.body === 'object') {
      if (!Array.isArray(request.body)) return request.body;
      const error = new Error('Request body must be a JSON object.');
      error.status = 400;
      throw error;
    }
    if (typeof request.body !== 'string') {
      const error = new Error('Request body must be a JSON object.');
      error.status = 400;
      throw error;
    }
    let parsed;
    try {
      parsed = JSON.parse(request.body);
    } catch {
      const error = new Error('Request body must be valid JSON.');
      error.status = 400;
      throw error;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    const error = new Error('Request body must be a JSON object.');
    error.status = 400;
    throw error;
  }
  if (request.method === 'GET' || request.method === 'DELETE') return {};

  let raw = '';
  let bytes = 0;
  for await (const chunk of request) {
    raw += chunk;
    bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
    if (bytes > 64 * 1024) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
  }
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  const error = new Error('Request body must be a JSON object.');
  error.status = 400;
  throw error;
}

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    nama: row.name,
    email: row.email,
    role: row.role,
    statusAkun: row.account_status,
    tema: row.theme_preference || null,
    bahasa: row.language_preference || null,
    dibuatPada: row.created_at,
    diperbaruiPada: row.updated_at,
    jumlahTugas: row.task_count === undefined ? undefined : Number(row.task_count),
    jumlahLaporan: row.report_count === undefined ? undefined : Number(row.report_count),
    jumlahPengingat: row.reminder_count === undefined ? undefined : Number(row.reminder_count)
  };
}

function recordFromRow(row) {
  return {
    id: row.id,
    nama: row.name,
    deskripsi: row.description,
    deadline: row.deadline,
    status: row.status,
    pemilikId: row.created_by,
    pemilikNama: row.owner_name || null,
    pemilikEmail: row.owner_email || null,
    dibuatPada: row.created_at,
    diperbaruiPada: row.updated_at
  };
}

function bearerToken(request) {
  const authorization = request.headers.authorization;
  const match = typeof authorization === 'string' && authorization.match(/^Bearer ([^\s]+)$/i);
  return match ? match[1] : null;
}

const appUserColumns = `id, auth_subject, name, email, role, account_status,
                        theme_preference, language_preference,
                        created_at::text AS created_at,
                        updated_at::text AS updated_at`;

function registrationError(status, code, message) {
  return { error: fail(status, code, message) };
}

export async function resolveAppUser(payload, executeQuery = query) {
  if (payload.emailVerified !== true) {
    return { error: fail(403, 'EMAIL_NOT_VERIFIED', 'Verifikasi email sebelum menggunakan aplikasi.') };
  }

  let rows = await executeQuery(
    `SELECT ${appUserColumns} FROM users WHERE auth_subject = $1 LIMIT 1`,
    [payload.sub]
  );
  let row = rows[0];

  if (!row) {
    rows = await executeQuery(
      `SELECT ${appUserColumns} FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [payload.email]
    );
    row = rows[0];
    if (row && row.auth_subject && row.auth_subject !== payload.sub) {
      return registrationError(409, 'IDENTITY_ALREADY_LINKED', 'Profil ini sudah terhubung ke identitas lain.');
    }
    if (row && !row.auth_subject) {
      rows = await executeQuery(
        `UPDATE users SET auth_subject = $1
          WHERE id = $2 AND auth_subject IS NULL
          RETURNING ${appUserColumns}`,
        [payload.sub, row.id]
      );
      row = rows[0];
      if (!row) {
        rows = await executeQuery(
          `SELECT ${appUserColumns} FROM users WHERE auth_subject = $1 LIMIT 1`,
          [payload.sub]
        );
        row = rows[0];
        if (!row) {
          return registrationError(409, 'IDENTITY_ALREADY_LINKED', 'Profil ini sudah terhubung ke identitas lain.');
        }
      }
    }
  }

  if (!row) {
    return registrationError(403, 'ACCOUNT_NOT_PROVISIONED', 'Profil akun belum tersedia.');
  }
  if (row.account_status !== 'Aktif') {
    return { error: fail(403, 'ACCOUNT_DISABLED', 'Akun ini tidak aktif. Hubungi Owner.') };
  }
  return { user: userFromRow(row) };
}

export async function registerAppUser(payload, name, executeQuery = query) {
  if (payload.emailVerified !== true) {
    return registrationError(403, 'EMAIL_NOT_VERIFIED', 'Verifikasi email sebelum membuat profil akun.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 255 ||
      typeof payload.email !== 'string' || payload.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) {
    return registrationError(400, 'INVALID_IDENTITY', 'Identitas akun tidak valid.');
  }
  if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 160) {
    return registrationError(400, 'INVALID_REGISTRATION', 'Nama lengkap harus berisi 3–160 karakter.');
  }

  const existing = await resolveAppUser(payload, executeQuery);
  if (existing.user) return { user: existing.user, created: false };
  if (existing.error.body.error.code !== 'ACCOUNT_NOT_PROVISIONED') return existing;

  const randomLegacyPassword = randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(randomLegacyPassword, PASSWORD_ROUNDS);
  try {
    const rows = await executeQuery(
      `INSERT INTO users
         (id, auth_subject, name, email, password_hash, role, account_status)
       VALUES ($1, $2, $3, $4, $5, 'user', 'Aktif')
       RETURNING ${appUserColumns}`,
      [randomUUID(), payload.sub, name.trim(), payload.email.trim().toLowerCase(), passwordHash]
    );
    if (rows[0]) return { user: userFromRow(rows[0]), created: true };
  } catch (error) {
    if (!error || error.code !== '23505') throw error;
  }

  const concurrent = await resolveAppUser(payload, executeQuery);
  if (concurrent.user) return { user: concurrent.user, created: false };
  if (concurrent.error.body.error.code === 'IDENTITY_ALREADY_LINKED') return concurrent;
  return registrationError(409, 'EMAIL_ALREADY_REGISTERED', 'Email sudah digunakan untuk akun aplikasi lain.');
}

async function currentUser(
  request,
  verifyToken = verifyNeonToken,
  executeQuery = query,
  verifySession = verifyNeonSession
) {
  const token = bearerToken(request);
  const payload = token
    ? await verifyToken(token)
    : await verifySession(request.headers.cookie);
  if (!payload) return { error: fail(401, 'UNAUTHENTICATED', 'Sesi Neon Auth tidak valid atau telah berakhir.') };
  const result = await resolveAppUser(payload, executeQuery);
  return Object.assign({ payload }, result);
}

export function validateRecord(body, statuses, partial = false) {
  const fields = {};
  const value = {};
  const checks = {
    nama: (input) => typeof input === 'string' && input.trim().length >= 1 && input.trim().length <= 200,
    deskripsi: (input) => typeof input === 'string' && input.length <= 10000,
    deadline: (input) => typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) &&
      !Number.isNaN(Date.parse(input)) && new Date(input).toISOString().slice(0, 10) === input,
    status: (input, statuses) => statuses.includes(input)
  };

  for (const key of Object.keys(checks)) {
    if (partial && !Object.prototype.hasOwnProperty.call(body, key)) continue;
    const input = body[key];
    if (!checks[key](input, statuses)) {
      fields[key] = key === 'deadline'
        ? 'Pilih tanggal deadline yang valid.'
        : key === 'status'
          ? 'Pilih status yang tersedia.'
          : key === 'deskripsi'
            ? 'Deskripsi harus berupa teks maksimal 10.000 karakter.'
            : 'Nama wajib diisi dan maksimal 200 karakter.';
    } else {
      value[key] = typeof input === 'string' ? input.trim() : input;
    }
  }
  return { value, fields };
}

export function validateUser(body, partial = false) {
  const input = partial ? body : Object.assign({ statusAkun: 'Aktif' }, body);
  const value = {};
  const fields = {};
  const definitions = {
    nama: (input) => typeof input === 'string' && input.trim().length >= 3 && input.trim().length <= 160,
    email: (input) => typeof input === 'string' && input.trim().length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim()),
    role: (input) => input === 'owner' || input === 'user',
    statusAkun: (input) => input === 'Aktif' || input === 'Nonaktif'
  };

  for (const [key, validate] of Object.entries(definitions)) {
    if (partial && !Object.prototype.hasOwnProperty.call(input, key)) continue;
    if (!validate(input[key])) {
      fields[key] = key === 'email'
        ? 'Masukkan alamat email yang valid.'
        : key === 'role'
          ? 'Pilih role Owner atau User.'
          : key === 'statusAkun'
            ? 'Pilih status akun yang valid.'
            : 'Nama wajib diisi (3–160 karakter).';
    } else {
      value[key] = typeof input[key] === 'string' ? input[key].trim() : input[key];
    }
  }

  return { value, fields };
}

export function validateProfile(body) {
  const value = {};
  const fields = {};
  const allowed = {
    nama: (input) => typeof input === 'string' && input.trim().length >= 3 && input.trim().length <= 160,
    tema: (input) => input === 'light' || input === 'dark' || input === 'system',
    bahasa: (input) => input === 'id' || input === 'en'
  };

  for (const key of Object.keys(body)) {
    if (!Object.prototype.hasOwnProperty.call(allowed, key)) {
      fields[key] = 'Data ini tidak dapat diubah dari pengaturan akun.';
    } else if (!allowed[key](body[key])) {
      fields[key] = key === 'nama'
        ? 'Nama harus terdiri dari 3–160 karakter.'
        : key === 'tema'
          ? 'Pilih tema yang tersedia.'
          : 'Pilih bahasa yang tersedia.';
    } else {
      value[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
    }
  }

  if (!Object.keys(body).length) fields.profil = 'Pilih perubahan yang ingin disimpan.';
  return { value, fields };
}

async function handleProfile(method, path, body, user, executeQuery) {
  if (path.length !== 1) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
  if (method === 'GET') return ok({ user });
  if (method !== 'PATCH') return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');

  const validated = validateProfile(body);
  if (Object.keys(validated.fields).length) {
    return fail(400, 'INVALID_PROFILE', 'Periksa kembali perubahan profil Anda.', validated.fields);
  }

  const columns = { nama: 'name', tema: 'theme_preference', bahasa: 'language_preference' };
  const parameters = [user.id];
  const assignments = Object.entries(validated.value).map(([key, value]) => {
    parameters.push(value);
    return `${columns[key]} = $${parameters.length}`;
  });
  if (!assignments.length) return fail(400, 'INVALID_PROFILE', 'Pilih perubahan yang ingin disimpan.');

  const rows = await executeQuery(
    `UPDATE users SET ${assignments.join(', ')}, updated_at = now()
     WHERE id = $1 RETURNING ${appUserColumns}`,
    parameters
  );
  if (!rows[0]) return fail(404, 'USER_NOT_FOUND', 'Profil akun tidak ditemukan.');
  return ok({ user: userFromRow(rows[0]) });
}

function validId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

const PAGE_SIZE_DEFAULT = 8;
const PAGE_SIZE_MAX = 100;
const PAGE_MAX = Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE_MAX);

export function parsePagination(searchParams) {
  const pageText = searchParams.get('page') || '1';
  const pageSizeText = searchParams.get('pageSize') || String(PAGE_SIZE_DEFAULT);
  if (!/^[1-9]\d*$/.test(pageText) || !/^[1-9]\d*$/.test(pageSizeText)) {
    return { error: 'Nomor halaman dan ukuran halaman harus bilangan bulat positif.' };
  }

  const page = Number(pageText);
  const pageSize = Number(pageSizeText);
  if (!Number.isSafeInteger(page) || page > PAGE_MAX ||
      !Number.isSafeInteger(pageSize) || pageSize > PAGE_SIZE_MAX) {
    return { error: `Ukuran halaman maksimal ${PAGE_SIZE_MAX}; nomor halaman di luar rentang.` };
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function listParameters(searchParams, statuses, sortOptions) {
  const pagination = parsePagination(searchParams);
  if (pagination.error) return pagination;

  const search = (searchParams.get('q') || '').trim();
  if (search.length > 200) return { error: 'Pencarian maksimal 200 karakter.' };
  const status = searchParams.get('status') || '';
  if (status && !statuses.includes(status)) return { error: 'Filter status tidak valid.' };
  const sort = searchParams.get('sort') || 'created';
  if (!Object.prototype.hasOwnProperty.call(sortOptions, sort)) return { error: 'Urutan data tidak valid.' };
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  if ((from && !validCalendarDate(from)) || (to && !validCalendarDate(to)) || (from && to && from > to)) {
    return { error: 'Rentang tanggal tidak valid.' };
  }
  return Object.assign(pagination, { search, status, sort, from, to });
}

const RECORD_SORTS = {
  'deadline-asc': 'r.deadline ASC, r.id ASC',
  'deadline-desc': 'r.deadline DESC, r.id DESC',
  updated: 'r.updated_at DESC, r.id DESC',
  name: 'r.name ASC, r.id ASC',
  status: 'r.status ASC, r.deadline ASC, r.id ASC',
  created: 'r.created_at DESC, r.id DESC'
};
const USER_SORTS = {
  name: 'u.name ASC, u.id ASC',
  email: 'u.email ASC, u.id ASC',
  role: 'u.role ASC, u.name ASC, u.id ASC',
  created: 'u.created_at DESC, u.id DESC'
};

export function buildRecordListQueries(table, user, options) {
  if (!Object.prototype.hasOwnProperty.call(collections, table)) throw new Error('Unknown record collection.');
  const filter = ['($1 = \'owner\' OR r.created_by = $2)'];
  const parameters = [user.role, user.id];
  if (options.status) {
    parameters.push(options.status);
    filter.push(`r.status = $${parameters.length}`);
  }
  if (options.search) {
    parameters.push('%' + options.search + '%');
    filter.push(`concat_ws(' ', r.name, r.description, u.name) ILIKE $${parameters.length}`);
  }
  if (options.from) {
    parameters.push(options.from);
    filter.push(`r.deadline >= $${parameters.length}::date`);
  }
  if (options.to) {
    parameters.push(options.to);
    filter.push(`r.deadline <= $${parameters.length}::date`);
  }
  const where = filter.join(' AND ');
  const count = {
    statement: `SELECT count(*)::int AS total
                  FROM ${table} r
                  JOIN users u ON u.id = r.created_by
                 WHERE ${where}`,
    parameters
  };
  const dataParameters = parameters.concat([options.pageSize, options.offset]);
  const rows = {
    statement: `SELECT r.id, r.name, r.description, r.deadline::text AS deadline, r.status,
                       r.created_by, u.name AS owner_name, u.email AS owner_email,
                       r.created_at::text AS created_at, r.updated_at::text AS updated_at
                  FROM ${table} r
                  JOIN users u ON u.id = r.created_by
                 WHERE ${where}
                 ORDER BY ${RECORD_SORTS[options.sort]}
                 LIMIT $${parameters.length + 1} OFFSET $${parameters.length + 2}`,
    parameters: dataParameters
  };
  return [count, rows];
}

export function buildUserListQueries(options) {
  const filter = [];
  const parameters = [];
  if (options.role) {
    parameters.push(options.role);
    filter.push(`u.role = $${parameters.length}`);
  }
  if (options.status) {
    parameters.push(options.status);
    filter.push(`u.account_status = $${parameters.length}`);
  }
  if (options.search) {
    parameters.push('%' + options.search + '%');
    filter.push(`concat_ws(' ', u.name, u.email) ILIKE $${parameters.length}`);
  }
  const where = filter.length ? `WHERE ${filter.join(' AND ')}` : '';
  return [
    {
      statement: `SELECT count(*)::int AS total FROM users u ${where}`,
      parameters
    },
    {
      statement: `SELECT u.id, u.name, u.email, u.role, u.account_status,
                         u.created_at::text AS created_at, u.updated_at::text AS updated_at
                    FROM users u ${where}
                   ORDER BY ${USER_SORTS[options.sort]}
                   LIMIT $${parameters.length + 1} OFFSET $${parameters.length + 2}`,
      parameters: parameters.concat([options.pageSize, options.offset])
    }
  ];
}

function pageData(rows, total, page, pageSize, map) {
  return {
    items: rows.map(map),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasPrevious: page > 1,
      hasNext: page * pageSize < total
    }
  };
}

// Wrap a page payload in the API's standard envelope. The frontend reads
// body.data.items / body.data.pagination, so a bare pageData object would make
// response.status undefined and break every list endpoint.
function okPage(data) {
  return ok(data, 200);
}

async function bootstrap(user) {
  const scope = `($1 = 'owner' OR created_by = $2)`;
  const [taskSummary, reportSummary, reminderSummary, userCount, profileCounts, activity, completionTrend, priorityTasks, deadlines] = await Promise.all([
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'Belum Dimulai')::int AS belum,
              count(*) FILTER (WHERE status = 'Sedang Dikerjakan')::int AS proses,
              count(*) FILTER (WHERE status = 'Selesai')::int AS selesai,
              count(*) FILTER (WHERE status <> 'Selesai' AND deadline < current_date)::int AS lewat,
              count(*) FILTER (WHERE status <> 'Selesai' AND deadline BETWEEN current_date AND current_date + 3)::int AS segera
         FROM tasks WHERE ${scope}`,
      [user.role, user.id]
    ),
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'Belum Dimulai')::int AS belum,
              count(*) FILTER (WHERE status = 'Sedang Dikerjakan')::int AS proses,
              count(*) FILTER (WHERE status = 'Selesai')::int AS selesai
         FROM reports WHERE ${scope}`,
      [user.role, user.id]
    ),
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'Aktif')::int AS aktif,
              count(*) FILTER (WHERE status = 'Nonaktif')::int AS nonaktif,
              count(*) FILTER (WHERE status = 'Selesai')::int AS selesai
         FROM reminders WHERE ${scope}`,
      [user.role, user.id]
    ),
    user.role === 'owner'
      ? query('SELECT count(*)::int AS total FROM users')
      : Promise.resolve([{ total: 1 }]),
    query(
      `SELECT
         COALESCE(t.task_count, 0)::int AS tasks,
         COALESCE(r.report_count, 0)::int AS reports,
         COALESCE(rem.reminder_count, 0)::int AS reminders
         FROM (SELECT $1::text AS user_id) AS marker
  LEFT JOIN (SELECT created_by, count(*)::int AS task_count FROM tasks GROUP BY created_by) t
         ON t.created_by = marker.user_id
  LEFT JOIN (SELECT created_by, count(*)::int AS report_count FROM reports GROUP BY created_by) r
         ON r.created_by = marker.user_id
  LEFT JOIN (SELECT created_by, count(*)::int AS reminder_count FROM reminders GROUP BY created_by) rem
         ON rem.created_by = marker.user_id`,
      [user.id]
    ),
    query(
      `SELECT a.action, a.object_name, a.module,
              a.occurred_at::date::text AS occurred_at,
              u.name AS actor
         FROM activity_logs a
         LEFT JOIN users u ON u.id = a.actor_id
        WHERE ($1 = 'owner' OR a.actor_id = $2)
        ORDER BY a.occurred_at DESC
        LIMIT 100`,
      [user.role, user.id]
    ),
    query(
      `SELECT day::date::text AS date, count(a.id)::int AS count
         FROM generate_series(current_date - 6, current_date, interval '1 day') AS day
         LEFT JOIN activity_logs a
           ON a.occurred_at::date = day::date
          AND a.module = 'Manajemen Tugas'
          AND a.action = 'Menyelesaikan tugas'
          AND ($1 = 'owner' OR a.actor_id = $2)
        GROUP BY day
        ORDER BY day`,
      [user.role, user.id]
    ),
    query(
      `SELECT t.id, t.name, t.description, t.deadline::text AS deadline, t.status,
              t.created_by, u.name AS owner_name, u.email AS owner_email,
              t.created_at::text AS created_at, t.updated_at::text AS updated_at
         FROM tasks t JOIN users u ON u.id = t.created_by
        WHERE ${scope} AND t.status <> 'Selesai'
        ORDER BY t.deadline, t.id LIMIT 5`,
      [user.role, user.id]
    ),
    query(
      `SELECT kind, id, name, deadline::text AS deadline, status
         FROM (
           SELECT 'tugas'::text AS kind, t.id, t.name, t.deadline, t.status
             FROM tasks t WHERE ${scope} AND t.status <> 'Selesai'
           UNION ALL
           SELECT 'pengingat'::text AS kind, r.id, r.name, r.deadline, r.status
             FROM reminders r WHERE ${scope} AND r.status = 'Aktif'
         ) upcoming
        ORDER BY deadline, id LIMIT 5`,
      [user.role, user.id]
    )
  ]);

  return {
    tasks: [],
    reports: [],
    reminders: [],
    users: [],
    summary: {
      tasks: taskSummary[0],
      reports: reportSummary[0],
      reminders: reminderSummary[0],
      users: { total: Number(userCount[0].total) }
    },
    profileCounts: profileCounts[0],
    completionTrend: completionTrend.map((item) => ({
      date: item.date,
      count: Number(item.count)
    })),
    priorityTasks: priorityTasks.map(recordFromRow),
    upcomingItems: deadlines.map((item) => ({
      id: item.id, nama: item.name, deadline: item.deadline, status: item.status,
      jenis: item.kind, href: `#/${item.kind}/${encodeURIComponent(item.id)}`
    })),
    activity: activity.map((item) => ({
      waktu: item.occurred_at,
      aktor: item.actor || 'Pengguna',
      aksi: item.action,
      objek: item.object_name,
      modul: item.module
    }))
  };
}

async function listUsers(searchParams) {
  const options = listParameters(searchParams, ['Aktif', 'Nonaktif'], USER_SORTS);
  if (options.error) return fail(400, 'INVALID_PAGINATION', options.error);
  const role = searchParams.get('role') || '';
  if (role && !['owner', 'user'].includes(role)) {
    return fail(400, 'INVALID_FILTER', 'Filter role tidak valid.');
  }
  options.role = role;
  const [countResult, rowsResult] = await transaction(buildUserListQueries(options), {
    isolationLevel: 'RepeatableRead',
    readOnly: true
  });
  return okPage(pageData(rowsResult, Number(countResult[0].total), options.page, options.pageSize, userFromRow));
}

async function getUser(id) {
  const rows = await query(
    `SELECT u.id, u.name, u.email, u.role, u.account_status,
            u.created_at::text AS created_at, u.updated_at::text AS updated_at,
            COALESCE(t.task_count, 0)::int AS task_count,
            COALESCE(r.report_count, 0)::int AS report_count,
            COALESCE(rem.reminder_count, 0)::int AS reminder_count
       FROM users u
  LEFT JOIN (SELECT created_by, count(*)::int AS task_count FROM tasks GROUP BY created_by) t
         ON t.created_by = u.id
  LEFT JOIN (SELECT created_by, count(*)::int AS report_count FROM reports GROUP BY created_by) r
         ON r.created_by = u.id
  LEFT JOIN (SELECT created_by, count(*)::int AS reminder_count FROM reminders GROUP BY created_by) rem
         ON rem.created_by = u.id
      WHERE u.id = $1 LIMIT 1`,
    [id]
  );
  return userFromRow(rows[0]);
}

async function listRecords(config, user, searchParams) {
  const options = listParameters(searchParams, config.statuses, RECORD_SORTS);
  if (options.error) return fail(400, 'INVALID_PAGINATION', options.error);
  const [countResult, rowsResult] = await transaction(
    buildRecordListQueries(config.table, user, options),
    { isolationLevel: 'RepeatableRead', readOnly: true }
  );
  return okPage(pageData(rowsResult, Number(countResult[0].total), options.page, options.pageSize, recordFromRow));
}

async function reportSummary(user, searchParams) {
  const mode = searchParams.get('mode') || 'month';
  let from;
  let to;
  if (mode === 'month') {
    const month = searchParams.get('month') || '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return fail(400, 'INVALID_PERIOD', 'Pilih bulan rekap yang valid.');
    }
    from = month + '-01';
    const [year, monthNumber] = month.split('-').map(Number);
    const nextMonth = monthNumber === 12
      ? String(year + 1).padStart(4, '0') + '-01'
      : String(year).padStart(4, '0') + '-' + String(monthNumber + 1).padStart(2, '0');
    to = new Date(Date.parse(nextMonth + '-01T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  } else if (mode === 'range') {
    from = searchParams.get('from') || '';
    to = searchParams.get('to') || '';
    if (!validCalendarDate(from) || !validCalendarDate(to) || from > to) {
      return fail(400, 'INVALID_PERIOD', 'Tanggal awal dan akhir rekap wajib diisi dengan rentang yang valid.');
    }
  } else {
    return fail(400, 'INVALID_PERIOD', 'Mode rekap tidak valid.');
  }

  const options = {
    page: 1, pageSize: 10, offset: 0, search: '', status: '',
    sort: 'deadline-asc', from, to
  };
  const [countQuery, rowsQuery] = buildRecordListQueries('reports', user, options);
  const summaryQuery = Object.assign({}, countQuery, {
    statement: countQuery.statement.replace(
      'SELECT count(*)::int AS total',
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE r.status = 'Belum Dimulai')::int AS belum,
              count(*) FILTER (WHERE r.status = 'Sedang Dikerjakan')::int AS proses,
              count(*) FILTER (WHERE r.status = 'Selesai')::int AS selesai`
    )
  });
  const [summaryRows, reportRows] = await transaction([summaryQuery, rowsQuery], {
    isolationLevel: 'RepeatableRead',
    readOnly: true
  });
  return ok({
    summary: summaryRows[0],
    items: reportRows.map(recordFromRow),
    period: { from, to }
  });
}

async function getRecord(config, id, user) {
  const rows = await query(
    `SELECT r.id, r.name, r.description, r.deadline::text AS deadline, r.status, r.created_by,
          u.name AS owner_name, u.email AS owner_email,
          r.created_at::text AS created_at, r.updated_at::text AS updated_at
       FROM ${config.table} r JOIN users u ON u.id = r.created_by
      WHERE r.id = $1 AND ($2 = 'owner' OR r.created_by = $3)
      LIMIT 1`,
    [id, user.role, user.id]
  );
  return rows[0] ? recordFromRow(rows[0]) : null;
}

async function createRecord(config, body, user) {
  const validated = validateRecord(body, config.statuses);
  if (Object.keys(validated.fields).length) {
    return fail(400, 'VALIDATION_ERROR', 'Periksa kembali isian Anda.', validated.fields);
  }
  const data = validated.value;
  const rows = await query(
    `WITH inserted AS (
       INSERT INTO ${config.table} (id, name, description, deadline, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, deadline::text AS deadline, status, created_by,
                 created_at::text AS created_at, updated_at::text AS updated_at
     ),
     logged AS (
       INSERT INTO activity_logs (actor_id, action, object_name, module)
       SELECT $6, $7, name, $8 FROM inserted
       RETURNING id
     )
     SELECT inserted.* FROM inserted`,
    [randomUUID(), data.nama, data.deskripsi, data.deadline, data.status, user.id,
      'Menambahkan ' + config.label, config.module]
  );
  const item = recordFromRow(rows[0]);
  await writeActivityEvent(query, {
    userId: user.id,
    eventType: config.events.created,
    entityType: config.entity,
    entityId: item.id,
    metadata: { name: item.nama, deadline: item.deadline }
  });
  return ok(item, 201);
}

async function updateRecord(config, id, body, user) {
  const previous = await getRecord(config, id, user);
  if (!previous) return fail(404, 'NOT_FOUND', 'Data tidak ditemukan.');
  const merged = Object.assign({}, previous, body);
  const validated = validateRecord(merged, config.statuses);
  if (Object.keys(validated.fields).length) {
    return fail(400, 'VALIDATION_ERROR', 'Periksa kembali isian Anda.', validated.fields);
  }
  const data = validated.value;
  const action = config.table === 'tasks' && previous.status !== 'Selesai' && data.status === 'Selesai'
    ? 'Menyelesaikan tugas'
    : 'Memperbarui ' + config.label;
  const rows = await query(
    `WITH updated AS (
       UPDATE ${config.table}
          SET name = $1, description = $2, deadline = $3, status = $4, updated_at = now()
        WHERE id = $5 AND ($6 = 'owner' OR created_by = $7)
        RETURNING id, name, description, deadline::text AS deadline, status, created_by,
                  created_at::text AS created_at, updated_at::text AS updated_at
     ),
     logged AS (
       INSERT INTO activity_logs (actor_id, action, object_name, module)
       SELECT $7, $8, name, $9 FROM updated
       RETURNING id
     )
     SELECT updated.* FROM updated`,
    [data.nama, data.deskripsi, data.deadline, data.status, id, user.role, user.id, action, config.module]
  );
  if (!rows[0]) return fail(404, 'NOT_FOUND', 'Data tidak ditemukan.');
  const item = recordFromRow(rows[0]);
  const completed = previous.status !== 'Selesai' && data.status === 'Selesai';
  await writeActivityEvent(query, {
    userId: user.id,
    eventType: completed ? config.events.completed : config.events.updated,
    entityType: config.entity,
    entityId: item.id,
    metadata: { name: item.nama, deadline: item.deadline }
  });
  return ok(item);
}

async function deleteRecord(config, id, user) {
  const rows = await query(
    `WITH deleted AS (
       DELETE FROM ${config.table}
        WHERE id = $1 AND ($2 = 'owner' OR created_by = $3)
          RETURNING id, name, deadline::text AS deadline
     ),
     logged AS (
       INSERT INTO activity_logs (actor_id, action, object_name, module)
       SELECT $3, $4, name, $5 FROM deleted
       RETURNING id
     )
     SELECT id, name, deadline FROM deleted`,
    [id, user.role, user.id, 'Menghapus ' + config.label, config.module]
  );
  if (!rows[0]) return fail(404, 'NOT_FOUND', 'Data tidak ditemukan.');
  await writeActivityEvent(query, {
    userId: user.id,
    eventType: config.events.deleted,
    entityType: config.entity,
    entityId: rows[0].id,
    metadata: { name: rows[0].name, deadline: rows[0].deadline }
  });
  return ok({ deleted: true });
}

async function createUser(body, current) {
  const validated = validateUser(body);
  if (Object.keys(validated.fields).length) {
    return fail(400, 'VALIDATION_ERROR', 'Periksa kembali isian Anda.', validated.fields);
  }
  const data = validated.value;
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), PASSWORD_ROUNDS);
  try {
    const rows = await query(
      `WITH inserted AS (
         INSERT INTO users (id, name, email, password_hash, role, account_status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, email, role, account_status,
                   created_at::text AS created_at,
                   updated_at::text AS updated_at
       ),
       logged AS (
         INSERT INTO activity_logs (actor_id, action, object_name, module)
         SELECT $7, 'Menambahkan user', name, 'Manajemen Pengguna'
           FROM inserted
         RETURNING id
       )
       SELECT inserted.* FROM inserted`,
      [randomUUID(), data.nama, data.email.toLowerCase(), passwordHash, data.role, data.statusAkun, current.id]
    );
    return ok(userFromRow(rows[0]), 201);
  } catch (error) {
    if (error.code === '23505') {
      return fail(409, 'EMAIL_EXISTS', 'Email sudah terdaftar.', { email: 'Email sudah digunakan.' });
    }
    throw error;
  }
}

async function updateUser(id, body, current) {
  const expectedUpdatedAt = body.expectedUpdatedAt;
  if (typeof expectedUpdatedAt !== 'string' || Number.isNaN(Date.parse(expectedUpdatedAt))) {
    return fail(428, 'PRECONDITION_REQUIRED', 'Muat ulang data user sebelum menyimpan perubahan.');
  }
  const mutableFields = ['nama', 'email', 'role', 'statusAkun'];
  const hasChanges = mutableFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (!hasChanges) {
    return fail(400, 'EMPTY_UPDATE', 'Sertakan setidaknya satu field user yang akan diperbarui.');
  }
  const existing = await getUser(id);
  if (!existing) return fail(404, 'NOT_FOUND', 'User tidak ditemukan.');
  const validated = validateUser(Object.assign({}, existing, body), true);
  if (Object.keys(validated.fields).length) {
    return fail(400, 'VALIDATION_ERROR', 'Periksa kembali isian Anda.', validated.fields);
  }
  const data = validated.value;

  try {
    const [, rows] = await transaction([
      {
        statement: 'SELECT pg_advisory_xact_lock($1::bigint)',
        parameters: [OWNER_ADVISORY_LOCK_ID]
      },
      {
        statement: `WITH active_owners AS MATERIALIZED (
           SELECT count(*)::int AS count FROM users
            WHERE role = 'owner' AND account_status = 'Aktif'
         ),
         updated AS (
           UPDATE users u
              SET name = $1, email = $2, role = $3, account_status = $4,
                  updated_at = now()
            FROM active_owners
            WHERE u.id = $5
              AND u.updated_at = $7::timestamptz
              AND (u.role <> 'owner' OR u.account_status <> 'Aktif'
                   OR ($3 = 'owner' AND $4 = 'Aktif') OR active_owners.count > 1)
          RETURNING id, name, email, role, account_status,
                    created_at::text AS created_at,
                    updated_at::text AS updated_at
         ),
         logged AS (
           INSERT INTO activity_logs (actor_id, action, object_name, module)
           SELECT $6, 'Memperbarui user', name, 'Manajemen Pengguna'
             FROM updated
           RETURNING id
         )
         SELECT CASE
                  WHEN updated.id IS NOT NULL THEN 'updated'
           WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = $5) THEN 'not_found'
           WHEN EXISTS (SELECT 1 FROM users WHERE id = $5 AND updated_at <> $7::timestamptz) THEN 'conflict'
                  WHEN EXISTS (
                    SELECT 1 FROM users
              WHERE id = $5 AND role = 'owner' AND account_status = 'Aktif'
                  ) AND (SELECT count FROM active_owners) <= 1
                    AND NOT ($3 = 'owner' AND $4 = 'Aktif') THEN 'last_owner'
                  ELSE 'not_found'
                END AS outcome,
                updated.id, updated.name, updated.email, updated.role, updated.account_status,
                updated.created_at, updated.updated_at
           FROM (SELECT 1) AS marker
           LEFT JOIN updated ON true`,
        parameters: [data.nama, data.email.toLowerCase(), data.role, data.statusAkun, id, current.id, expectedUpdatedAt]
      }
    ], { isolationLevel: 'ReadCommitted' });
    const result = rows[0];
    if (result.outcome === 'last_owner') {
      return fail(409, 'LAST_OWNER', 'Owner aktif terakhir tidak dapat dinonaktifkan atau diubah rolenya.');
    }
    if (result.outcome === 'conflict') {
      return fail(409, 'USER_CHANGED', 'Data user sudah berubah. Muat ulang sebelum menyimpan kembali.');
    }
    if (result.outcome !== 'updated') return fail(404, 'NOT_FOUND', 'User tidak ditemukan.');
    return ok(userFromRow(result));
  } catch (error) {
    if (error.code === '23505') {
      return fail(409, 'EMAIL_EXISTS', 'Email sudah terdaftar.', { email: 'Email sudah digunakan.' });
    }
    throw error;
  }
}

async function deleteUser(id, current, expectedUpdatedAt) {
  if (id === current.id) return fail(409, 'SELF_DELETE', 'Akun yang sedang digunakan tidak dapat dihapus.');
  if (typeof expectedUpdatedAt !== 'string' || Number.isNaN(Date.parse(expectedUpdatedAt))) {
    return fail(428, 'PRECONDITION_REQUIRED', 'Muat ulang data user sebelum menghapusnya.');
  }
  try {
    const [, removed] = await transaction([
      {
        statement: 'SELECT pg_advisory_xact_lock($1::bigint)',
        parameters: [OWNER_ADVISORY_LOCK_ID]
      },
      {
        statement: `WITH active_owners AS MATERIALIZED (
           SELECT count(*)::int AS count FROM users
            WHERE role = 'owner' AND account_status = 'Aktif'
         ),
         related AS MATERIALIZED (
           SELECT
             (SELECT count(*) FROM tasks WHERE created_by = $1) +
             (SELECT count(*) FROM reports WHERE created_by = $1) +
             (SELECT count(*) FROM reminders WHERE created_by = $1) AS count
         ),
         deleted AS (
           DELETE FROM users u USING active_owners, related
            WHERE u.id = $1 AND u.updated_at = $3::timestamptz
              AND (u.role <> 'owner' OR u.account_status <> 'Aktif' OR active_owners.count > 1)
              AND related.count = 0
           RETURNING u.name
         ),
         logged AS (
           INSERT INTO activity_logs (actor_id, action, object_name, module)
           SELECT $2, 'Menghapus user', name, 'Manajemen Pengguna'
             FROM deleted
           RETURNING id
         )
         SELECT CASE
                  WHEN deleted.name IS NOT NULL THEN 'deleted'
                  WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = $1) THEN 'not_found'
                  WHEN EXISTS (SELECT 1 FROM users WHERE id = $1 AND updated_at <> $3::timestamptz) THEN 'conflict'
                  WHEN EXISTS (
                    SELECT 1 FROM users
                     WHERE id = $1 AND role = 'owner' AND account_status = 'Aktif'
                  ) AND (SELECT count FROM active_owners) <= 1 THEN 'last_owner'
                  WHEN (SELECT count FROM related) > 0 THEN 'has_records'
                  ELSE 'not_found'
                END AS outcome
           FROM (SELECT 1) AS marker LEFT JOIN deleted ON true`,
        parameters: [id, current.id, expectedUpdatedAt]
      }
    ], { isolationLevel: 'ReadCommitted' });
    const outcome = removed[0].outcome;
    if (outcome === 'last_owner') return fail(409, 'LAST_OWNER', 'Owner aktif terakhir tidak dapat dihapus.');
    if (outcome === 'conflict') return fail(409, 'USER_CHANGED', 'Data user sudah berubah. Muat ulang sebelum menghapusnya.');
    if (outcome === 'has_records') {
      return fail(409, 'USER_HAS_RECORDS', 'User masih memiliki data. Pindahkan atau hapus datanya sebelum menghapus akun.');
    }
    if (outcome !== 'deleted') return fail(404, 'NOT_FOUND', 'User tidak ditemukan.');
  } catch (error) {
    if (error.code === '23503') {
      return fail(409, 'USER_HAS_RECORDS', 'User masih memiliki data. Pindahkan atau hapus datanya sebelum menghapus akun.');
    }
    throw error;
  }
  return ok({ deleted: true });
}

async function handleUsers(method, path, body, user, searchParams) {
  if (user.role !== 'owner') return fail(403, 'FORBIDDEN', 'Akses hanya tersedia untuk Owner.');
  if (!path[1]) {
    if (method === 'GET') return listUsers(searchParams);
    if (method === 'POST') return createUser(body, user);
    return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
  }
  const id = path[1];
  if (!validId(id)) return fail(400, 'INVALID_ID', 'ID user tidak valid.');
  if (path.length !== 2) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
  if (method === 'GET') {
    const result = await getUser(id);
    return result ? ok(result) : fail(404, 'NOT_FOUND', 'User tidak ditemukan.');
  }
  if (method === 'PATCH') return updateUser(id, body, user);
  if (method === 'DELETE') return deleteUser(id, user, searchParams.get('expectedUpdatedAt'));
  return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
}

async function handleCollection(method, path, body, user, config, searchParams) {
  if (!path[1]) {
    if (method === 'GET') return listRecords(config, user, searchParams);
    if (method === 'POST') return createRecord(config, body, user);
    return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
  }
  const id = path[1];
  if (!validId(id)) return fail(400, 'INVALID_ID', 'ID data tidak valid.');
  if (path.length !== 2) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
  if (method === 'GET') {
    const result = await getRecord(config, id, user);
    return result ? ok(result) : fail(404, 'NOT_FOUND', 'Data tidak ditemukan.');
  }
  if (method === 'PATCH') return updateRecord(config, id, body, user);
  if (method === 'DELETE') return deleteRecord(config, id, user);
  return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
}

async function handleActivity(user) {
  const rows = await query(
    `SELECT a.action, a.object_name, a.module,
            a.occurred_at::date::text AS occurred_at,
            u.name AS actor
       FROM activity_logs a
       LEFT JOIN users u ON u.id = a.actor_id
      WHERE ($1 = 'owner' OR a.actor_id = $2)
      ORDER BY a.occurred_at DESC LIMIT 100`,
    [user.role, user.id]
  );
  return rows.map((item) => ({
    waktu: item.occurred_at,
    aktor: item.actor || 'Pengguna',
    aksi: item.action,
    objek: item.object_name,
    modul: item.module
  }));
}

export async function handleApiRequest(request, dependencies = {}) {
  const verifyToken = dependencies.verifyToken || verifyNeonToken;
  const verifySession = dependencies.verifySession || verifyNeonSession;
  const executeQuery = dependencies.query || query;
  const executeTransaction = dependencies.transaction || transaction;
  const response = {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  };
  try {
    const url = requestUrl(request);
    const path = url.pathname.split('/').filter(Boolean).slice(1);
    const method = String(request.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') return { status: 204, body: null, headers: response.headers };
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
      return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
    }
    if (['POST', 'PATCH', 'DELETE'].includes(method) && !validOrigin(request)) {
      return fail(403, 'INVALID_ORIGIN', 'Permintaan lintas situs ditolak.');
    }

    if (path[0] === 'auth') {
      if (path.length !== 2) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
      if (path[1] === 'me') {
        if (method !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
        if (!bearerToken(request) && !neonAuthCookieHeader(request.headers.cookie)) {
          return ok({ user: null });
        }
        const result = await currentUser(request, verifyToken, executeQuery, verifySession);
        return result.error || ok({ user: result.user });
      }
      if (path[1] === 'register') {
        if (method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');

        // Registrasi bisa dilakukan tanpa sesi (user baru mengisi form cetak biru)
        // Saat tidak ada Bearer token, identitas didapatkan dari body (proxy Neon Auth)
        const body = await requestBody(request);

        // Jika ada sesi, gunakan identitas yang sudah diverifikasi
        const authentication = await currentUser(request, verifyToken, executeQuery, verifySession);
        if (authentication.error && authentication.error.body.error.code !== 'ACCOUNT_NOT_PROVISIONED') {
          return authentication.error;
        }

        const payload = (authentication.payload && Object.prototype.hasOwnProperty.call(authentication.payload, 'sub'))
          ? authentication.payload
          : {
              sub: String(body.sub || ''),
              email: String(body.email || ''),
              emailVerified: body.emailVerified === true
            };

        if (!payload.sub || !payload.email) {
          return fail(400, 'INVALID_IDENTITY', 'Data identitas tidak lengkap.');
        }

        const result = await registerAppUser(payload, String(body.nama || ''), executeQuery);
        return result.error || ok({ user: result.user }, result.created ? 201 : 200);
      }
      return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
    }

    if (path[0] === 'health') {
      if (path.length !== 1) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
      const health = await handleHealthRequest(method);
      return {
        status: health.statusCode,
        body: health.body,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          ...(health.statusCode === 405 ? { Allow: 'GET' } : {})
        }
      };
    }
    // Export routes (CSV/Excel)
    if (path[0] === 'export') {
      if (method !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
      if (path.length !== 2) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
      if (path[1] === 'tasks') return exportTasks(user);
      if (path[1] === 'reports') return exportReports(user);
      if (path[1] === 'reminders') return exportReminders(user);
      if (path[1] === 'users') return exportUsers(user);
      return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
    }
    // Analytics events (public, no auth required for client-side tracking)
    if (path[0] === 'analytics') {
      if (method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
      if (path.length !== 1) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
      const body = await requestBody(request);
      const events = Array.isArray(body.events) ? body.events : (body ? [body] : []);
      const statements = [];
      for (const evt of events) {
        if (!evt || !evt.name) continue;
        statements.push({
          statement: `INSERT INTO analytics_events (id, user_id, session_id, device_id, event_name, category, properties, url, user_agent, ip_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          parameters: [
            evt.id || randomUUID(),
            evt.userId || null,
            evt.sessionId || null,
            evt.deviceId || null,
            String(evt.name || 'unknown').slice(0, 200),
            String(evt.category || 'general').slice(0, 100),
            evt.properties ? JSON.stringify(evt.properties) : '{}',
            evt.url || null,
            evt.userAgent || null,
            hashIp(request.ip || (request.socket && request.socket.remoteAddress) || ''),
          ]
        });
      }
      if (!statements.length) return ok({ received: 0 });
      await executeTransaction(statements, { isolationLevel: 'ReadCommitted' });
      return ok({ received: statements.length });
    }
    if (path[0] === 'profile') {
      if (path.length !== 1) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
      if (!['GET', 'PATCH'].includes(method)) {
        return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
      }
      const authentication = await currentUser(request, verifyToken, executeQuery, verifySession);
      if (authentication.error) return authentication.error;
      const body = method === 'PATCH' ? await requestBody(request) : {};
      return await handleProfile(method, path, body, authentication.user, executeQuery);
    }

    if (!['bootstrap', 'activity', 'users', ...Object.keys(collections)].includes(path[0])) {
      return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
    }
    const authentication = await currentUser(request, verifyToken, executeQuery, verifySession);
    if (authentication.error) return authentication.error;
    const user = authentication.user;
    if (path[0] === 'bootstrap') {
      if (method !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
      return ok(await bootstrap(user));
    }
    if (path[0] === 'activity') {
      if (method !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
      if (path.length === 2 && path[1] === 'summary') {
        return getActivitySummary(user, url.searchParams, executeQuery);
      }
      if (path.length !== 1) return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
      return ok(await handleActivity(user));
    }
    const body = method === 'POST' || method === 'PATCH' ? await requestBody(request) : {};
    if (path[0] === 'users') return await handleUsers(method, path, body, user, url.searchParams);
    if (path[0] === 'reports' && path[1] === 'summary') {
      if (method !== 'GET' || path.length !== 2) return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung.');
      return reportSummary(user, url.searchParams);
    }
    if (collections[path[0]]) {
      return await handleCollection(method, path, body, user, collections[path[0]], url.searchParams);
    }
    return fail(404, 'NOT_FOUND', 'Rute tidak ditemukan.');
  } catch (error) {
    if (error && (error.status === 400 || error.status === 413)) {
      return fail(error.status, 'INVALID_REQUEST', error.message);
    }
    if (error && ['DATABASE_NOT_CONFIGURED', 'DATABASE_URL_INVALID', 'DATABASE_ENV_UNAVAILABLE'].includes(error.code)) {
      return fail(503, error.code, 'Konfigurasi database belum valid atau belum tersedia.');
    }
    if (error && error.code === 'AUTH_NOT_CONFIGURED') {
      return fail(503, 'AUTH_NOT_CONFIGURED', 'Layanan autentikasi belum dikonfigurasi.');
    }
    if (error && error.code === 'AUTH_PROVIDER_UNAVAILABLE') {
      return fail(503, 'AUTH_PROVIDER_UNAVAILABLE', 'Layanan autentikasi sementara tidak tersedia.');
    }
    const errorCode = error && typeof error.code === 'string' ? error.code : '';
    if (errorCode.startsWith('28')) {
      console.error('API database authentication failed.');
      return fail(503, 'DATABASE_AUTHENTICATION_FAILED', 'Autentikasi database gagal.');
    }
    if (['42P01', '42703', '42704'].includes(errorCode)) {
      console.error('API database schema is incomplete:', errorCode);
      return fail(503, 'DATABASE_SCHEMA_INCOMPLETE', 'Skema database belum siap.');
    }
    if (errorCode.startsWith('08') ||
        ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(errorCode)) {
      console.error('API database request is unavailable:', errorCode || 'UnknownError');
      return fail(503, 'DATABASE_UNAVAILABLE', 'Layanan database sementara tidak tersedia.');
    }
    console.error(
      'API request failed:',
      process.env.NODE_ENV === 'production' ? 'InternalError' : errorCode || (error instanceof Error ? error.name : 'UnknownError')
    );
    return fail(500, 'INTERNAL_ERROR', 'Permintaan belum dapat diproses. Coba lagi nanti.');
  }
}
