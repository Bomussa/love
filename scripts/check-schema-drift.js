#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const BASELINE_MIGRATION = '202603100001_unify_queues_schema.sql';
const files = fs.readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => /^\d/.test(f))
  .filter((f) => f >= BASELINE_MIGRATION);

const createTableRegex = /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?queues\s*\(([^;]+)\)/gims;

function normalize(def) {
  return def
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .trim()
    .toLowerCase();
}

const defs = [];
for (const file of files) {
  const fullPath = path.join(migrationsDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  for (const match of content.matchAll(createTableRegex)) {
    defs.push({ file, signature: normalize(match[1]) });
  }
}

if (defs.length <= 1) {
  console.log('schema-drift: no duplicate CREATE TABLE public.queues definitions found.');
  process.exit(0);
}

const grouped = new Map();
for (const d of defs) {
  if (!grouped.has(d.signature)) grouped.set(d.signature, []);
  grouped.get(d.signature).push(d.file);
}

if (grouped.size > 1) {
  console.error('schema-drift: conflicting CREATE TABLE public.queues definitions detected:');
  for (const [_, filesWithSig] of grouped) {
    console.error(` - ${filesWithSig.join(', ')}`);
  }
  process.exit(1);
}

console.log('schema-drift: duplicate queue table definitions are consistent.');
