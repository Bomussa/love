# Operations Scripts

This directory contains operational scripts for managing the Medical Management System.

## replay-requests.cjs

Replay failed or pending requests to the production API using session-based authentication.

### Quick Start

```bash
# Get session cookie from browser (F12 > Application > Cookies)
COOKIE="session=your-cookie-value" node scripts/ops/replay-requests.cjs input.jsonl
```

### Features

- ✅ No API keys required - uses session cookie
- ✅ Automatic idempotency key generation
- ✅ CSV and JSONL input formats
- ✅ Throttling and retry support
- ✅ Dry-run mode for testing
- ✅ Detailed progress and summary reports

### Input Formats

**JSONL** (recommended):
```jsonl
{"method":"POST","endpoint":"/queue/enter","body":{"clinic":"lab","user":"P001"}}
{"method":"POST","endpoint":"/queue/done","body":{"clinic":"lab","user":"P001","pin":"1234"}}
```

**CSV**:
```csv
method,endpoint,body
POST,/queue/enter,"{""clinic"":""lab"",""user"":""P001""}"
POST,/queue/done,"{""clinic"":""lab"",""user"":""P001"",""pin"":""1234""}"
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COOKIE` | ✅ Yes | - | Session cookie for auth |
| `BASE_URL` | No | `https://mmc-mms.com/api/v1` | API endpoint |
| `THROTTLE` | No | `300` | Delay (ms) between requests |
| `DRY_RUN` | No | `false` | Test without sending |
| `TIMEOUT` | No | `10000` | Request timeout (ms) |

### Examples

**Dry run (test without sending)**:
```bash
COOKIE="session=xyz" DRY_RUN=true node scripts/ops/replay-requests.cjs input.jsonl
```

**Custom throttle**:
```bash
COOKIE="session=xyz" THROTTLE=1000 node scripts/ops/replay-requests.cjs input.jsonl
```

**Custom API endpoint**:
```bash
COOKIE="session=xyz" BASE_URL="https://staging.mmc-mms.com/api/v1" node scripts/ops/replay-requests.cjs input.jsonl
```

### Documentation

For complete documentation, see: [docs/REPLAY_FAILED_REQUESTS.md](../../docs/REPLAY_FAILED_REQUESTS.md)

### Sample Input Template

See: [sample-input-template.md](./sample-input-template.md)
