# MMC-MMS API Documentation
## نظام إدارة اللجنة الطبية العسكرية

**Domain:** https://www.mmc-mms.com  
**Version:** 2.0  
**Last Updated:** 2025-10-19

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Features](#features)
5. [Testing Guide](#testing-guide)
6. [Deployment](#deployment)

---

## System Overview

نظام شامل لإدارة المراجعين في اللجنة الطبية العسكرية يعمل على Cloudflare Pages مع:

- ✅ نظام PIN ديناميكي مع أقفال ذرية (Atomic Locks)
- ✅ نظام قوائم الانتظار (Queue) مع حالات WAITING, NEAR_TURN, IN_SERVICE, DONE
- ✅ نظام المسارات الديناميكية (Dynamic Path Engine)
- ✅ نظام الإشعارات اللحظية (SSE + Polling)
- ✅ نظام التقارير الشامل (Daily, Weekly, Monthly, Range)
- ✅ نظام Session Code (Barcode)
- ✅ Idempotency-Key Support
- ✅ WWW Redirect (301)
- ✅ Rate Limiting (60 req/min)

---

## Architecture

### Technology Stack
- **Platform:** Cloudflare Pages + Functions
- **Storage:** Cloudflare KV (6 namespaces)
- **Cache:** KV_CACHE with Idempotency
- **Locks:** KV_LOCKS for atomic operations
- **Events:** KV_EVENTS for audit trail
- **Timezone:** Asia/Qatar (UTC+3)

### KV Namespaces
1. **KV_ADMIN** - Admin users, settings, configurations
2. **KV_PINS** - Daily PIN allocation per clinic
3. **KV_QUEUES** - Queue state per clinic per day
4. **KV_EVENTS** - Event logs and notifications
5. **KV_LOCKS** - Distributed locks for atomic operations
6. **KV_CACHE** - Idempotency cache and general caching

---

## API Endpoints

### 🏥 Health & Status

#### GET /api/v1/health/status
**Description:** System health check  
**Response:**
```json
{
  "pages_fullstack": true,
  "functions_enabled": true,
  "kv_bound": ["KV_ADMIN", "KV_PINS", "KV_QUEUES", "KV_EVENTS", "KV_LOCKS", "KV_CACHE"],
  "env_ok": {
    "PIN_SECRET": true,
    "NOTIFY_KEY": true,
    "JWT_SECRET": true,
    "TIMEZONE": true
  },
  "www_redirect": true,
  "timestamp": "2025-10-19T..."
}
```

---

### 🔢 PIN Management

#### POST /api/v1/pin/:clinic/assign
**Description:** Assign PIN to patient (with atomic locks)  
**Headers:**
- `Idempotency-Key` (optional): Prevents duplicate assignments

**Response:**
```json
{
  "success": true,
  "pin": "05",
  "session_code": "MMC-المخ-05-251019",
  "clinic": "المختبر",
  "date": "2025-10-19",
  "reserve_mode": false,
  "remaining": 15
}
```

#### GET /api/v1/pin/:clinic/status
**Description:** Get PIN allocation status for clinic

#### POST /api/v1/pin/:clinic/reset
**Description:** Reset PINs for clinic (Admin only)

---

### 📊 Queue Management

#### POST /api/v1/queue/:clinic/enter
**Description:** Enter queue with PIN or auto-assign  
**Body:**
```json
{
  "pin": "05",
  "session_code": "MMC-المخ-05-251019"
}
```

**Response:**
```json
{
  "success": true,
  "pin": "05",
  "session_code": "MMC-المخ-05-251019",
  "position": 2,
  "status": "NEAR_TURN",
  "queue_length": 5,
  "estimated_wait_minutes": 10
}
```

#### POST /api/v1/queue/:clinic/call
**Description:** Call next patient in queue  
**Response:**
```json
{
  "success": true,
  "current": {
    "pin": "05",
    "status": "IN_SERVICE"
  },
  "next": {
    "pin": "08",
    "status": "NEAR_TURN"
  }
}
```

#### POST /api/v1/queue/:clinic/done
**Description:** Mark service as done  
**Body:**
```json
{
  "pin": "05"
}
```

**Response:**
```json
{
  "success": true,
  "pin": "05",
  "status": "DONE",
  "wait_time_minutes": 8,
  "service_time_minutes": 5,
  "avg_wait_minutes": 10
}
```

#### GET /api/v1/queue/:clinic/status
**Description:** Get queue status for clinic

---

### 🛤️ Dynamic Path Engine

#### GET /api/v1/path/choose
**Description:** Choose clinic based on dynamic weights  
**Query Parameters:**
- `clinic` (optional): Specific clinic name
- `session_id` (optional): Session ID for sticky routing

**Response:**
```json
{
  "success": true,
  "clinic": "عيادة العيون",
  "session_id": "MMC1729350000abc",
  "sticky": true,
  "no_pin": false,
  "score_breakdown": {
    "clinic": "عيادة العيون",
    "score": 2.3,
    "is_empty": true,
    "queue_length": 0,
    "spare_ratio": 0.9
  }
}
```

**Women's Clinics (No PIN required):**
- عيادة الباطنية (نساء)
- عيادة الجلدية (نساء)
- عيادة العيون (نساء)

---

### 🔔 Notifications

#### POST /api/v1/notify/dispatch
**Description:** Send notification to patient  
**Body:**
```json
{
  "type": "YOUR_TURN",
  "pin": "05",
  "clinic": "المختبر",
  "message": "حان دورك",
  "priority": "urgent"
}
```

#### GET /api/v1/notify/status?pin=05&clinic=المختبر
**Description:** Get notifications for patient

---

### 📡 Server-Sent Events (SSE)

#### GET /api/v1/events/stream?pin=05&clinic=المختبر
**Description:** Real-time event stream for patient  
**Content-Type:** text/event-stream

**Events:**
- `CONNECTED` - Initial connection
- `YOUR_TURN` - Your turn now
- `NEAR_TURN` - Your turn is near
- `QUEUE_UPDATE` - Position update

---

### 📈 Reports

#### GET /api/v1/report/daily?date=2025-10-19&format=json
**Description:** Daily report for all clinics  
**Formats:** json, csv

#### GET /api/v1/report/weekly?week=2025-42&format=json
**Description:** Weekly aggregated report

#### GET /api/v1/report/monthly?month=2025-10&format=json
**Description:** Monthly aggregated report

#### GET /api/v1/report/range?start=2025-10-01&end=2025-10-15&format=csv
**Description:** Custom date range report (max 90 days)

---

### 🔐 Admin

#### POST /api/v1/admin/login
**Description:** Admin authentication  
**Body:**
```json
{
  "username": "admin",
  "password": "MMC2025!Admin"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "username": "admin",
    "role": "super_admin"
  }
}
```

#### GET /api/v1/admin/settings
**Description:** Get system settings

#### PUT /api/v1/admin/settings
**Description:** Update system settings

#### POST /api/v1/admin/report/export
**Description:** Export report to R2 (when enabled)

---

## Features

### 1. Atomic Locks
- Prevents race conditions during PIN assignment
- Retry logic with exponential backoff (max 5 attempts)
- Lock TTL: 10 seconds
- Automatic lock release

### 2. Idempotency
- Prevents duplicate PIN assignments
- Cache TTL: 24 hours
- Header: `Idempotency-Key: <unique-key>`

### 3. Session Code (Barcode)
- Format: `MMC-{CLINIC_CODE}-{PIN}-{YYMMDD}`
- Example: `MMC-المخ-05-251019`
- Used for queue entry without PIN

### 4. Queue States
- **WAITING**: In queue, position > 3
- **NEAR_TURN**: In queue, position ≤ 3
- **IN_SERVICE**: Currently being served
- **DONE**: Service completed

### 5. Dynamic Path Engine
- Weighted clinic selection
- Sticky routing per session
- Empty queue priority
- Load balancing
- Special handling for women's clinics

### 6. WWW Redirect
- All requests to `mmc-mms.com` → `www.mmc-mms.com`
- HTTP 301 Permanent Redirect
- Implemented in `_middleware.js`

### 7. Rate Limiting
- 60 requests per minute per IP
- Applied to `/api/*` routes only
- Returns HTTP 429 when exceeded

---

## Testing Guide

### Test Scenario 1: Complete Patient Flow

```bash
# 1. Assign PIN
curl -X POST https://www.mmc-mms.com/api/v1/pin/المختبر/assign \
  -H "Idempotency-Key: test-001"

# Response: { "pin": "05", "session_code": "MMC-المخ-05-251019" }

# 2. Enter Queue
curl -X POST https://www.mmc-mms.com/api/v1/queue/المختبر/enter \
  -H "Content-Type: application/json" \
  -d '{"pin":"05"}'

# 3. Call Next
curl -X POST https://www.mmc-mms.com/api/v1/queue/المختبر/call

# 4. Mark Done
curl -X POST https://www.mmc-mms.com/api/v1/queue/المختبر/done \
  -H "Content-Type: application/json" \
  -d '{"pin":"05"}'
```

### Test Scenario 2: Concurrent PIN Assignment (50 requests)

```bash
for i in {1..50}; do
  curl -X POST https://www.mmc-mms.com/api/v1/pin/المختبر/assign \
    -H "Idempotency-Key: concurrent-$i" &
done
wait
```

### Test Scenario 3: Women's Clinic (No PIN)

```bash
# Choose women's clinic
curl "https://www.mmc-mms.com/api/v1/path/choose?clinic=عيادة%20الباطنية%20(نساء)"

# Response: { "no_pin": true }
```

### Test Scenario 4: SSE Stream

```bash
curl -N "https://www.mmc-mms.com/api/v1/events/stream?pin=05&clinic=المختبر"
```

### Test Scenario 5: Daily Report

```bash
curl "https://www.mmc-mms.com/api/v1/report/daily?date=2025-10-19&format=csv" \
  -o daily-report.csv
```

---

## Deployment

### Prerequisites
- Cloudflare account with Pages enabled
- GitHub repository connected
- KV namespaces created
- Environment variables set

### Deploy to Cloudflare Pages

```bash
# 1. Commit changes
git add .
git commit -m "Complete API implementation"
git push origin main

# 2. Cloudflare Pages will auto-deploy
# Monitor at: https://dash.cloudflare.com/pages/mmc-mms
```

### Manual Deploy via Wrangler

```bash
# Install wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy dist --project-name=mmc-mms
```

### Environment Variables (Set in Cloudflare Dashboard)
- `TIMEZONE=Asia/Qatar`
- `PIN_SECRET=6a1f1a07787035f332b188d623a6395dc50de51bf90a62238ed25b5519ca3194`
- `JWT_SECRET=ff8d89d5d43df95e470553e76f3c4ca18f651ad4fdc6ab86b256f4883e6aa220`
- `NOTIFY_KEY=https://notify.mmc-mms.com/webhook`

---

## Monitoring & Logs

### Health Check
```bash
curl https://www.mmc-mms.com/api/v1/health/status
```

### View Logs
- Cloudflare Dashboard → Pages → mmc-mms → Functions → Logs

### Metrics
- Request count
- Error rate
- Response time
- KV operations

---

## Support

For issues or questions:
- Check logs in Cloudflare Dashboard
- Review API documentation
- Test endpoints with provided examples

---

**End of Documentation**

