#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT, 'supabase/functions');
const API_FILES = ['api/v1.js', 'lib/api-handlers.js'];

const REQUIRED_EDGE_FUNCTIONS = [
  'admin-login',
  'admin-session-verify',
  'api-management',
  'api-router',
  'api-v1-status',
  'call-next-patient',
  'data-verification',
  'db-check',
  'db-policies-manager',
  'db-tables-manager',
  'events-stream',
  'functions-proxy',
  'generate-pins-cron',
  'guaranteed-api',
  'healthz',
  'issue-pin',
  'login',
  'patient-login',
  'pin-generate',
  'pin-status',
  'pin-verify',
  'queue-call',
  'queue-engine',
  'queue-enter',
  'queue-status',
  'reports-daily',
  'stats-dashboard',
];

const REQUIRED_ROUTES = [
  '/api/v1/health',
  '/api/v1/admin/login',
  '/api/v1/admins',
  '/api/v1/status',
  '/api/v1/patient/login',
  '/api/v1/queue/enter',
  '/api/v1/queue/status',
  '/api/v1/queue/call',
  '/api/v1/pin/verify',
  '/api/v1/qa/deep_run',
];

function readRoutesFromFile(filePath) {
  const content = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  const routes = new Set();

  for (const match of content.matchAll(/pathname\s*(?:===|!==)\s*['"]([^'"]+)['"]/g)) {
    routes.add(match[1]);
  }

  for (const match of content.matchAll(/pathname\.startsWith\(\s*['"]([^'"]+)['"]/g)) {
    routes.add(match[1]);
  }

  return routes;
}

function getEdgeFunctionNames() {
  const entries = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .filter((entry) => fs.existsSync(path.join(FUNCTIONS_DIR, entry.name, 'index.ts')))
    .map((entry) => entry.name)
    .sort();
}

const edgeFunctions = getEdgeFunctionNames();
const missingFunctions = REQUIRED_EDGE_FUNCTIONS.filter((name) => !edgeFunctions.includes(name));
const unexpectedFunctions = edgeFunctions.filter((name) => !REQUIRED_EDGE_FUNCTIONS.includes(name));

const allRoutes = new Set();
for (const file of API_FILES) {
  for (const route of readRoutesFromFile(file)) {
    allRoutes.add(route);
  }
}

const missingRoutes = REQUIRED_ROUTES.filter((route) => !allRoutes.has(route));

if (missingFunctions.length || unexpectedFunctions.length || missingRoutes.length) {
  console.error('Endpoint contract check failed.');
  if (missingFunctions.length) console.error(`Missing edge functions: ${missingFunctions.join(', ')}`);
  if (unexpectedFunctions.length) console.error(`Unexpected edge functions: ${unexpectedFunctions.join(', ')}`);
  if (missingRoutes.length) console.error(`Missing API routes: ${missingRoutes.join(', ')}`);
  process.exit(1);
}

console.log(`Edge functions (${edgeFunctions.length}): ${edgeFunctions.join(', ')}`);
console.log(`API route literals (${allRoutes.size}): ${[...allRoutes].sort().join(', ')}`);
console.log('Endpoint contract check passed.');
