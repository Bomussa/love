# STEP B: Vercel Routing

**Date:** 2025-11-17  
**Status:** ⚠️ NEEDS FIX

---

## 📋 Current Configuration

**File:** `/home/ubuntu/love/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://rujwuruuosffcxazymit.functions.supabase.co/api-router/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install --legacy-peer-deps",
  "framework": "vite",
  "cleanUrls": true
}
```

---

## 🔍 Analysis

### ✅ What's Correct
1. **SPA Routing:** `"/(.*)" → "/index.html"` ✅
2. **Build Config:** Correct for Vite ✅
3. **Output Directory:** `frontend/dist` ✅

### ⚠️ What's Wrong

#### 1. API Routing Mismatch
**Current:**
```
/api/v1/:path* → https://...supabase.co/api-router/:path*
```

**Problem:**
- Frontend calls `/api/v1/pin/status`
- Vercel rewrites to `https://...supabase.co/api-router/pin/status`
- But Supabase Functions are at `https://...supabase.co/functions/v1/pin-status`

**Impact:**
- ❌ All API calls will fail with 404
- ❌ No PIN data will load
- ❌ Queue won't work
- ❌ Nothing will function

---

## 🎯 Required Fix

### Option 1: Remove Rewrite (RECOMMENDED)
**Why:** Frontend should call Supabase directly

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install --legacy-peer-deps",
  "framework": "vite",
  "cleanUrls": true
}
```

**Frontend will use:**
- `supabase-api.js` → Direct to `https://...supabase.co/functions/v1/...`
- `supabase-client.js` → Direct to `https://...supabase.co/rest/v1/...`

### Option 2: Fix Rewrite Destination
**If we must keep rewrite:**

```json
{
  "rewrites": [
    {
      "source": "/api/v1/pin/:path*",
      "destination": "https://rujwuruuosffcxazymit.supabase.co/functions/v1/pin-:path*"
    },
    {
      "source": "/api/v1/queue/:path*",
      "destination": "https://rujwuruuosffcxazymit.supabase.co/functions/v1/queue-:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**But this is NOT recommended because:**
- Adds unnecessary complexity
- Harder to maintain
- Supabase client already handles this

---

## ✅ Recommended Action

**Remove the API rewrite completely.**

Frontend code already uses:
1. `supabase-api.js` for Functions
2. `supabase-client.js` for REST API

Both connect directly to Supabase with correct URLs.

---

## 📝 Implementation

**File to update:** `/home/ubuntu/love/vercel.json`

**Change:**
```diff
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
-   {
-     "source": "/api/v1/:path*",
-     "destination": "https://rujwuruuosffcxazymit.functions.supabase.co/api-router/:path*"
-   },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install --legacy-peer-deps",
  "framework": "vite",
  "cleanUrls": true
}
```

---

## ⏭️ Next Steps

1. ✅ Update vercel.json
2. ✅ Commit changes
3. ⏭️ STEP C: Check environment variables

---

**Completed by:** Manus AI Agent  
**Mode:** ULTRA ENGINEERING MODE
