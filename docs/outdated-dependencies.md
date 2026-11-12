# Outdated Dependencies Report

**Generated:** 2025-10-26  
**Tool:** npm outdated  

## Summary

| Package | Current | Wanted | Latest | Type |
|---------|---------|--------|--------|------|
| ioredis | 5.11.1 | 5.11.1 | 6.0.0 | devDependency |
| jose | 6.2.5 | 6.2.13 | 6.2.13 | dependency |
| resend | 3.5.0 | 3.5.0 | 6.34.1 | dependency |
| rollup-plugin-visualizer | 5.14.0 | 5.14.0 | 7.1.1 | devDependency |
| vite | 6.4.5 | 6.4.5 | 8.3.5 | devDependency |

## Analysis

- **jose** and **rollup-plugin-visualizer** have patch-level updates available within their current major versions.
- **resend**, **vite**, and **ioredis** require major version bumps to reach latest.
- No package is below its `wanted` version; all are pinned to exact versions in `package.json`.

## Recommendations

1. **Patch updates (low risk):** Update `jose` from `6.2.5` to `6.2.13`.
2. **Major updates (test required):** `resend`, `vite`, `ioredis`, and `rollup-plugin-visualizer` require breaking-change review before upgrading.
3. Schedule major updates in a dedicated dependency sprint with regression testing.

## Raw Output

See `docs/outdated-raw.json` for the full npm outdated JSON report.
