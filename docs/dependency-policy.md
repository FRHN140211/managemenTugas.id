# Dependency Policy

## Update Policy

- **Patch updates:** May be applied immediately after verification. They contain only backward-compatible bug fixes.
- **Minor updates:** Allowed after manual review and local testing. They add functionality in a backward-compatible manner.
- **Major updates:** Require a dedicated dependency upgrade ticket, changelog review, regression testing, and explicit approval from the project lead. Do not merge major updates as part of feature PRs.
- **Schedule:** Review outdated dependencies at least once per sprint. Use `npm run outdated` to check for available updates.
- **Pinning:** All direct dependencies must be pinned to exact versions in `package.json`. Use caret ranges only for lockfile-generated transitive dependencies.

## Security Policy

- **Audit cadence:** Run `npm audit` or `npm run audit` before every release and at least weekly in CI.
- **Severity thresholds:**
  - `critical` — Fix immediately; block release until resolved.
  - `high` — Fix within 48 hours; schedule a hotfix if a fix is available.
  - `moderate` — Fix within the next sprint.
  - `low` — Fix opportunistically or during the next major dependency refresh.
- **Fix path:** Prefer `npm audit fix` for automatic resolutions. For semver-major fixes, create a separate PR, review the changelog, and run the full test suite.
- **Production vs. dev:** Production vulnerabilities take precedence. Dev-only vulnerabilities may be accepted temporarily if no fix is available without a major breaking change, but they must be tracked and resolved during the next major upgrade cycle.
- **Reporting:** Security issues in dependencies should be reported to the team lead and documented in `docs/dependency-audit.md`.

## Approval Process for Dependency Changes

1. **Proposal:** Any developer may propose a dependency change by opening an issue or PR. The PR must include:
   - Reason for the change (security fix, bug fix, new feature, performance).
   - Changelog or release notes for the new version.
   - Test results confirming no regressions.
2. **Review:** At least one other team member must review dependency changes. For major version bumps, the project lead must approve.
3. **CI gates:** Dependency PRs must pass:
   - `npm test`
   - `npm run depcheck` (no new unused dependencies introduced)
   - `npm run audit` (no new vulnerabilities introduced)
4. **Merge:** Merge only after all CI gates pass and approvals are obtained.
5. **Post-merge:** Monitor the next deployment for regressions. Roll back if issues arise.

## Tooling

- **Audit:** `npm run audit` — runs `npm audit --audit-level=high`
- **Outdated check:** `npm run outdated` — runs `npm outdated`
- **Fix available:** `npm run audit:fix` — runs `npm audit fix`
- **Unused deps:** `npm run depcheck` — runs `npx depcheck`
- **Bundle analysis:** `npm run bundle` — runs `node scripts/bundle-visualizer.js`
- **Programmatic audit:** `node scripts/dependency-audit.js` — parses `docs/audit-raw.json` and reports vulnerabilities at or above the specified severity threshold.

## Dependabot

Dependabot is configured in `.github/dependabot.yml` to check for npm updates weekly. All Dependabot PRs follow the same review and CI gate process described above.
