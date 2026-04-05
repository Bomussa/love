const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`❌ FAIL: ${name} -> ${error.message}`);
  }
}

function normalizeNumerals(input = '') {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
  return String(input)
    .split('')
    .map((ch) => {
      const idxArabic = arabicIndic.indexOf(ch);
      if (idxArabic >= 0) return String(idxArabic);
      const idxEastern = easternArabic.indexOf(ch);
      if (idxEastern >= 0) return String(idxEastern);
      return ch;
    })
    .join('');
}

function withApiPrefix(base, endpoint) {
  const API_VERSION = '/api/v1';
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedEndpoint = String(endpoint || '').startsWith('/') ? endpoint : `/${endpoint}`;
  if (normalizedEndpoint.startsWith(API_VERSION)) return `${normalizedBase}${normalizedEndpoint}`;
  return `${normalizedBase}${API_VERSION}${normalizedEndpoint}`;
}

class EventBus {
  constructor() { this.listeners = new Map(); }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event).delete(cb);
  }
  emit(event, payload) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }
}

test('normalizeNumerals converts Arabic-Indic digits', () => {
  assert.equal(normalizeNumerals('١٢٣٤٥'), '12345');
});

test('normalizeNumerals converts Eastern Arabic digits', () => {
  assert.equal(normalizeNumerals('۱۲۳۴۵'), '12345');
});

test('normalizeNumerals keeps latin text and normalizes mixed numerals', () => {
  assert.equal(normalizeNumerals('ID-١2۳-AB'), 'ID-123-AB');
});

test('withApiPrefix does not duplicate /api/v1', () => {
  assert.equal(withApiPrefix('https://x.com', '/api/v1/queue/create'), 'https://x.com/api/v1/queue/create');
});

test('withApiPrefix prefixes endpoint when missing version', () => {
  assert.equal(withApiPrefix('https://x.com/', '/queue/create'), 'https://x.com/api/v1/queue/create');
});

test('event bus emits queue near turn and your turn events', () => {
  const bus = new EventBus();
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
