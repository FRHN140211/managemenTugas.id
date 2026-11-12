import { randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import { OWNER_ADVISORY_LOCK_ID, query, transaction } from '../lib/database.js';
import { databaseHealthFailure } from '../lib/health.js';

async function main() {
  const existing = await query(`SELECT EXISTS (
    SELECT 1 FROM users WHERE role = 'owner'
  ) AS exists`);
  if (existing[0].exists) {
    stdout.write('An Owner account is already configured. No changes were made.\n');
    return;
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  const name = (await prompt.question('Owner name: ')).trim();
  const email = (await prompt.question('Owner email: ')).trim().toLowerCase();
  prompt.close();

  if (name.length < 3 || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error('Name or email is invalid.');
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  const id = randomUUID();
  const [, inserted] = await transaction([
    {
      statement: 'SELECT pg_advisory_xact_lock($1::bigint)',
      parameters: [OWNER_ADVISORY_LOCK_ID]
    },
    {
      statement: `INSERT INTO users (id, name, email, password_hash, role, account_status)
                  SELECT $1, $2, $3, $4, 'owner', 'Aktif'
                   WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')
                  RETURNING id`,
      parameters: [id, name, email, passwordHash]
    }
  ], { isolationLevel: 'ReadCommitted' });

  if (!inserted.length) {
    stdout.write('An Owner account was created concurrently. No duplicate account was added.\n');
    return;
  }
  stdout.write('Owner profile created. Register with this email through Neon Auth and verify the email before signing in.\n');
}

main().catch((error) => {
  const failure = databaseHealthFailure(error);
  stdout.write(`Owner setup failed: ${failure.body.error}\n`);
  process.exitCode = 1;
});
