import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const EXPECTED_NODE_VERSION = '20';
const EXPECTED_BUILD_COMMAND = 'cd frontend && npm install && npm run build';
const EXPECTED_OUTPUT_DIRECTORY = 'frontend/dist';
const EXPECTED_API_REWRITE_DESTINATION = 'https://love-api-bomussa.vercel.app/api/$1';

function readVercelConfig() {
  return JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
}

test('critical frontend files exist', () => {
  const requiredFiles = [
    'frontend/src/lib/api-unified.js',
    'frontend/src/lib/supabase-client.js',
    'frontend/src/lib/api-contract.js',
    'vercel.json',
  ];

  requiredFiles.forEach((path) => {
    assert.equal(fs.existsSync(path), true, `Missing required file: ${path}`);
  });
});

test('node version files are pinned to Node 20', () => {
  const nvmrc = fs.readFileSync('.nvmrc', 'utf8').trim();
  const nodeVersion = fs.readFileSync('.node-version', 'utf8').trim();

  assert.equal(
    nvmrc,
    EXPECTED_NODE_VERSION,
    `Unexpected .nvmrc value. Expected "${EXPECTED_NODE_VERSION}" but found "${nvmrc}". Update .nvmrc back to ${EXPECTED_NODE_VERSION}.`,
  );
  assert.equal(
    nodeVersion,
    EXPECTED_NODE_VERSION,
    `Unexpected .node-version value. Expected "${EXPECTED_NODE_VERSION}" but found "${nodeVersion}". Update .node-version back to ${EXPECTED_NODE_VERSION}.`,
  );
});

test('vercel build settings remain aligned with frontend build contract', () => {
  const config = readVercelConfig();

  assert.equal(
    config.buildCommand,
    EXPECTED_BUILD_COMMAND,
    `Unexpected vercel.json buildCommand. Expected "${EXPECTED_BUILD_COMMAND}" but found "${config.buildCommand}". Revert buildCommand to the agreed frontend build command.`,
  );

  assert.equal(
    config.outputDirectory,
    EXPECTED_OUTPUT_DIRECTORY,
    `Unexpected vercel.json outputDirectory. Expected "${EXPECTED_OUTPUT_DIRECTORY}" but found "${config.outputDirectory}". Revert outputDirectory to the agreed frontend dist path.`,
  );
});

test('vercel invariant: do not combine "cd frontend" buildCommand with rootDirectory=frontend', () => {
  const config = readVercelConfig();
  const buildCommand = String(config.buildCommand || '');
  const rootDirectory = config.rootDirectory;

  if (buildCommand.includes('cd frontend')) {
    assert.notEqual(
      rootDirectory,
      'frontend',
      'Invalid vercel.json invariant: buildCommand already changes directory with "cd frontend", so rootDirectory must NOT be "frontend". Remove rootDirectory or set it to project root.',
    );
  }
});

test('vercel config keeps api rewrite and www redirect', () => {
  const config = readVercelConfig();
  const apiRewrite = Array.isArray(config.rewrites)
    ? config.rewrites.find((entry) => entry.source === '/api/(.*)')
    : undefined;
  const hasWwwRedirect = Array.isArray(config.redirects)
    && config.redirects.some((entry) => {
      const destination = String(entry.destination || '').trim();
      if (!destination) {
        return false;
      }
      try {
        const url = new URL(destination);
        return url.protocol === 'https:' && url.hostname === 'mmc-mms.com';
      } catch {
        return false;
      }
    });

  assert.ok(
    apiRewrite,
    'Missing /api/(.*) rewrite in vercel.json. Add rewrite: { "source": "/api/(.*)", "destination": "https://love-api-bomussa.vercel.app/api/$1" }.',
  );

  assert.equal(
    apiRewrite?.destination,
    EXPECTED_API_REWRITE_DESTINATION,
    `Unexpected /api/(.*) rewrite destination. Expected "${EXPECTED_API_REWRITE_DESTINATION}" but found "${apiRewrite?.destination}". Point it back to the current backend target.`,
  );

  assert.equal(hasWwwRedirect, true, 'Missing www to apex redirect');
});
