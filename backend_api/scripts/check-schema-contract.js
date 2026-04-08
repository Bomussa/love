#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SNAPSHOT_FILE = path.join(ROOT, 'artifacts/schema_snapshot.json');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase/migrations');

const REQUIRED_TABLES = ['clinics', 'pins', 'patients', 'queues', 'events', 'activity_logs', 'settings'];
const REQUIRED_MIGRATIONS = [
  '20260316090000_canonicalize_queues.sql',
  '20260316090000_unify_pins_contract.sql',
  '20260316100000_queue_status_lifecycle_enforcement.sql',
];

if (!fs.existsSync(SNAPSHOT_FILE)) {
  console.error(`Missing schema snapshot: ${SNAPSHOT_FILE}`);
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
const tableMap = snapshot.tables || {};
const tableNames = Object.keys(tableMap);

const missingTables = REQUIRED_TABLES.filter((table) => !tableNames.includes(table));
const missingMigrations = REQUIRED_MIGRATIONS.filter((file) => !fs.existsSync(path.join(MIGRATIONS_DIR, file)));

if (missingTables.length || missingMigrations.length) {
  console.error('Schema contract check failed.');
  if (missingTables.length) console.error(`Missing tables in snapshot: ${missingTables.join(', ')}`);
  if (missingMigrations.length) console.error(`Missing required migrations: ${missingMigrations.join(', ')}`);
  process.exit(1);
}

console.log(`Schema snapshot tables (${tableNames.length}) include required contract tables.`);
console.log(`Required migrations present: ${REQUIRED_MIGRATIONS.join(', ')}`);
console.log('Schema contract check passed.');
