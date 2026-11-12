import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OWNER_ADVISORY_LOCK_ID = 731091842;

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function loadEnvironmentFile(filePath, environment = process.env) {
  let parsed;
  try {
    parsed = dotenv.parse(readFileSync(filePath));
  } catch (error) {
    if (error.code === 'ENOENT') return { error: null };
    return { error: 'DATABASE_ENV_UNAVAILABLE' };
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (!value.trim()) continue;
    if (typeof environment[key] !== 'string' || !environment[key].trim()) {
      environment[key] = value;
    }
  }
  return { error: null };
}

const localEnvironment = loadEnvironmentFile(path.join(projectDirectory, '.env.local'));

let client;

export function validateDatabaseUrl(connectionString) {
  if (typeof connectionString !== 'string' || !connectionString.trim()) {
    const error = new Error('DATABASE_URL is not configured.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    const error = new Error('DATABASE_URL is invalid.');
    error.code = 'DATABASE_URL_INVALID';
    throw error;
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    const error = new Error('DATABASE_URL must be a PostgreSQL connection URL.');
    error.code = 'DATABASE_URL_INVALID';
    throw error;
  }

  return connectionString;
}

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (typeof value !== 'string' || !value.trim()) {
    if (localEnvironment.error) {
      const error = new Error('Local environment configuration could not be read.');
      error.code = 'DATABASE_ENV_UNAVAILABLE';
      throw error;
    }
    return validateDatabaseUrl(value);
  }
  return validateDatabaseUrl(value);
}

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED'
]);
const RETRYABLE_SQL_CODES = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
]);

async function withRetry(fn, label) {
  let attempt = 0;
  let lastError;
  while (attempt < 3) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = RETRYABLE_ERROR_CODES.has(error.code) ||
        (typeof error.code === 'string' && RETRYABLE_SQL_CODES.has(error.code.slice(0, 5)));
      if (!retryable || attempt >= 2) break;
      const delay = Math.min(1000 * 2 ** attempt, 4000);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
  const wrapped = new Error(label + ' failed after retries.');
  wrapped.originalError = lastError;
  throw wrapped;
}

export function query(statement, parameters = []) {
  const url = connectionString();
  if (!client) client = neon(url);
  return withRetry(() => client.query(statement, parameters), 'Database query').catch((error) => {
    throw error.originalError || error;
  });
}

export function transaction(statements, options = {}) {
  const url = connectionString();
  if (!client) client = neon(url);
  return withRetry(
    () => client.transaction(
      (sql) => statements.map(({ statement, parameters = [] }) => sql.query(statement, parameters)),
      options
    ),
    'Database transaction'
  ).catch((error) => {
    throw error.originalError || error;
  });
}
