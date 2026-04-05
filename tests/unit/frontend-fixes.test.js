const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`❌ FAIL: ${name} -> ${error.message}`);
  }
}

function withApiPrefix(base, endpoint) {
  const API_VERSION = '/api/v1';
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedEndpoint = String(endpoint || '').startsWith('/') ? endpoint : `/${endpoint}`;
  if (normalizedEndpoint.startsWith(API_VERSION)) return `${normalizedBase}${normalizedEndpoint}`;
  return `${normalizedBase}${API_VERSION}${normalizedEndpoint}`;
}

(async () => {
  const validation = await import(pathToFileURL(path.resolve(process.cwd(), 'frontend/src/lib/validation.js')).href);
  const eventBusModule = await import(pathToFileURL(path.resolve(process.cwd(), 'frontend/src/core/event-bus.js')).href);

  await test('normalizeNumerals converts Arabic-Indic digits', () => {
    assert.equal(validation.normalizeNumerals('١٢٣٤٥'), '12345');
  });

  await test('normalizeNumerals converts Eastern Arabic digits', () => {
    assert.equal(validation.normalizeNumerals('۱۲۳۴۵'), '12345');
  });

  await test('validateMilitaryId accepts Arabic-Indic input after normalization', () => {
    const result = validation.validateMilitaryId('١٢٣٤');
    assert.equal(result.isValid, true);
  });

  await test('withApiPrefix does not duplicate /api/v1', () => {
    assert.equal(withApiPrefix('https://x.com', '/api/v1/queue/create'), 'https://x.com/api/v1/queue/create');
  });

  await test('withApiPrefix prefixes endpoint when missing version', () => {
    assert.equal(withApiPrefix('https://x.com/', '/queue/create'), 'https://x.com/api/v1/queue/create');
  });

  await test('event bus emits queue near turn and your turn events', () => {
    const bus = new eventBusModule.EventBus();
    let near = 0;
    let your = 0;
    bus.on('queue:near_turn', () => { near += 1; });
    bus.on('queue:your_turn', () => { your += 1; });
    bus.emit('queue:near_turn', { position: 2 });
    bus.emit('queue:your_turn', { position: 0 });
    assert.equal(near, 1);
    assert.equal(your, 1);
  });

  console.log(`\nTotal: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
})();
