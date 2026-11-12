# Environment Notes — Management Tugas Project

## Project
- Path: `C:\laragon\www\Management_Tugas_Redesign_Terbaru`
- Server: `node server.js` (Express 5), port 3000
- Env loading: `node --env-file-if-exists=.env.local --test` for Node test runs

## Neon Database
- Test DB: `neondb_test` in project `falling-river-53025350` (region `aws-ap-southeast-1`), branch `production` (br-frosty-bonus-azfu5ds3), state `ready`
- Production DB: `neondb` in project `mute-pond-35793990` (region `aws-us-east-2`)
- `.env.local` contains: `TEST_DATABASE_URL` (test), `DATABASE_URL` (prod), `NEON_AUTH_BASE_URL`
  - `TEST_DATABASE_URL` password is **placeholder `***`** — blocked from integration tests; user must copy real connection string from Neon Console → Connect
- Neon CLI 8.11.4, authenticated; `neon status` / `neon projects list` / `neon databases list` work

## Tool Quirks
- Host OS: Windows 11; terminal runs through git-bash/MSYS
- `ss`/`netstat` NOT available — use `ps aux` + `curl` + Node probes
- `psql` binary NOT installed in workspace — apply migrations programmatically via `@neondatabase/serverless` Neon driver
- `node --env-file-if-exists=.env.local` required to load `.env.local` into Node test process
- No `git` repo initialized in this project (git status/ref returns exit 128)
- `npm test` must list test files explicitly. A bare `node --test` also sweeps `scripts/test-otp-flow*.mjs` and other standalone probe scripts (no `node:test` import), which hang and fail.
- Playwright config: project is ESM (`"type": "module"`) — `require.resolve` is unavailable in `playwright.config.js`; `globalSetup` must be a path string and `tests/e2e/global-setup.js` needs a single **default** export. Keep `workers` capped (2) — unlimited parallel browsers against one dev server deadlock context teardown.
- App is a hash-routed SPA in `index.html`: only `#/login` plus `#/dashboard|tugas|laporan|pengingat|pengguna|aktivitas` exist. Server returns 404 for `/login`, `/dashboard`, etc.
- After a successful unverified sign-up the UI opens **OTP mode** (`#auth-otp`, `.auth-otp-email`), not a "email-check" card. `tampilkanEmailCheck` in views-auth.js is dead code.
- `TEST_DATABASE_URL` in `.env.local` now holds a real 16-char password; `npm run test:integration` passes (1,237-row pagination + Owner concurrency).

## Key Scripts & Files
- `scripts/apply-test-migrations.js` — test-specific migration runner (validates host/db/role, skips `legacy_schema_upgrade.sql`)
- `scripts/backup-database.js` — timestamped backup using `pg_dump`/`neon databases clone`
- `lib/email.js` — email service adapter (Resend/SMTP/Mock), `EMAIL_PROVIDER` toggle, default Mock
- `playwright.config.js`, `tests/e2e/app.spec.js` — Playwright E2E suite (14 scenarios)
- `tests/e2e/global-setup.js` — Playwright global setup with mock test server
- `scripts/check-test-db.mjs` — read-only TEST_DATABASE_URL checker (no secrets printed, `PASSWORD_PLACEHOLDER` guard)
- `scripts/setup-test-database.js` — test DB verification script
- `node_modules/@neondatabase/auth@0.7.0-beta` — Neon Auth SDK (installed)

## Auth Architecture
- Neon Auth proxy: `server.js` mounts `app.use('/api/neon-auth', proxyNeonAuthRequest)`
- Frontend: `assets/js/neon-auth-client.js` (`createAuthClient('/api/neon-auth')`), `assets/js/store.js` (`registrasi`, `masuk`, `sesi`)
- Registration error flow: Neon Auth SDK returns lowercase `error.code` (e.g. `email_not_verified`); frontend `messages` map uses uppercase keys — lookup must uppercase before match, otherwise fallback to "Kendala autentikasi"
