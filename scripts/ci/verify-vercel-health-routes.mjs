#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const vercelPath = path.resolve(rootDir, 'vercel.json');
const frontendHealthFile = path.resolve(rootDir, 'frontend/public/.well-known/healthz.json');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(vercelPath)) {
  fail('vercel.json not found at repository root.');
}

if (!fs.existsSync(frontendHealthFile)) {
  fail('Missing frontend/public/.well-known/healthz.json required by /api health rewrites.');
}

const healthRaw = fs.readFileSync(frontendHealthFile, 'utf8');
let healthPayload;
try {
  healthPayload = JSON.parse(healthRaw);
} catch (error) {
  fail(`frontend/public/.well-known/healthz.json is invalid JSON: ${error.message}`);
}

if (healthPayload.ok !== true) {
  fail('frontend/public/.well-known/healthz.json must contain {"ok": true}.');
}

const raw = fs.readFileSync(vercelPath, 'utf8');
let config;
try {
  config = JSON.parse(raw);
} catch (error) {
  fail(`vercel.json is not valid JSON: ${error.message}`);
}

const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
if (rewrites.length === 0) {
  fail('vercel.json has no rewrites array.');
}

const findIndexBySource = (source) => rewrites.findIndex((item) => item?.source === source);

const indexApiHealth = findIndexBySource('/api/health');
const indexApiV1Status = findIndexBySource('/api/v1/status');
const indexApiWildcard = findIndexBySource('/api/(.*)');

if (indexApiHealth < 0) {
  fail('Missing rewrite for /api/health.');
}
if (indexApiV1Status < 0) {
  fail('Missing rewrite for /api/v1/status.');
}
if (indexApiWildcard < 0) {
  fail('Missing generic /api/(.*) rewrite.');
}

const apiHealthRewrite = rewrites[indexApiHealth];
const apiV1StatusRewrite = rewrites[indexApiV1Status];

if (apiHealthRewrite.destination !== '/.well-known/healthz.json') {
  fail('Rewrite /api/health must point to /.well-known/healthz.json.');
}

if (apiV1StatusRewrite.destination !== '/.well-known/healthz.json') {
  fail('Rewrite /api/v1/status must point to /.well-known/healthz.json.');
}

if (!(indexApiHealth < indexApiWildcard)) {
  fail('/api/health rewrite must appear before /api/(.*).');
}

if (!(indexApiV1Status < indexApiWildcard)) {
  fail('/api/v1/status rewrite must appear before /api/(.*).');
}

console.log('✅ Vercel health route rewrites and static health payload are configured correctly.');
