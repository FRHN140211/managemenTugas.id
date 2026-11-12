import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const envText = readFileSync('C:/laragon/www/Management_Tugas_Redesign_Terbaru/.env.local', 'utf8');
const m = envText.match(/^TEST_DATABASE_URL=(.*)$/m);
const url = m[1].trim().replace(/^["']|["']$/g, '');
const c = neon(url);
await c.query("DELETE FROM users WHERE email LIKE 'test-%' OR auth_subject LIKE 'test-%' OR id LIKE 'test-%' OR email LIKE 'diag-%' OR auth_subject LIKE 'diag-%' OR id LIKE 'diag-%'");
const tables = ['users', 'tasks', 'reports', 'reminders', 'sessions', 'login_rate_limits', 'activity_logs'];
for (const t of tables) {
  const r = await c.query('SELECT count(*)::int AS n FROM ' + t);
  console.log(t + ': ' + r[0].n);
}
