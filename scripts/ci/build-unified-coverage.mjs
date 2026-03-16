import fs from 'node:fs/promises';
import path from 'node:path';

const integrationPath = path.resolve('artifacts/integration-report.json');
const schemaPath = path.resolve('supabase/schema.sql');
const configPath = path.resolve('tests/integration/unified-integration.config.json');
const outJson = path.resolve('artifacts/unified-coverage-report.json');
const outMd = path.resolve('artifacts/unified-coverage-report.md');

function parseTables(schemaSql) {
  const matches = [...schemaSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)];
  return [...new Set(matches.map((m) => m[1]))].sort();
}

async function main() {
  const [integrationRaw, schemaSql, configRaw] = await Promise.all([
    fs.readFile(integrationPath, 'utf8'),
    fs.readFile(schemaPath, 'utf8'),
    fs.readFile(configPath, 'utf8')
  ]);

  const integration = JSON.parse(integrationRaw);
  const config = JSON.parse(configRaw);
  const tables = parseTables(schemaSql);

  const endpointChecks = integration.checks.filter((c) => c.type === 'backend');
  const uiChecks = integration.checks.filter((c) => c.type === 'frontend');

  const report = {
    generatedAt: new Date().toISOString(),
    endpointCoverage: {
      total: endpointChecks.length,
      passed: endpointChecks.filter((c) => c.ok).length,
      items: endpointChecks
    },
    tableCoverage: {
      total: tables.length,
      tables
    },
    uiFlowCoverage: {
      total: uiChecks.length,
      passed: uiChecks.filter((c) => c.ok).length,
      declaredFlows: config.frontendFlows,
      executedFlows: uiChecks
    },
    releaseGate: integration.summary.releaseGate
  };

  await fs.mkdir(path.dirname(outJson), { recursive: true });
  await fs.writeFile(outJson, JSON.stringify(report, null, 2));

  const md = [
    '# Unified Coverage Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Endpoint Coverage',
    `- Passed: ${report.endpointCoverage.passed}/${report.endpointCoverage.total}`,
    '',
    '## Table Coverage',
    `- Tables discovered from schema: ${report.tableCoverage.total}`,
    '',
    '## UI Flow Coverage',
    `- Passed: ${report.uiFlowCoverage.passed}/${report.uiFlowCoverage.total}`,
    '',
    '## Release Gate',
    `- Pass: ${report.releaseGate.pass}`,
    `- Success threshold: >${report.releaseGate.minSuccessRate}%`
  ].join('\n');

  await fs.writeFile(outMd, `${md}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
