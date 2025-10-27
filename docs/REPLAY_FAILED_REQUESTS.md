# Replay Failed Requests Guide

This guide explains how to safely resend failed operations without creating duplicates, using both the automatic client-side mechanism and the manual replay script.

## Table of Contents
1. [Client-Side Resync Mechanism](#client-side-resync-mechanism)
2. [Manual Replay Script](#manual-replay-script)
3. [Idempotency and Safety](#idempotency-and-safety)
4. [Troubleshooting](#troubleshooting)

## Client-Side Resync Mechanism

### How It Works

The application automatically queues failed operations (POST, PUT, PATCH, DELETE) in `localStorage` when network connectivity is lost. These operations are automatically retried when:

1. **Network connectivity is restored** - The app listens for the `online` event
2. **Page is loaded while online** - Sync runs 1 second after page load
3. **Manual trigger** - Visit the app with `?resync=1` or `#resync=1` parameter

### Automatic Protection Against Duplicates

Every mutating request (POST, PUT, PATCH, DELETE) automatically receives an **idempotency key** based on:
- HTTP method
- Normalized endpoint path
- Stable serialization of request body

This key is:
- Attached as `X-Idempotency-Key` header
- Stored with queued operations for replay
- Tracked in `localStorage` (`mms.sentKeys`) with 24-hour TTL
- Used to prevent duplicate sends from the same browser

### Manual Resync Trigger

If you need to force a resync of the offline queue:

```
https://mmc-mms.com/?resync=1
```

Or with hash:

```
https://mmc-mms.com/#resync=1
```

This will:
- Immediately call `syncOfflineQueue()` on app load
- Process all pending operations in the queue
- Apply idempotency keys to prevent duplicates
- Log results to browser console

**Use cases:**
- User reports operations not syncing
- Manual verification after connectivity issues
- Testing offline queue behavior

## Manual Replay Script

For operations that need to be replayed server-side or in bulk, use the replay script.

### Prerequisites

1. **Node.js 20+** installed
2. **Session cookie** from an authenticated browser session
3. **Input file** in JSONL or CSV format

### Getting Your Session Cookie

1. Open your browser and login to https://mmc-mms.com
2. Open DevTools (F12)
3. Go to **Application** > **Cookies** > `https://mmc-mms.com`
4. Find the session cookie (name may vary: `session`, `connect.sid`, etc.)
5. Copy the full cookie value

### Preparing Input File

#### JSONL Format (Recommended)

Create `failed-requests.jsonl`:

```jsonl
{"method":"POST","endpoint":"/queue/enter","body":{"clinic":"lab","user":"P001"}}
{"method":"POST","endpoint":"/queue/enter","body":{"clinic":"xray","user":"P002"}}
{"method":"POST","endpoint":"/queue/done","body":{"clinic":"lab","user":"P001","pin":"1234"}}
```

#### CSV Format

Create `failed-requests.csv`:

```csv
method,endpoint,body
POST,/queue/enter,"{""clinic"":""lab"",""user"":""P001""}"
POST,/queue/enter,"{""clinic"":""xray"",""user"":""P002""}"
POST,/queue/done,"{""clinic"":""lab"",""user"":""P001"",""pin"":""1234""}"
```

### Running the Script

#### Basic Usage

```bash
COOKIE="session=your-session-cookie-here" \
  node scripts/ops/replay-requests.cjs failed-requests.jsonl
```

#### With Custom Options

```bash
COOKIE="session=abc123..." \
  BASE_URL="https://mmc-mms.com/api/v1" \
  THROTTLE=500 \
  node scripts/ops/replay-requests.cjs failed-requests.jsonl
```

#### Dry Run (Preview Mode)

Test without actually sending requests:

```bash
COOKIE="session=abc123..." \
  DRY_RUN=true \
  node scripts/ops/replay-requests.cjs failed-requests.jsonl
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COOKIE` | ✅ Yes | - | Session cookie for authentication |
| `BASE_URL` | No | `https://mmc-mms.com/api/v1` | API base URL |
| `THROTTLE` | No | `300` | Delay in ms between requests |
| `DRY_RUN` | No | `false` | Preview without sending |
| `TIMEOUT` | No | `10000` | Request timeout in ms |

### Script Output

The script provides real-time progress and a summary:

```
🔄 Replay Failed Requests Script

📂 Reading input file: failed-requests.jsonl
📊 Loaded 3 request(s)

⚙️  Configuration:
   Base URL: https://mmc-mms.com/api/v1
   Throttle: 300ms
   Dry Run: false
   Timeout: 10000ms

[1/3] POST /queue/enter
  ✅ Success → 200

[2/3] POST /queue/enter
  ✅ Success → 200

[3/3] POST /queue/done
  ❌ Failed: HTTP 400

==================================================
📊 Summary Report
==================================================
Total requests: 3
✅ Success: 2
❌ Failed: 1

❌ Failed Requests:

1. POST /queue/done
   Error: HTTP 400
   Data: {"error":"Invalid PIN"}

✅ Replay completed
```

## Idempotency and Safety

### How Idempotency Keys Work

1. **Generation**: Keys are computed from:
   ```
   hash(method + normalized_endpoint + stable_json(body))
   ```

2. **Client-Side Registry**: 
   - Stored in `localStorage` under `mms.sentKeys`
   - Each entry has a 24-hour TTL
   - Prevents duplicate sends from same browser

3. **Server-Side (Backend Implementation)**:
   - Backend should validate `X-Idempotency-Key` header
   - Store processed keys with short TTL (e.g., 24-48 hours)
   - Return same response for duplicate keys

### Example Flow

```
1. User submits: POST /queue/enter {clinic: "lab", user: "P001"}
   → Generated key: post_a1b2c3d4

2. Request sent with header: X-Idempotency-Key: post_a1b2c3d4
   → Success, key stored in mms.sentKeys

3. Network drops, operation queued again
   → Same key: post_a1b2c3d4

4. Connection restored, resync attempted
   → Key found in mms.sentKeys, skipped
   → Or backend recognizes key, returns cached response
```

### Safety Guarantees

✅ **No duplicate operations** - Same request generates same key
✅ **Stateless** - No API keys or tokens required
✅ **Client-first** - Works even if backend doesn't implement idempotency
✅ **Time-bound** - Keys expire after 24 hours
✅ **Transparent** - No changes to existing API contracts

## Troubleshooting

### Client-Side Issues

#### "Operations not syncing automatically"

1. Check browser console for errors
2. Verify `mms.offlineQueue` in localStorage:
   ```javascript
   JSON.parse(localStorage.getItem('mms.offlineQueue'))
   ```
3. Manually trigger resync: `https://mmc-mms.com/?resync=1`
4. Check network connectivity

#### "Duplicate operations still created"

1. Check if backend implements idempotency validation
2. Clear sent keys registry:
   ```javascript
   localStorage.removeItem('mms.sentKeys')
   ```
3. Verify idempotency key generation in network tab

### Script Issues

#### "COOKIE environment variable is required"

Make sure you're providing the session cookie:
```bash
COOKIE="session=..." node scripts/ops/replay-requests.cjs input.jsonl
```

#### "Authentication failed" or "HTTP 401"

1. Verify cookie is still valid (not expired)
2. Get fresh cookie from browser
3. Check cookie format matches backend expectations

#### "Parse error at line X"

1. Validate JSON syntax in input file
2. For CSV, ensure proper quoting of JSON bodies
3. Try JSONL format instead

#### "Request timeout"

Increase timeout:
```bash
TIMEOUT=30000 COOKIE="..." node scripts/ops/replay-requests.cjs input.jsonl
```

### Monitoring

#### Check Queued Operations

```javascript
// In browser console
const queue = JSON.parse(localStorage.getItem('mms.offlineQueue') || '[]');
console.log('Queued operations:', queue.length);
console.log(queue);
```

#### Check Sent Keys

```javascript
// In browser console
const sentKeys = JSON.parse(localStorage.getItem('mms.sentKeys') || '{}');
console.log('Sent keys:', Object.keys(sentKeys).length);
console.log(sentKeys);
```

#### Force Clear and Resync

```javascript
// In browser console
localStorage.removeItem('mms.sentKeys');
// Then visit: https://mmc-mms.com/?resync=1
```

## Best Practices

1. **Monitor offline queue size** - Large queues may indicate connectivity issues
2. **Regular testing** - Test offline mode and resync in staging
3. **Log analysis** - Review browser console logs for sync failures
4. **Backend coordination** - Ensure backend validates idempotency keys
5. **TTL management** - Adjust `mms.sentKeys` TTL if needed (default 24h)
6. **Batch replays** - Use script for bulk operations, throttle appropriately
7. **Cookie rotation** - Get fresh cookies for long replay sessions

## Support

For issues or questions:
- Check browser console for detailed error logs
- Review queue contents in localStorage
- Test with `DRY_RUN=true` first
- Contact system administrator with logs and input file
