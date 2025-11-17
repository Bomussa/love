# STEP D: API Stability

**Date:** 2025-11-17  
**Status:** 🔧 IN PROGRESS

---

## 📋 All API Calls Found in Frontend

### ❌ Calls Using `/api/v1/*` (BROKEN)
```javascript
// components/AdminExtendTime.jsx:29
await fetch('/api/v1/admin/extend-time', {...})

// hooks/useQueueWatcher.js:60
await fetch('/api/v1/events/recovery', {...})

// lib/dynamic-pathways.js:37
await fetch(`/api/v1/queue/status?clinic=${clinicId}`)
```

### ⚠️ Calls Using `/api/admin/*` (UNCLEAR)
```javascript
// components/EnhancedThemeSelector.jsx:56
await fetch('/api/admin/settings?type=theme')

// components/EnhancedThemeSelector.jsx:73
await fetch('/api/admin/settings', {...})
```

### ✅ Calls Using Abstraction (GOOD)
```javascript
// lib/vercel-api-client.js:33
await fetch(url, {...})  // ← Uses configured base URL

// hooks/useSmartUpdater.js:25
await fetch(url, { cache: "no-store" })  // ← Dynamic URL
```

---

## 🎯 Required Fixes

### 1. Fix AdminExtendTime.jsx
**Current:**
```javascript
await fetch('/api/v1/admin/extend-time', {...})
```

**Should be:**
```javascript
import { supabase } from '../lib/supabase-client'

// Option A: Direct Supabase RPC
await supabase.rpc('extend_time', { clinic_id, minutes })

// Option B: Edge Function
await fetch(`${SUPABASE_URL}/functions/v1/admin-extend-time`, {
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ clinic_id, minutes })
})
```

### 2. Fix useQueueWatcher.js
**Current:**
```javascript
await fetch('/api/v1/events/recovery', {...})
```

**Should be:**
```javascript
// Option A: Supabase Realtime (preferred)
const channel = supabase
  .channel('queue-events')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, handleChange)
  .subscribe()

// Option B: Edge Function
await fetch(`${SUPABASE_URL}/functions/v1/events-recovery`, {...})
```

### 3. Fix dynamic-pathways.js
**Current:**
```javascript
await fetch(`/api/v1/queue/status?clinic=${clinicId}`)
```

**Should be:**
```javascript
// Option A: Direct Supabase query
const { data } = await supabase
  .from('queues')
  .select('*')
  .eq('clinic_id', clinicId)
  .eq('status', 'waiting')

// Option B: Use existing supabase-api.js
import { supabaseApi } from '../lib/supabase-api'
const status = await supabaseApi.getQueueStatus(clinicId)
```

### 4. Fix EnhancedThemeSelector.jsx
**Current:**
```javascript
await fetch('/api/admin/settings?type=theme')
await fetch('/api/admin/settings', {...})
```

**Should be:**
```javascript
// Option A: Direct Supabase
const { data } = await supabase
  .from('settings')
  .select('*')
  .eq('type', 'theme')
  .single()

// Option B: localStorage (if theme is client-only)
const theme = localStorage.getItem('theme') || 'default'
```

---

## 🔍 Supabase Edge Functions Available

From `love-api/supabase/functions/`:
```
✅ api-router/          - Main router
✅ generate-pins-cron/  - PIN generation (cron)
✅ pin-status/          - Get current PIN
✅ queue-enter/         - Enter queue
```

**Missing Functions:**
- ❌ `admin-extend-time`
- ❌ `events-recovery`
- ❌ `queue-status`
- ❌ `admin-settings`

**Options:**
1. Create missing Edge Functions
2. Use direct Supabase queries
3. Use Supabase RPC functions

---

## 📝 Implementation Plan

### Phase 1: Use Direct Supabase (Fastest)
- ✅ Already have `supabase-client.js`
- ✅ Can query tables directly
- ✅ No need for Edge Functions for simple CRUD

### Phase 2: Add Edge Functions (If Needed)
- Only for complex logic
- Only if RLS is too restrictive

### Phase 3: Update All Components
1. ✅ AdminPINMonitor.jsx (already fixed)
2. ⏭️ AdminExtendTime.jsx
3. ⏭️ useQueueWatcher.js
4. ⏭️ dynamic-pathways.js
5. ⏭️ EnhancedThemeSelector.jsx

---

## ✅ Next Actions

1. Create `lib/supabase-queries.js` for common queries
2. Update each component one by one
3. Test each fix
4. Remove `/api/v1/*` references completely

---

**Status:** Ready to implement fixes  
**Completed by:** Manus AI Agent
