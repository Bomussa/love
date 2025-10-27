#!/usr/bin/env node
/**
 * Replay Failed Requests Script
 * 
 * Replays requests from a CSV/JSONL input file to the production API
 * using a normal session cookie (no API keys required).
 * 
 * Usage:
 *   COOKIE="session=xyz..." node scripts/ops/replay-requests.cjs input.jsonl
 *   COOKIE="session=xyz..." THROTTLE=500 node scripts/ops/replay-requests.cjs input.csv
 * 
 * Environment Variables:
 *   COOKIE        - Required. Session cookie for authentication (e.g., "session=abc123")
 *   BASE_URL      - API base URL (default: https://mmc-mms.com/api/v1)
 *   THROTTLE      - Delay in ms between requests (default: 300)
 *   DRY_RUN       - Set to "true" to preview without sending (default: false)
 * 
 * Input Format (JSONL):
 *   {"method":"POST","endpoint":"/queue/enter","body":{"clinic":"lab","user":"P001"}}
 *   {"method":"POST","endpoint":"/queue/done","body":{"clinic":"lab","user":"P001","pin":"1234"}}
 * 
 * Input Format (CSV):
 *   method,endpoint,body
 *   POST,/queue/enter,"{""clinic"":""lab"",""user"":""P001""}"
 *   POST,/queue/done,"{""clinic"":""lab"",""user"":""P001"",""pin"":""1234""}"
 */

const fs = require('fs');
const path = require('path');
const { setTimeout: sleep } = require('timers/promises');

// Configuration
const CONFIG = {
  baseUrl: (process.env.BASE_URL || 'https://mmc-mms.com/api/v1').replace(/\/$/, ''),
  cookie: process.env.COOKIE || '',
  throttle: parseInt(process.env.THROTTLE || '300', 10),
  dryRun: process.env.DRY_RUN === 'true',
  timeout: parseInt(process.env.TIMEOUT || '10000', 10)
};

// Idempotency key generation (same as client-side)
function normalizeEndpoint(endpoint) {
  const path = String(endpoint || '').trim();
  const cleanPath = path.split('?')[0].split('#')[0];
  return cleanPath.replace(/^\/+|\/+$/g, '').toLowerCase();
}

function stableStringify(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => `"${key}":${stableStringify(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

function simpleHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function generateIdempotencyKey(method, endpoint, body) {
  const normalizedMethod = String(method || 'POST').toUpperCase();
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  
  let bodyObj = body;
  if (typeof body === 'string') {
    try {
      bodyObj = JSON.parse(body);
    } catch (e) {
      bodyObj = body;
    }
  }
  
  const bodyStr = stableStringify(bodyObj);
  const combined = `${normalizedMethod}:${normalizedEndpoint}:${bodyStr}`;
  const hash = simpleHash(combined);
  
  return `${normalizedMethod.toLowerCase()}_${hash}`;
}

// Parse input file
function parseInput(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.jsonl' || ext === '.ndjson') {
    // JSONL format
    return content
      .split('\n')
      .filter(line => line.trim())
      .map((line, idx) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error(`⚠️  Parse error at line ${idx + 1}: ${e.message}`);
          return null;
        }
      })
      .filter(Boolean);
  } else if (ext === '.csv') {
    // CSV format
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map((line, idx) => {
      try {
        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        const obj = {};
        headers.forEach((header, i) => {
          let val = values[i] || '';
          val = val.replace(/^"(.*)"$/, '$1'); // Remove quotes
          obj[header] = val;
        });
        
        // Parse body if it's a JSON string
        if (obj.body && typeof obj.body === 'string') {
          try {
            obj.body = JSON.parse(obj.body);
          } catch (e) {
            // Keep as string
          }
        }
        
        return obj;
      } catch (e) {
        console.error(`⚠️  Parse error at line ${idx + 2}: ${e.message}`);
        return null;
      }
    }).filter(Boolean);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .jsonl or .csv`);
  }
}

// Make request
async function makeRequest(request) {
  const { method, endpoint, body, idempotencyKey: providedKey } = request;
  
  // Generate idempotency key if not provided
  const idempotencyKey = providedKey || generateIdempotencyKey(method, endpoint, body);
  
  const url = `${CONFIG.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': CONFIG.cookie,
    'X-Idempotency-Key': idempotencyKey
  };
  
  const options = {
    method: method.toUpperCase(),
    headers,
    ...(body && { body: typeof body === 'string' ? body : JSON.stringify(body) })
  };
  
  if (CONFIG.dryRun) {
    return {
      success: true,
      dryRun: true,
      request: { method, endpoint, idempotencyKey }
    };
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { raw: text };
    }
    
    return {
      success: response.ok,
      status: response.status,
      data,
      idempotencyKey
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: error.message,
      idempotencyKey
    };
  }
}

// Main execution
async function main() {
  console.log('🔄 Replay Failed Requests Script\n');
  
  // Validate inputs
  if (!CONFIG.cookie) {
    console.error('❌ Error: COOKIE environment variable is required');
    console.error('   Example: COOKIE="session=abc123" node scripts/ops/replay-requests.js input.jsonl');
    process.exit(1);
  }
  
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('❌ Error: Input file path is required');
    console.error('   Usage: node scripts/ops/replay-requests.js <input-file>');
    process.exit(1);
  }
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: File not found: ${inputFile}`);
    process.exit(1);
  }
  
  // Parse input
  console.log(`📂 Reading input file: ${inputFile}`);
  const requests = parseInput(inputFile);
  console.log(`📊 Loaded ${requests.length} request(s)\n`);
  
  if (requests.length === 0) {
    console.log('⚠️  No requests to process');
    process.exit(0);
  }
  
  // Display configuration
  console.log('⚙️  Configuration:');
  console.log(`   Base URL: ${CONFIG.baseUrl}`);
  console.log(`   Throttle: ${CONFIG.throttle}ms`);
  console.log(`   Dry Run: ${CONFIG.dryRun}`);
  console.log(`   Timeout: ${CONFIG.timeout}ms\n`);
  
  if (CONFIG.dryRun) {
    console.log('🔍 DRY RUN MODE - No requests will be sent\n');
  }
  
  // Process requests
  const results = {
    total: requests.length,
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const num = i + 1;
    
    console.log(`[${num}/${requests.length}] ${req.method} ${req.endpoint}`);
    
    try {
      const result = await makeRequest(req);
      
      if (result.success) {
        results.success++;
        const msg = result.dryRun ? '(dry run)' : `→ ${result.status}`;
        console.log(`  ✅ Success ${msg}`);
      } else {
        results.failed++;
        results.errors.push({
          request: req,
          error: result.error || `HTTP ${result.status}`,
          data: result.data
        });
        console.log(`  ❌ Failed: ${result.error || `HTTP ${result.status}`}`);
      }
      
      // Throttle
      if (i < requests.length - 1 && CONFIG.throttle > 0) {
        await sleep(CONFIG.throttle);
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        request: req,
        error: error.message
      });
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary Report');
  console.log('='.repeat(50));
  console.log(`Total requests: ${results.total}`);
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Failed Requests:');
    results.errors.forEach((err, idx) => {
      console.log(`\n${idx + 1}. ${err.request.method} ${err.request.endpoint}`);
      console.log(`   Error: ${err.error}`);
      if (err.data) {
        console.log(`   Data: ${JSON.stringify(err.data)}`);
      }
    });
  }
  
  console.log('\n✅ Replay completed');
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
