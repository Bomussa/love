#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(packageJsonPath)) {
  fail('package.json not found at repository root.');
}

const rootPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const declaredWorkspaces = Array.isArray(rootPackage.workspaces)
  ? rootPackage.workspaces
  : rootPackage.workspaces?.packages;

if (!Array.isArray(declaredWorkspaces) || declaredWorkspaces.length === 0) {
  fail('No workspaces declared in root package.json.');
}

const missingPatterns = [];

for (const workspacePattern of declaredWorkspaces) {
  if (typeof workspacePattern !== 'string' || workspacePattern.trim() === '') {
    missingPatterns.push(String(workspacePattern));
    continue;
  }

  if (workspacePattern.endsWith('/*')) {
    const baseDir = workspacePattern.slice(0, -2);
    const absoluteBaseDir = path.join(rootDir, baseDir);

    if (!fs.existsSync(absoluteBaseDir) || !fs.statSync(absoluteBaseDir).isDirectory()) {
      missingPatterns.push(workspacePattern);
      continue;
    }

    const childDirs = fs
      .readdirSync(absoluteBaseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());

    const hasWorkspacePackage = childDirs.some((dirEntry) => {
      const candidatePackage = path.join(absoluteBaseDir, dirEntry.name, 'package.json');
      return fs.existsSync(candidatePackage);
    });

    if (!hasWorkspacePackage) {
      missingPatterns.push(workspacePattern);
    }

    continue;
  }

  const absoluteWorkspaceDir = path.join(rootDir, workspacePattern);
  const workspacePackagePath = path.join(absoluteWorkspaceDir, 'package.json');

  if (!fs.existsSync(workspacePackagePath)) {
    missingPatterns.push(workspacePattern);
  }
}

if (missingPatterns.length > 0) {
  fail(
    `Declared workspace entries do not exist or have no package.json: ${missingPatterns.join(', ')}`,
  );
}

console.log(`✅ Workspace validation passed for: ${declaredWorkspaces.join(', ')}`);
