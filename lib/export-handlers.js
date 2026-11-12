// lib/export-handlers.js — Export endpoint handlers for tasks, reports, reminders, users
// All functions require authentication and use server-side access control.

import { generateCsv, getCsvResponseHeaders, sanitizeForCsv } from './export.js';

export async function exportTasks(user, db) {
  const query = db || (await import('./database.js')).query;
  const rows = await query(
    `SELECT r.id, r.name, r.description, r.deadline::text AS deadline, r.status,
            u.name AS owner_name, u.email AS owner_email,
            r.created_at::text AS created_at, r.updated_at::text AS updated_at
       FROM tasks r JOIN users u ON u.id = r.created_by
      WHERE ($1 = 'owner' OR r.created_by = $2)
      ORDER BY r.deadline, r.id`,
    [user.role, user.id]
  );
  const data = rows.map(row => {
    const item = {
      id: row.id,
      name: sanitizeForCsv(row.name),
      description: sanitizeForCsv(row.description || ''),
      deadline: row.deadline,
      status: row.status,
      owner: sanitizeForCsv(row.owner_name || ''),
      ownerEmail: sanitizeForCsv(row.owner_email || ''),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    return item;
  });
  const csv = generateCsv(data, {
    headers: ['ID', 'Nama', 'Deskripsi', 'Deadline', 'Status', 'Pemilik', 'Pemilik Email', 'Dibuat', 'Diperbarui']
  });
  const filename = `tugas_export_${new Date().toISOString().slice(0, 10)}.csv`;
  return { status: 200, body: csv, headers: getCsvResponseHeaders(filename) };
}

export async function exportReports(user, db) {
  const query = db || (await import('./database.js')).query;
  const rows = await query(
    `SELECT r.id, r.name, r.description, r.deadline::text AS deadline, r.status,
            u.name AS owner_name, u.email AS owner_email,
            r.created_at::text AS created_at, r.updated_at::text AS updated_at
       FROM reports r JOIN users u ON u.id = r.created_by
      WHERE ($1 = 'owner' OR r.created_by = $2)
      ORDER BY r.deadline, r.id`,
    [user.role, user.id]
  );
  const data = rows.map(row => {
    const item = {
      id: row.id,
      name: sanitizeForCsv(row.name),
      description: sanitizeForCsv(row.description || ''),
      deadline: row.deadline,
      status: row.status,
      owner: sanitizeForCsv(row.owner_name || ''),
      ownerEmail: sanitizeForCsv(row.owner_email || ''),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    return item;
  });
  const csv = generateCsv(data, {
    headers: ['ID', 'Nama', 'Deskripsi', 'Deadline', 'Status', 'Pemilik', 'Pemilik Email', 'Dibuat', 'Diperbarui']
  });
  const filename = `laporan_export_${new Date().toISOString().slice(0, 10)}.csv`;
  return { status: 200, body: csv, headers: getCsvResponseHeaders(filename) };
}

export async function exportReminders(user, db) {
  const query = db || (await import('./database.js')).query;
  const rows = await query(
    `SELECT r.id, r.name, r.description, r.deadline::text AS deadline, r.status,
            u.name AS owner_name, u.email AS owner_email,
            r.created_at::text AS created_at, r.updated_at::text AS updated_at
       FROM reminders r JOIN users u ON u.id = r.created_by
      WHERE ($1 = 'owner' OR r.created_by = $2)
      ORDER BY r.deadline, r.id`,
    [user.role, user.id]
  );
  const data = rows.map(row => {
    const item = {
      id: row.id,
      name: sanitizeForCsv(row.name),
      description: sanitizeForCsv(row.description || ''),
      deadline: row.deadline,
      status: row.status,
      owner: sanitizeForCsv(row.owner_name || ''),
      ownerEmail: sanitizeForCsv(row.owner_email || ''),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    return item;
  });
  const csv = generateCsv(data, {
    headers: ['ID', 'Nama', 'Deskripsi', 'Deadline', 'Status', 'Pemilik', 'Pemilik Email', 'Dibuat', 'Diperbarui']
  });
  const filename = `pengingat_export_${new Date().toISOString().slice(0, 10)}.csv`;
  return { status: 200, body: csv, headers: getCsvResponseHeaders(filename) };
}

export async function exportUsers(user, db) {
  if (user.role !== 'owner') {
    return { status: 403, body: 'Forbidden', headers: {} };
  }
  const query = db || (await import('./database.js')).query;
  const rows = await query(
    `SELECT u.id, u.name, u.email, u.role, u.account_status,
            u.created_at::text AS created_at, u.updated_at::text AS updated_at
       FROM users u
      ORDER BY u.created_at DESC`,
    []
  );
  const data = rows.map(row => {
    const item = {
      id: row.id,
      name: sanitizeForCsv(row.name),
      email: sanitizeForCsv(row.email),
      role: row.role,
      status: row.account_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    return item;
  });
  const csv = generateCsv(data, {
    headers: ['ID', 'Nama', 'Email', 'Role', 'Status', 'Dibuat', 'Diperbarui']
  });
  const filename = `pengguna_export_${new Date().toISOString().slice(0, 10)}.csv`;
  return { status: 200, body: csv, headers: getCsvResponseHeaders(filename) };
}
