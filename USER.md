# User Profile — Management Tugas Project

## Persona
Building a full-stack application called **Management Tugas** (Indonesian for "Task Management").
Tech stack: Node.js 26.7.0, Express 5, Neon PostgreSQL (@neondatabase/serverless), Neon Auth;
frontend: HTML/CSS/JS (vanilla, no framework). Deployed locally via `node server.js` on port 3000.

## Communication & Work Style
- Wants **clear, concise status reports** with explicit per-stage indicators: **LULUS** (passed), **GAGAL** (failed), **BELUM DIJALANKAN** (not yet run). Never report "skipped" as success.
- Expects **root-cause reporting** per stage: auth vs connection vs schema vs config.
- Values **honest results** — never skip tests, never claim success without actual tool output, never change application logic merely to mask connection failures.
- Prefers **minimal code changes** to fix bugs (e.g., frontend error-code case normalization rather than redefining Neon Auth config or DB credentials).

## Preferences & Constraints
- **No secrets printed or stored** — never print passwords, connection strings, or credential URLs.
- **No fake test results** — if a test is blocked (e.g., placeholder `***` credentials), report `GAGAL`/`BELUM DIJALANKAN` with the real error and root cause, not a pass.
- **Preserve existing UI design** — do not change logo, favicon, branding colors, typography, sidebar, layout, button/input shapes, dropdowns, modals, spacing, radius, or responsive layout. Only add semantic labels, focus indicators, keyboard navigation for accessibility.
- **One auth system only** — Neon Auth (SDK) or legacy bcrypt with session cookies; never mix. If Neon Auth is confirmed, disable legacy bcrypt login endpoints (return 404 or 405).
- **Test safely** — use dedicated test accounts, never create many test accounts repeatedly on production providers; do not modify existing accounts.
- **No new projects/branches** unless explicitly needed and approved.
- **Per-stage status breakdown** — every major step gets LULUS / GAGAL / BELUM DIJALANKAN.
- **Complete validation** — unit tests, integration tests, multi-record datasets, pagination, Owner concurrency.
