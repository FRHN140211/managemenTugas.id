# Dependency Audit Report

**Generated:** 2025-10-26  
**Tool:** npm audit (v10+)  
**Audit Report Version:** 2  

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 11 |
| Moderate | 1 |
| Low | 2 |
| Info | 0 |
| **Total** | **14** |

**Total Dependencies Scanned:** 776 (prod: 355, dev: 375, optional: 69, peer: 33)

## High Severity Vulnerabilities

All high-severity issues are in dev-dependency chains, primarily around `@lhci/cli` and its transitive dependencies (`lighthouse`, `puppeteer-core`, `proxy-agent`, `extract-zip`, `tmp`, `uuid`, `basic-ftp`, `get-uri`, `pac-proxy-agent`).

| Package | Severity | Via | Fix Available |
|---------|----------|-----|---------------|
| @lhci/cli | High | @lhci/utils, inquirer, lighthouse, proxy-agent, tmp, uuid | `@lhci/cli@0.6.1` (major) |
| @lhci/utils | High | lighthouse | `@lhci/cli@0.6.1` (major) |
| @puppeteer/browsers | High | extract-zip, proxy-agent | `@lhci/cli@0.6.1` (major) |
| basic-ftp | High | GHSA-c475-qrg2-pj4r (CWE-1333: DoS via regex backtracking) | `@lhci/cli@0.6.1` (major) |
| extract-zip | High | GHSA-jmr9-qjv8-65gv (CWE-22: symlink path traversal) | `@lhci/cli@0.6.1` (major) |
| extract-zip | High | GHSA-7pqw-9j4j-h8q3 (CWE-22: arbitrary file write via symlink) | `@lhci/cli@0.6.1` (major) |
| get-uri | High | basic-ftp | `@lhci/cli@0.6.1` (major) |
| lighthouse | High | puppeteer-core | `@lhci/cli@0.6.1` (major) |
| pac-proxy-agent | High | get-uri | `@lhci/cli@0.6.1` (major) |
| proxy-agent | High | pac-proxy-agent | `@lhci/cli@0.6.1` (major) |
| puppeteer-core | High | @puppeteer/browsers | `@lhci/cli@0.6.1` (major) |
| tmp | High | GHSA-ph9p-34f9-6g65 (CWE-22: path traversal via unsanitized prefix/postfix) | `@lhci/cli@0.6.1` (major) |

## Moderate Severity Vulnerabilities

| Package | Severity | Via | Fix Available |
|---------|----------|-----|---------------|
| uuid | Moderate | GHSA-w5hq-g745-h8pq (CWE-787/CWE-1285: missing buffer bounds check) | `@lhci/cli@0.6.1` (major) |

## Low Severity Vulnerabilities

| Package | Severity | Via | Fix Available |
|---------|----------|-----|---------------|
| external-editor | Low | tmp | `@lhci/cli@0.6.1` (major) |
| tmp | Low | GHSA-52f5-9888-hmc6 (CWE-59: arbitrary temp file write via symlink) | `@lhci/cli@0.6.1` (major) |

## Key Findings

1. **No production vulnerabilities** — all 14 issues are in dev-dependency chains.
2. **Fix is a major bump** — all vulnerabilities share the same fix path (`@lhci/cli@0.6.1`), which requires a major version upgrade.
3. **Recommendation:** Evaluate updating `@lhci/cli` to `0.6.1` in a separate maintenance cycle, or accept the dev-only risk until the major upgrade is planned. Production dependencies have no known vulnerabilities.

## Raw Output

See `docs/audit-raw.json` for the full npm audit JSON report.
