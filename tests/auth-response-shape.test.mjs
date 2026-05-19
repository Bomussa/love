import assert from 'node:assert/strict'

function isUnifiedAuthResponse(res) {
  return typeof res === 'object'
    && typeof res.success === 'boolean'
    && 'data' in res
    && 'role' in res
    && 'error' in res
}

const ok = { success: true, data: { id: '1' }, role: 'ADMIN', error: null }
const badCreds = { success: false, data: null, role: null, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }
const rpcError = { success: false, data: null, role: null, error: { code: 'AUTH_RPC_ERROR', message: 'timeout' } }

assert.equal(isUnifiedAuthResponse(ok), true)
assert.equal(isUnifiedAuthResponse(badCreds), true)
assert.equal(isUnifiedAuthResponse(rpcError), true)
assert.equal(ok.error, null)
assert.equal(badCreds.error.code, 'INVALID_CREDENTIALS')
assert.equal(rpcError.error.code, 'AUTH_RPC_ERROR')

console.log('auth-response-shape: all checks passed')
