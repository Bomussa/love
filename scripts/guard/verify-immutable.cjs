#!/usr/bin/env node

/**
 * Immutable File Guard
 * - Verifies a set of critical files have not been changed
 * - Baseline hashes live in scripts/guard/immutable.hashes.json
 * - To refresh baseline, set env MMC_LOCK_CODE and run: node scripts/guard/verify-immutable.cjs update
 * - The lock code is ONLY read from env; it is NOT stored in files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const HASH_FILE = path.join(__dirname, 'immutable.hashes.json');

// Critical files to lock (relative to love/)
const CRITICAL = [
  'src/lib/api-base.js',
  'src/core/event-bus.js',
  'src/lib/api.js',
  'vite.config.js',
  'vercel.json'
];

function abs(p) { return path.join(ROOT, p); }
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function readFileHash(relativePath) {
  const full = abs(relativePath);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${relativePath}`);
  const buf = fs.readFileSync(full);
  return sha256(buf);
}

function loadBaseline() {
  if (!fs.existsSync(HASH_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(HASH_FILE, 'utf8')); } catch { return null; }
}

function writeBaseline(map) {
  fs.writeFileSync(HASH_FILE, JSON.stringify(map, null, 2));
}

function verify() {
  const baseline = loadBaseline();
  if (!baseline) {
    console.error('❌ Immutable baseline missing. Ask maintainer to initialize it.');
    process.exit(2);
  }
  let ok = true;
  for (const rel of CRITICAL) {
    try {
      const current = readFileHash(rel);
      const expected = baseline[rel];
      if (!expected) {
        console.error(`❌ No baseline for ${rel}`);
        ok = false;
      } else if (current !== expected) {
        console.error(`❌ Hash mismatch: ${rel}`);
        ok = false;
      } else {
        console.log(`✅ ${rel}`);
      }
    } catch (e) {
      console.error(`❌ ${rel}: ${e.message}`);
      ok = false;
    }
  }
  if (!ok) {
    console.error('❌ Critical files have changed or baseline missing.');
    process.exit(1);
  }
  console.log('🎉 Immutable verification passed.');
}

function updateBaseline() {
  const code = process.env.MMC_LOCK_CODE;
  if (!code || String(code).trim().length === 0) {
    console.error('❌ MMC_LOCK_CODE is required to update baseline.');
    process.exit(3);
  }
  const map = {};
  for (const rel of CRITICAL) {
    map[rel] = readFileHash(rel);
  }
  writeBaseline(map);
  console.log('🔐 Baseline updated for critical files.');
}

const mode = (process.argv[2] || 'verify').toLowerCase();
if (mode === 'verify') verify();
else if (mode === 'update') updateBaseline();
else {
  console.error('Usage: node scripts/guard/verify-immutable.cjs [verify|update]');
  process.exit(4);
}
