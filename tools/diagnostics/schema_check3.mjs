import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

// Check required tables
const tables = await sql.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = $2 ORDER BY table_name', ['public', 'BASE TABLE']);
console.log('Tables:', tables.map(t => t.table_name).join(', '));

// Check required columns in users
const columns = await sql.query('SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position', ['public', 'users']);
console.log('Users columns:', columns.map(c => c.column_name).join(', '));

// Check auth_subject column exists
const authSubject = await sql.query('SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3', ['public', 'users', 'auth_subject']);
console.log('auth_subject exists:', authSubject.length > 0);

// Check required tables for integration test
const neededTables = ['users', 'tasks', 'reports', 'reminders', 'sessions', 'login_rate_limits', 'activity_logs'];
const existingTablesResult = await sql.query(
  'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = ANY($2)',
  ['public', neededTables]
);
const existingTables = neededTables.map(t => existingTablesResult.find(r => r.table_name === t)).filter(Boolean);
console.log('Required tables found:', existingTables.map(r => r.table_name).join(', '));
