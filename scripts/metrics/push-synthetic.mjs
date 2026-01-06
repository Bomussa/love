#!/usr/bin/env node
/**
 * Push Synthetic Metrics to Prometheus Pushgateway (Add-only)
 * 
 * Generates synthetic traffic by calling healthz endpoints and
 * pushes metrics to Pushgateway in Prometheus format.
 * 
 * Usage:
 *   ORIGIN=https://example.com PUSHGATEWAY=http://localhost:9091 node scripts/metrics/push-synthetic.mjs
 *   
 * Environment:
 *   ORIGIN - Base URL to test (default: http://localhost:3000)
 *   PUSHGATEWAY - Pushgateway URL (default: http://localhost:9091)
 *   REQUESTS - Number of requests to generate (default: 100)
 *   ERROR_RATE - Simulated 5xx error rate 0-1 (default: 0.03 = 3%)
 */

import https from 'https';
import http from 'http';

const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';
const PUSHGATEWAY = process.env.PUSHGATEWAY || 'http://localhost:9091';
const REQUESTS = parseInt(process.env.REQUESTS || '100', 10);
const SIMULATED_ERROR_RATE = parseFloat(process.env.ERROR_RATE || '0.03');

/**
 * Fetch URL and return status code
 */
async function fetchStatus(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const timeout = 5000;

    const req = client.get(url, { timeout }, (res) => {
      res.on('data', () => {}); // Consume data
      res.on('end', () => resolve(res.statusCode));
    });

    req.on('error', (err) => {
      console.error(`[Error] ${url}:`, err.message);
      resolve(503); // Treat errors as 5xx
    });

    req.on('timeout', () => {
      req.destroy();
      console.error(`[Timeout] ${url}`);
      resolve(504); // Gateway timeout
    });
  });
}

/**
 * Classify status code into bucket
 */
function classifyStatus(status) {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'unknown';
}

/**
 * Generate synthetic requests and collect metrics
 */
async function generateTraffic() {
  console.log(`[Traffic] Generating ${REQUESTS} requests to ${ORIGIN}`);
  console.log(`[Traffic] Simulated error rate: ${SIMULATED_ERROR_RATE * 100}%`);

  const counters = {
    '2xx': 0,
    '4xx': 0,
    '5xx': 0,
    total: 0
  };

  const healthzUrl = `${ORIGIN}/api/v1/healthz`;

  for (let i = 0; i < REQUESTS; i++) {
    // Simulate some 5xx errors based on ERROR_RATE
    let status;
    if (Math.random() < SIMULATED_ERROR_RATE) {
      // Simulate 5xx error
      status = 500;
      console.log(`[${i + 1}/${REQUESTS}] Simulated 5xx`);
    } else {
      // Make real request
      status = await fetchStatus(healthzUrl);
      console.log(`[${i + 1}/${REQUESTS}] ${healthzUrl} -> ${status}`);
    }

    const bucket = classifyStatus(status);
    counters[bucket]++;
    counters.total++;

    // Small delay to spread requests
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return counters;
}

/**
 * Push metrics to Prometheus Pushgateway
 */
async function pushMetrics(counters) {
  const job = 'synthetic_traffic';
  const instance = 'ci-runner';
  
  // Calculate error rate
  const errorRate = counters['5xx'] / counters.total;

  // Build Prometheus format metrics
  const metrics = [
    '# HELP http_requests_total Total HTTP requests by status',
    '# TYPE http_requests_total counter',
    `http_requests_total{status="2xx",job="${job}",instance="${instance}"} ${counters['2xx']}`,
    `http_requests_total{status="4xx",job="${job}",instance="${instance}"} ${counters['4xx']}`,
    `http_requests_total{status="5xx",job="${job}",instance="${instance}"} ${counters['5xx']}`,
    '',
    '# HELP error_rate_5xx Current 5xx error rate',
    '# TYPE error_rate_5xx gauge',
    `error_rate_5xx{job="${job}",instance="${instance}"} ${errorRate.toFixed(4)}`,
    ''
  ].join('\n');

  console.log('\n[Metrics] Pushing to Pushgateway:');
  console.log(metrics);

  return new Promise((resolve, reject) => {
    const url = new URL(`/metrics/job/${job}/instance/${instance}`, PUSHGATEWAY);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(metrics)
      }
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Pushgateway] ✓ Metrics pushed successfully (${res.statusCode})`);
          resolve();
        } else {
          console.error(`[Pushgateway] ✗ Failed with status ${res.statusCode}`);
          console.error(data);
          reject(new Error(`Pushgateway returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Pushgateway] Error:', err.message);
      reject(err);
    });

    req.write(metrics);
    req.end();
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Synthetic Traffic Generator');
  console.log('='.repeat(60));

  try {
    // Generate traffic
    const counters = await generateTraffic();

    console.log('\n' + '='.repeat(60));
    console.log('Traffic Summary:');
    console.log(`  Total: ${counters.total}`);
    console.log(`  2xx: ${counters['2xx']} (${(counters['2xx'] / counters.total * 100).toFixed(1)}%)`);
    console.log(`  4xx: ${counters['4xx']} (${(counters['4xx'] / counters.total * 100).toFixed(1)}%)`);
    console.log(`  5xx: ${counters['5xx']} (${(counters['5xx'] / counters.total * 100).toFixed(1)}%)`);
    console.log(`  Error Rate: ${(counters['5xx'] / counters.total * 100).toFixed(2)}%`);
    console.log('='.repeat(60) + '\n');

    // Push to Prometheus
    await pushMetrics(counters);

    console.log('\n✓ Synthetic metrics generation complete');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateTraffic, pushMetrics, fetchStatus, classifyStatus };
