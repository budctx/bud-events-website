#!/usr/bin/env node
// Aggregate npm audit results; avoid logging advisory URLs, names or private metadata.
import { readFileSync } from 'node:fs';
let report;
try { report = JSON.parse(readFileSync('dependency-audit.json', 'utf8')); }
catch {
  console.error('Dependency security review: npm audit output unreadable. Treat as UNKNOWN, not clean.');
  process.exitCode = 1;
}
if (report) {
  if (report.error || !report.metadata?.vulnerabilities) {
    console.error('Dependency security review: provider/audit failure. Treat as UNKNOWN, not clean.');
    process.exitCode = 1;
  } else {
    const { critical = 0, high = 0, moderate = 0, low = 0 } = report.metadata.vulnerabilities;
    console.log(JSON.stringify({ scope: 'production-dependencies', critical, high, moderate, low,
      evidence: 'dependency-audit artifact', autoFix: false, stageApproved: false }));
    // Baseline observation only. Do not upgrade or deploy without a reviewed PR.
  }
}
