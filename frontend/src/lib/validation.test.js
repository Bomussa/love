import { describe, it, expect } from 'vitest';
import { normalizeDigits, validateMilitaryId, sanitizeInput } from './validation';

describe('normalizeDigits', () => {
  it('converts Arabic and Persian digits to English digits', () => {
    expect(normalizeDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
    expect(normalizeDigits('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
    expect(normalizeDigits('ID-١٢۳')).toBe('ID-123');
  });
});

describe('military id validation flow', () => {
  it('accepts normalized and sanitized military ids', () => {
    const normalized = normalizeDigits('  ١٢٣٤  ');
    const sanitized = sanitizeInput(normalized);

    expect(validateMilitaryId(sanitized)).toEqual({ isValid: true });
  });
});
