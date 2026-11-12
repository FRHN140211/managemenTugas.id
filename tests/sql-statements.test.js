import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { splitSqlStatements } from '../lib/sql-statements.js';

test('splits every checked-in migration into complete statements', () => {
  const directory = new URL('../database/migrations/', import.meta.url);
  const files = readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();

  assert.ok(files.length > 0);
  for (const file of files) {
    const sql = readFileSync(new URL(file, directory), 'utf8');
    assert.ok(splitSqlStatements(sql).length > 0, `${file} should contain statements`);
  }
});

test('splits the legacy owner migration without breaking its DO block', () => {
  const sql = readFileSync(new URL('../database/migrations/002_legacy_owner_column.sql', import.meta.url), 'utf8');
  const statements = splitSqlStatements(sql);

  assert.equal(statements.length, 5);
  assert.match(statements[0], /^DO \$\$[\s\S]*END \$\$$/);
  assert.match(statements[0], /EXECUTE format\(/);
  assert.match(statements[4], /users_email_lower_unique_idx/);
});

test('does not split semicolons inside dollar quotes, strings, or comments', () => {
  const statements = splitSqlStatements([
    "DO $body$ BEGIN RAISE NOTICE 'inside; value'; END $body$;",
    "SELECT 'it''s; valid';",
    '/* outer; /* nested; */ comment */ SELECT 1; -- trailing ; comment'
  ].join('\n'));

  assert.equal(statements.length, 3);
  assert.match(statements[0], /inside; value/);
  assert.equal(statements[1], "SELECT 'it''s; valid'");
  assert.match(statements[2], /SELECT 1/);
});

test('reports unterminated SQL constructs instead of returning broken statements', () => {
  assert.throws(() => splitSqlStatements('DO $$ BEGIN SELECT 1;'), /Unterminated dollar-quoted block/);
  assert.throws(() => splitSqlStatements('SELECT /* missing end'), /Unterminated block comment/);
  assert.throws(() => splitSqlStatements("SELECT 'missing end"), /Unterminated quoted value/);
});
