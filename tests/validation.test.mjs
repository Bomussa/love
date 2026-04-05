import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNumerals, validateMilitaryId } from '../src/lib/validation.js';

test('normalizeNumerals converts Arabic-Indic and Persian digits', () => {
  assert.equal(normalizeNumerals('١٢٣٤۵۶'), '123456');
});

test('validateMilitaryId accepts normalized Arabic numerals', () => {
  const result = validateMilitaryId('١٢٣٤٥');
  assert.equal(result.isValid, true);
  assert.equal(result.normalized, '12345');
});
