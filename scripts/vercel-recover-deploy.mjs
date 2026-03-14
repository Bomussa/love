#!/usr/bin/env node

/**
 * Execute/verify Vercel recovery settings for MMC-MMS frontend project.
 *
 * Usage:
 *   node scripts/vercel-recover-deploy.mjs --check
 *   node scripts/vercel-recover-deploy.mjs --apply --redeploy --wait
 *
 * Required env:
 *   VERCEL_TOKEN
 *   VERCEL_PROJECT_ID
 * Optional env:
 *   VERCEL_TEAM_ID
 */

import fs from 'node:fs';

const args = new Set(process.argv.slice(2));
const modeCheck = args.has('--check') || (!args.has('--apply') && !args.has('--redeploy'));
const modeApply = args.has('--apply');
const modeRedeploy = args.has('--redeploy');
const modeWait = args.has('--wait');

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID;

if (!token || !projectId) {
  console.error('❌ Missing env: VERCEL_TOKEN and/or VERCEL_PROJECT_ID');
  process.exit(2);
}

const executionContext = { projectId, teamId: teamId || null };
console.log('🔎 Vercel execution context:', executionContext);
if (!teamId) {
  console.warn('⚠️ VERCEL_TEAM_ID is not set; requests will use personal scope.');
}

export function buildApiUrl(path, currentTeamId) {
  const query = currentTeamId ? `?teamId=${encodeURIComponent(currentTeamId)}` : '';
  return `https://api.vercel.com${path}${query}`;
}

const expected = {
  framework: 'vite',
  rootDirectory: null,
  installCommand: 'npm install',
  buildCommand: 'cd frontend && npm install && npm run build',
  outputDirectory: 'frontend/dist',
  nodeVersion: '20.x',
};

function summarizeBody(bodyText) {
  return (bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function createVercelApiClient({ token: apiToken, teamId: apiTeamId }) {
  return async function api(path, init = {}) {
    const endpoint = buildApiUrl(path, apiTeamId);
    const response = await fetch(endpoint, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    const bodyText = await response.text();
    let body;
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      body = { raw: bodyText };
    }

    if (!response.ok) {
      throw new Error(
        `Vercel API request failed: endpoint=${endpoint}, status=${response.status}, teamId=${apiTeamId || 'none'}, body=${summarizeBody(bodyText)}`,
      );
    }

    return body;
  };
}

const api = createVercelApiClient({ token, teamId: executionContext.teamId });

function readLocalVercelConfig() {
  const raw = fs.readFileSync('vercel.json', 'utf8');
  const config = JSON.parse(raw);

  const findings = {
    framework: config.framework,
    installCommand: config.installCommand,
    buildCommand: config.buildCommand,
    outputDirectory: config.outputDirectory,
  };

  const mismatches = Object.entries({
    framework: expected.framework,
    installCommand: expected.installCommand,
    buildCommand: expected.buildCommand,
    outputDirectory: expected.outputDirectory,
  }).filter(([key, value]) => findings[key] !== value);

  return { findings, mismatches };
}

function normalizeProjectSettings(project) {
  return {
    framework: (project.framework || '').toLowerCase(),
    rootDirectory: project.rootDirectory || null,
    installCommand: project.installCommand || '',
    buildCommand: project.buildCommand || '',
    outputDirectory: project.outputDirectory || '',
    nodeVersion: project.nodeVersion || '',
  };
}

function collectMismatches(actual) {
  const checks = [
    ['framework', expected.framework],
    ['rootDirectory', expected.rootDirectory],
    ['installCommand', expected.installCommand],
    ['buildCommand', expected.buildCommand],
    ['outputDirectory', expected.outputDirectory],
    ['nodeVersion', expected.nodeVersion],
  ];

  return checks
    .filter(([key, wanted]) => actual[key] !== wanted)
    .map(([key, wanted]) => ({ key, wanted, actual: actual[key] }));
}

async function patchProjectSettings() {
  const payload = {
    framework: expected.framework,
    rootDirectory: null,
    installCommand: expected.installCommand,
    buildCommand: expected.buildCommand,
    outputDirectory: expected.outputDirectory,
    nodeVersion: expected.nodeVersion,
  };

  return api(`/v9/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function triggerProductionDeploy(project) {
  const gitSource = project.link
    ? {
        type: 'github',
        repoId: project.link.repoId,
        ref: project.link.productionBranch || 'main',
      }
    : null;

  if (!gitSource?.repoId) {
    throw new Error('Project is not linked to GitHub repoId; cannot trigger deployment automatically.');
  }

  return api('/v13/deployments', {
    method: 'POST',
    body: JSON.stringify({
      name: project.name,
      project: project.id,
      target: 'production',
      gitSource,
    }),
  });
}

async function waitForDeploymentReady(deploymentId) {
  const started = Date.now();
  while (Date.now() - started < 15 * 60 * 1000) {
    const dep = await api(`/v13/deployments/${deploymentId}`);
    const state = dep.readyState || dep.state || 'UNKNOWN';
    console.log(`⏳ deployment ${deploymentId}: ${state}`);

    if (state === 'READY') return dep;
    if (['ERROR', 'CANCELED'].includes(state)) {
      throw new Error(`Deployment ended with state=${state}`);
    }

    await new Promise((r) => setTimeout(r, 10_000));
  }

  throw new Error('Timeout waiting for deployment to become READY');
}

async function main() {
  const { findings, mismatches: localMismatches } = readLocalVercelConfig();
  console.log('📄 Local vercel.json:', findings);
  if (localMismatches.length > 0) {
    throw new Error(`Local vercel.json mismatches expected config: ${JSON.stringify(localMismatches)}`);
  }

  const project = await api(`/v9/projects/${projectId}`);
  const current = normalizeProjectSettings(project);
  const mismatches = collectMismatches(current);

  console.log('☁️ Current Vercel project settings:', current);

  if (mismatches.length === 0) {
    console.log('✅ Project settings already match expected recovery config.');
  } else {
    console.log('⚠️ Mismatches found:', mismatches);

    if (modeApply) {
      await patchProjectSettings();
      console.log('✅ Project settings updated via API.');
    } else if (modeCheck) {
      console.log('ℹ️ Run with --apply to enforce these settings.');
    }
  }

  const refreshed = await api(`/v9/projects/${projectId}`);
  const domains = (refreshed.domains || []).map((d) => (typeof d === 'string' ? d : d?.name)).filter(Boolean);
  const mustHaveDomains = ['mmc-mms.com', 'www.mmc-mms.com'];
  const missingDomains = mustHaveDomains.filter((d) => !domains.includes(d));
  if (missingDomains.length > 0) {
    throw new Error(`Missing required domain attachments: ${missingDomains.join(', ')}`);
  }
  console.log('✅ Domains attached:', domains.join(', '));

  if (modeRedeploy) {
    const deployment = await triggerProductionDeploy(refreshed);
    console.log(`🚀 Production deployment triggered: ${deployment.id}`);
    if (modeWait) {
      const ready = await waitForDeploymentReady(deployment.id);
      console.log(`✅ Deployment READY: ${ready.url}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  });
}
