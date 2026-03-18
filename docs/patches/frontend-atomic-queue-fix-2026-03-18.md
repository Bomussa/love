# Frontend atomic queue safety patch — 2026-03-18

## Status
This file records the exact frontend patch that should be applied next.
I could create the branch and PR, but I could not deploy or monitor Vercel from this environment because no Vercel connector/API is available here.

## Confirmed target file
- `frontend/src/lib/api-unified.js`

## Required changes

### 1) Add normalization and safety helpers after `resolveApiV1Base()`
```js
function normalizePatientId(rawPatientId) {
  return String(rawPatientId ?? '').trim();
}

function normalizeGender(rawGender) {
  return rawGender === 'female' ? 'female' : 'male';
}

function isUnsafeQueueFallbackEnabled() {
  return String(import.meta?.env?.VITE_ALLOW_UNSAFE_QUEUE_FALLBACK || '').toLowerCase() === 'true';
}

function generateTwoDigitPin() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    return String(10 + (bytes[0] % 90)).padStart(2, '0');
  }

  return String(Math.floor(10 + Math.random() * 90)).padStart(2, '0');
}
```

### 2) Replace `patientLogin()` with the normalized version
```js
async patientLogin(patientId, gender) {
  try {
    const normalizedPatientId = normalizePatientId(patientId);
    if (!normalizedPatientId) {
      return { success: false, error: 'PATIENT_ID_REQUIRED' };
    }

    const normalizedGender = normalizeGender(gender);
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('patient_id', normalizedPatientId)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: newUser, error: createError } = await supabase
        .from('patients')
        .insert([{ patient_id: normalizedPatientId, gender: normalizedGender, status: 'active' }])
        .select()
        .single();

      if (createError) throw createError;
      return { success: true, data: newUser };
    }

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Login Error:', error);
    return { success: false, error: error.message };
  }
}
```

### 3) Change `enterQueue()` RPC failure behavior to fail safe by default
Replace the empty RPC fallback block with:
```js
// في حال فشل RPC، نستخدم الطريقة البديلة فقط إذا تم تفعيلها صراحة.
if (rpcError && !isUnsafeQueueFallbackEnabled()) {
  return {
    success: false,
    error: 'ATOMIC_QUEUE_RPC_UNAVAILABLE',
    details: rpcError.message,
  };
}
```

Also add explicit handling for `existingError` and `lastEntryError` before continuing with client-side fallback.

### 4) Replace insecure PIN generation call sites
Replace:
```js
Math.floor(10 + Math.random() * 90).toString()
```
with:
```js
generateTwoDigitPin()
```
in both:
- `generatePIN(clinicId)`
- `issuePin(clinicId)`

## Required new test file
Create `frontend/src/lib/api-unified-safety-contract.test.js`:
```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function read(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('api-unified safety contracts', () => {
  it('normalizes and validates patient identifiers before persistence', () => {
    const apiUnified = read('src/lib/api-unified.js');

    expect(apiUnified).toContain('function normalizePatientId');
    expect(apiUnified).toContain("return { success: false, error: 'PATIENT_ID_REQUIRED' }");
    expect(apiUnified).toContain(".eq('patient_id', normalizedPatientId)");
    expect(apiUnified).toContain("patient_id: normalizedPatientId");
  });

  it('disables unsafe queue number fallback by default when atomic RPC is unavailable', () => {
    const apiUnified = read('src/lib/api-unified.js');

    expect(apiUnified).toContain('function isUnsafeQueueFallbackEnabled');
    expect(apiUnified).toContain('VITE_ALLOW_UNSAFE_QUEUE_FALLBACK');
    expect(apiUnified).toContain("error: 'ATOMIC_QUEUE_RPC_UNAVAILABLE'");
  });

  it('uses cryptographically secure PIN generation when available', () => {
    const apiUnified = read('src/lib/api-unified.js');

    expect(apiUnified).toContain('function generateTwoDigitPin');
    expect(apiUnified).toContain('crypto.getRandomValues');
  });
});
```

## Merge gate
Do not merge until all are confirmed:
1. `npm test --workspace frontend` passes
2. the queue entry flow no longer allocates numbers client-side by default after RPC failure
3. patient login still succeeds for existing IDs after trimming whitespace
4. Vercel build succeeds on the resulting commit
