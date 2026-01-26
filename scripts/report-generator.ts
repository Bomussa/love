import fs from 'fs';

const report = {
  timestamp: new Date().toISOString(),
  status: 'FAILED',
  reason: process.env.CI ? 'CI violation detected' : 'Local run',
  rulesApplied: [
    'ESLint Recommended',
    'TypeScript Strict',
    'CodeQL Analysis',
    'Dependabot OSV',
  ],
};

fs.writeFileSync('ci-report.json', JSON.stringify(report, null, 2));
console.log('CI REPORT GENERATED');
