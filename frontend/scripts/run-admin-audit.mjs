import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const artifactsDir = path.resolve('e2e/audit/artifacts');
const reportJsonPath = path.join(artifactsDir, 'playwright-report.json');
const summaryJsonPath = path.join(artifactsDir, 'audit-summary.json');
const markdownPath = path.join(artifactsDir, 'audit-report.md');

fs.mkdirSync(artifactsDir, { recursive: true });

let exitCode = 0;
try {
  execSync('npx playwright test --config=playwright.config.mjs', { stdio: 'inherit' });
} catch (err) {
  exitCode = err.status || 1;
}

const json = JSON.parse(fs.readFileSync(reportJsonPath, 'utf-8'));

const tests = [];
const walkSuite = (suite, parents = []) => {
  for (const child of suite.suites || []) walkSuite(child, [...parents, suite.title].filter(Boolean));
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const result = t.results?.[t.results.length - 1];
      const status = result?.status || t.status || 'unknown';
      const title = [...parents, suite.title, spec.title].filter(Boolean).join(' > ');
      const attachments = (result?.attachments || []).map((a) => a.path).filter(Boolean);
      tests.push({ title, status, attachments });
    }
  }
};

for (const suite of json.suites || []) walkSuite(suite, []);

const total = tests.length;
const passed = tests.filter((t) => t.status === 'passed').length;
const failed = tests.filter((t) => t.status === 'failed').length;
const skipped = tests.filter((t) => t.status === 'skipped').length;
const failureRate = total === 0 ? 100 : (failed / total) * 100;

const failedWithScreenshots = tests
  .filter((t) => t.status === 'failed')
  .map((t) => ({
    title: t.title,
    screenshots: t.attachments.filter((a) => /screenshot/i.test(a))
  }));

const summary = {
  total,
  passed,
  failed,
  skipped,
  successRate: Number(((passed / Math.max(total, 1)) * 100).toFixed(2)),
  failureRate: Number(failureRate.toFixed(2)),
  gateThresholdPercent: 2,
  gatePassed: failureRate <= 2,
  generatedAt: new Date().toISOString(),
  failedWithScreenshots
};

fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2));

const mdLines = [
  '# Admin Audit Report',
  '',
  `- Total: **${summary.total}**`,
  `- Passed: **${summary.passed}**`,
  `- Failed: **${summary.failed}**`,
  `- Skipped: **${summary.skipped}**`,
  `- Success Rate: **${summary.successRate}%**`,
  `- Failure Rate: **${summary.failureRate}%**`,
  `- Gate (failure <= 2%): **${summary.gatePassed ? 'PASS' : 'FAIL'}**`,
  ''
];

if (failedWithScreenshots.length > 0) {
  mdLines.push('## Failed test screenshots', '');
  for (const item of failedWithScreenshots) {
    mdLines.push(`### ${item.title}`);
    if (item.screenshots.length === 0) {
      mdLines.push('- No screenshot captured.', '');
      continue;
    }
    for (const screenshot of item.screenshots) {
      const rel = path.relative(process.cwd(), screenshot).replaceAll('\\', '/');
      mdLines.push(`- ![failure screenshot](${rel})`);
    }
    mdLines.push('');
  }
} else {
  mdLines.push('## Failed test screenshots', '', '- No failed tests, so no failure screenshots were generated.', '');
}

fs.writeFileSync(markdownPath, mdLines.join('\n'));

if (exitCode !== 0 || !summary.gatePassed) {
  process.exit(1);
}
