// scripts/check-test-db.mjs
// Safe, read-only connection checker for the isolated integration-test database.
//
// Usage:
//   node --env-file-if-exists=.env.local scripts/check-test-db.mjs
//   npm run check:test-db
//
// It NEVER prints the connection string, password, or any credential. It only
// prints safe metadata (host, database name, role, password presence, TLS mode).
// Exit codes: 0 = connected, 1 = failed, 2 = variable not configured.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFileValue(filePath, key) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { found: false, value: undefined };
    return { found: false, value: undefined, readError: true };
  }
  const match = text.match(new RegExp('^' + key + '=(.*)$', 'm'));
  if (!match) return { found: true, value: undefined };
  const raw = match[1].trim();
  const value = raw.replace(/^["']|["']$/g, '').trim();
  return { found: true, value };
}

function classify(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const sqlCode = typeof error?.code === 'string' ? error.code.slice(0, 5) : '';
  const message = String(error?.message || error || '').toLowerCase();

  if (/password authentication failed|28P01|invalid password|role .* does not exist|28000/.test(message) || sqlCode === '28P01' || sqlCode === '28000') {
    return 'AUTH_REJECTED';
  }
  if (/database .* does not exist|3D000/.test(message) || sqlCode === '3D000') return 'DATABASE_NOT_FOUND';
  if (/tls|ssl|certificate|handshake|self.signed|unable to verify/.test(message) || code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return 'TLS_ERROR';
  }
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
    return 'HOST_UNREACHABLE';
  }
  if (/too many clients|53300/.test(message) || sqlCode === '53300') return 'TOO_MANY_CONNECTIONS';
  if (/timeout/.test(message)) return 'NETWORK_TIMEOUT';
  return 'UNKNOWN';
}

function main() {
  const rawUrl = process.env.TEST_DATABASE_URL;
  const fileValue = readEnvFileValue(path.join(projectDirectory, '.env.local'), 'TEST_DATABASE_URL');

  console.log('== Pemeriksaan TEST_DATABASE_URL (tanpa membocorkan nilai) ==');
  console.log('  proses Node membaca TEST_DATABASE_URL : ' + (typeof rawUrl === 'string' && rawUrl.trim() ? 'YA (panjang ' + rawUrl.trim().length + ' karakter)' : 'TIDAK'));
  console.log('  .env.local berisi TEST_DATABASE_URL   : ' + (fileValue.value ? 'YA' : fileValue.found ? 'ADA NAMUN KOSONG' : 'TIDAK ADA'));

  if (!rawUrl || !rawUrl.trim()) {
    console.error('\nHASIL: BELUM DIKONFIGURASI');
    console.error('TEST_DATABASE_URL tidak tersedia bagi proses Node.');
    process.exit(2);
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (error) {
    console.error('\nHASIL: FORMAT_URL_TIDAK_VALID');
    console.error('Nilai TEST_DATABASE_URL bukan URL yang dapat diurai: ' + error.message);
    process.exit(1);
  }

  const isPostgres = ['postgres:', 'postgresql:'].includes(parsed.protocol);
  console.log('  protokol                             : ' + parsed.protocol);
  console.log('  host                                 : ' + parsed.hostname + (parsed.port ? ':' + parsed.port : ''));
  console.log('  database                             : ' + decodeURIComponent(parsed.pathname.replace(/^\//, '')));
  console.log('  role                                 : ' + decodeURIComponent(parsed.username));
  console.log('  password tersedia                    : ' + (parsed.password ? 'YA (' + decodeURIComponent(parsed.password).length + ' karakter)' : 'TIDAK'));
  console.log('  sslmode                              : ' + (parsed.searchParams.get('sslmode') || 'tidak ditentukan (default libpq)'));

  if (!isPostgres) {
    console.error('\nHASIL: FORMAT_URL_TIDAK_VALID');
    console.error('Protokol harus postgres: atau postgresql:');
    process.exit(1);
  }

  // Neon connection strings from the Console never contain a literal "***"
  // password segment. Catching it here prevents a confusing auth failure later.
  if (decodeURIComponent(parsed.password) === '***' || decodeURIComponent(parsed.password) === 'password') {
    console.error('\nHASIL: PASSWORD_PLACEHOLDER');
    console.error('Password pada TEST_DATABASE_URL masih nilai contoh/placeholder, bukan password asli.');
    console.error('Salin connection string PostgreSQL dari Neon Console (Connect) lalu simpan ke TEST_DATABASE_URL.');
    process.exit(1);
  }

  return parsed;
}

async function run() {
  let parsed;
  try {
    parsed = main();
  } catch (error) {
    console.error('\nHASIL: GAGAL (' + classify(error) + ')');
    console.error('Kesalahan tak terduga: ' + error.message);
    process.exit(1);
  }
  if (!parsed) return; // already exited

  let client;
  try {
    client = neon(parsed.href);
  } catch (error) {
    console.error('\nHASIL: GAGAL (' + classify(error) + ')');
    console.error('Tidak dapat membuat klien database: ' + error.message);
    process.exit(1);
  }

  try {
    const result = await client.query('SELECT current_database() AS database, current_user AS role');
    const row = result[0];
    console.log('\n== Hasil koneksi (read-only) ==');
    console.log('  database server : ' + row.database);
    console.log('  role server     : ' + row.role);

    const isolation = await client.query(
      `SELECT current_database() AS db,
              current_setting('app.environment', true) AS environment`,
      []
    ).catch(() => []);
    console.log('  isolasi nama db: ' + (/(^|[_-])test([_-]|$)/i.test(row.database) ? 'TERIDENTIFIKASI SEBAGAI TEST' : 'PERLU DIPERIKSA ULANG'));

    console.log('\nHASIL: BERHASIL');
    console.log('Koneksi read-only ke database testing berhasil.');
    process.exit(0);
  } catch (error) {
    const kind = classify(error);
    console.error('\nHASIL: GAGAL (' + kind + ')');
    console.error('Pesan: ' + String(error?.message || error).split('\n')[0]);
    if (kind === 'AUTH_REJECTED') {
      console.error('\nKredensial ditolak oleh server. Kemungkinan penyebab:');
      console.error('  - password pada TEST_DATABASE_URL bukan password asli (bisa berupa nilai contoh/placeholder),');
      console.error('  - password role sudah berubah, atau');
      console.error('  - role tidak ada di project/branch target.');
      console.error('\nAksi manual: buka Neon Console, pilih project + branch testing, menu Connect,');
      console.error('salin connection string PostgreSQL terbaru, lalu simpan ke TEST_DATABASE_URL di .env.local.');
      console.error('Jangan menempelkan password ke chat dan jangan meng-commit .env.local.');
    }
    process.exit(1);
  }
}

run();
