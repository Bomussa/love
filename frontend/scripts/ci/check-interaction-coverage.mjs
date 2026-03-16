import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const inventoryPath = path.join(root, 'src/components/interaction-inventory.json');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));

const missing = [];
let total = 0;
let covered = 0;

for (const component of inventory.components) {
  const absFile = path.join(path.resolve(root, '..'), component.file);
  const source = fs.readFileSync(absFile, 'utf-8');

  for (const interaction of component.interactions) {
    total += 1;

    const hasStatic = interaction.testId
      ? source.includes(`data-testid="${interaction.testId}"`) || source.includes(`data-testid={'${interaction.testId}'}`)
      : false;

    const hasPattern = interaction.testIdPattern
      ? source.includes(interaction.testIdPattern.split('*')[0])
      : false;

    const ok = hasStatic || hasPattern;
    if (ok) {
      covered += 1;
    } else {
      missing.push(`${component.name}:${interaction.id}`);
    }
  }
}

const ratio = total === 0 ? 100 : (covered / total) * 100;
const threshold = 99;

console.log(`Interaction coverage: ${covered}/${total} (${ratio.toFixed(2)}%)`);
if (missing.length) {
  console.log('Missing coverage:', missing.join(', '));
}

if (ratio < threshold) {
  console.error(`Coverage gate failed. Required >= ${threshold}%.`);
  process.exit(1);
}
