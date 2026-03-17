import { describe, it, expect } from 'vitest';
import { normalizeDigits, validateMilitaryId, sanitizeInput, validatePin } from './validation';

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


describe('pin validation flow', () => {
  it('accepts 2-digit pin and rejects non-2-digit values', () => {
    expect(validatePin('12')).toEqual({ isValid: true });
    expect(validatePin('1')).toEqual({ isValid: false, error: 'رقم PIN يجب أن يكون رقمين' });
    expect(validatePin('123')).toEqual({ isValid: false, error: 'رقم PIN يجب أن يكون رقمين' });
  });
});
