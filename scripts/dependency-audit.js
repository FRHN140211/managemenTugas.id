import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Programmatically checks for known vulnerabilities using npm audit JSON output.
 *
 * Usage:
 *   node scripts/dependency-audit.js
 *   node scripts/dependency-audit.js --fail-on high
 *
 * Exit codes:
 *   0 - No vulnerabilities at or above the threshold
 *   1 - Vulnerabilities found at or above the threshold
 */

const args = process.argv.slice(2);
const failOnIndex = args.indexOf('--fail-on');
const failOnSeverity = failOnIndex !== -1 ? args[failOnIndex + 1] : 'high';

const severityOrder = ['info', 'low', 'moderate', 'high', 'critical'];

function getSeverityLevel(severity) {
  return severityOrder.indexOf(severity);
}

function main() {
  const auditPath = join(process.cwd(), 'docs', 'audit-raw.json');

  if (!existsSync(auditPath)) {
    console.error('Audit raw JSON not found. Run `npm audit --json > docs/audit-raw.json` first.');
    process.exit(1);
  }

  const raw = readFileSync(auditPath, 'utf8');
  let audit;
  try {
    audit = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse audit JSON:', err.message);
    process.exit(1);
  }

  const vuln = audit.vulnerabilities || {};
  const meta = audit.metadata?.vulnerabilities || {};
  const thresholdLevel = getSeverityLevel(failOnSeverity);

  console.log(`# Dependency Audit Summary\n`);
  console.log(`| Severity | Count |`);
  console.log(`|----------|-------|`);
  for (const sev of severityOrder) {
    const count = meta[sev] || 0;
    console.log(`| ${sev.charAt(0).toUpperCase() + sev.slice(1)} | ${count} |`);
  }
  console.log(`| Total | ${meta.total || 0} |`);
  console.log();

  const failingVulns = [];
  const fixed = [];
  const unfixed = [];

  for (const [name, data] of Object.entries(vuln)) {
    const sevLevel = getSeverityLevel(data.severity);
    if (sevLevel >= thresholdLevel) {
      failingVulns.push({ name, ...data });
    }

    if (data.fixAvailable) {
      fixed.push({ name, fix: data.fixAvailable });
    } else {
      unfixed.push({ name });
    }
  }

  if (failingVulns.length > 0) {
    console.log(`## Vulnerabilities at or above ${failOnSeverity}\n`);
    for (const v of failingVulns) {
      console.log(`- **${v.name}** (${v.severity}) — isDirect: ${v.isDirect}`);
      if (v.via && v.via.length > 0) {
        const via = v.via.map(item => typeof item === 'string' ? item : item.name).join(', ');
        console.log(`  - Via: ${via}`);
      }
      if (v.fixAvailable) {
        const isMajor = v.fixAvailable.isSemVerMajor ? ' (major)' : '';
        console.log(`  - Fix: ${v.fixAvailable.name}@${v.fixAvailable.version}${isMajor}`);
      } else {
        console.log(`  - Fix: none available`);
      }
    }
    console.log();
  } else {
    console.log(`No vulnerabilities at or above ${failOnSeverity} severity.\n`);
  }

  console.log(`## Fix Status\n`);
  console.log(`- With fix available: ${fixed.length}`);
  console.log(`- Without fix: ${unfixed.length}`);
  console.log();

  if (failingVulns.length > 0) {
    console.log(`Exiting with code 1 due to ${failOnSeverity} vulnerabilities.`);
    process.exit(1);
  }

  process.exit(0);
}

main();
