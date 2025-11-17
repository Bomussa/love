# STEP C: Environment Variables

**Date:** 2025-11-17  
**Status:** ⚠️ NEEDS CLEANUP

---

## 📋 Current Vercel Environment Variables

من الصور المرفقة، المتغيرات الموجودة:

### ✅ Required Variables
```bash
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
SUPABASE_JWT_SECRET=p+f1/FIaiDzeNbbHH6n4ArBQ874wj97zr5J7wStzf+67/eWuTCx94c1QyONr2rGp2dAuLeqrs3QcOfigMIhJtA==
```

### ⚠️ Variables to REMOVE
```bash
VITE_API_BASE_URL=https://love-api.vercel.app/api/v1  ← DELETE THIS!
API_ORIGIN=https://love-api.vercel.app  ← DELETE THIS!
```

**Why?**
- `love-api` is a separate repo with NO Vercel Functions
- These variables cause 404 errors
- Frontend should connect directly to Supabase

### 📝 Other Variables (Keep)
```bash
FRONTEND_ORIGIN=https://mmc-mms.com
DOMIN=mmc-mms.com
VITE_USE_SUPABASE=true
VITE_APP_URL=... (if exists)
NEXT_TELEMETRY_DISABLED=... (if exists)
CRON_SECRET=... (for Supabase cron)
POSTGRES_* (for database)
```

---

## 🎯 Required Actions

### 1. Delete from Vercel Dashboard
- ❌ `VITE_API_BASE_URL`
- ❌ `API_ORIGIN`

### 2. Verify Required Variables
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (for server-side if needed)
- ✅ `SUPABASE_URL` (for server-side if needed)

### 3. Check .env.example
Create `.env.example` in repo:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Frontend URL
VITE_APP_URL=https://your-domain.com

# Optional: For development
VITE_USE_SUPABASE=true
```

---

## 📊 Environment Variable Usage

### Frontend (Vite)
```javascript
// lib/supabase-client.js
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// lib/supabase-api.js
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
```

### ❌ DO NOT USE
```javascript
// WRONG - This variable should not exist
const apiBase = import.meta.env.VITE_API_BASE_URL  // ← DELETE!
```

---

## ✅ Verification Checklist

After cleanup:

- [ ] `VITE_API_BASE_URL` deleted from Vercel
- [ ] `API_ORIGIN` deleted from Vercel
- [ ] Frontend builds successfully
- [ ] No console errors about missing env vars
- [ ] Supabase connection works
- [ ] PIN data loads correctly

---

## 🔒 Security Notes

**DO NOT commit to repo:**
- ❌ Real `VITE_SUPABASE_ANON_KEY`
- ❌ Real `SUPABASE_SERVICE_ROLE_KEY`
- ❌ Real `SUPABASE_JWT_SECRET`

**Safe to commit:**
- ✅ `VITE_SUPABASE_URL` (public URL)
- ✅ `.env.example` with placeholders

---

## ⏭️ Next Steps

1. ⏭️ User: Delete variables from Vercel Dashboard
2. ⏭️ Verify build succeeds
3. ⏭️ STEP D: Fix API calls
4. ⏭️ STEP E: Fix frontend flows

---

**Completed by:** Manus AI Agent  
**Mode:** ULTRA ENGINEERING MODE
