import assert from 'node:assert/strict'
import { apiRequest, toFunctionName } from '../src/lib/api-base.js'

const originalFetch = global.fetch

// --- toFunctionName
assert.equal(toFunctionName('/patient/login'), 'patient-login')
assert.equal(toFunctionName('api/v1/pin/verify'), 'pin-verify')
assert.equal(toFunctionName('queue/next'), 'queue-next')

// mock fetch to capture url & headers
global.fetch = async (url, opts={}) => {
  return new Response(JSON.stringify({ url, headers: opts.headers }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

// A) via Vercel proxy
process.env.VITE_API_BASE_URL = 'https://site.tld/api/v1'
let res = await apiRequest('/patient/login', { method: 'POST', body: { a: 1 } })
assert.equal(res.url, 'https://site.tld/api/v1/patient-login')
assert.ok(!res.headers?.Authorization)

// B) direct to Supabase
process.env.VITE_API_BASE_URL = 'https://proj.supabase.co/functions/v1'
process.env.VITE_SUPABASE_ANON_KEY = 'testanon'
res = await apiRequest('queue/next', { method: 'POST' })
assert.equal(res.url, 'https://proj.supabase.co/functions/v1/queue-next')
assert.equal(res.headers.Authorization, 'Bearer testanon')
assert.equal(res.headers.apikey, 'testanon')

// restore
global.fetch = originalFetch
console.log('SMOKE PASS')
