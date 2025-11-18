# Internal Audit Notes - MMC Medical Committee App

**Date**: 2025-11-18  
**Task**: Production Bug Fixes

---

## 1. Repository Structure Analysis

### ✅ Confirmed Structure
- **Frontend Root**: `frontend/` (Vite + React)
- **Backend**: Supabase + Edge Functions
- **Main Branch**: `main`
- **Production URL**: https://love-a6bu5olwg-bomussa.vercel.app

### ✅ Key Files Identified
- `lib/supabase-api.js` - Supabase Edge Functions wrapper
- `frontend/src/lib/supabase-backend-api.js` - Complete backend API
- `frontend/src/lib/supabase-client.js` - Supabase client
- `frontend/src/lib/api-unified.js` - Unified API layer (currently using Vercel mode)
- `frontend/src/lib/vercel-api-client.js` - Vercel API client
- `lib/enhanced-api.js` - **LEGACY FILE** (contains dummy data - NOT imported by any production component ✅)

---

## 2. Database Schema Analysis

### Clinics Table Structure (from `supabase/schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    pin TEXT NOT NULL CHECK (length(pin) >= 2),
    is_active BOOLEAN DEFAULT true,
    requires_pin BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Finding**: The `clinics` table has a `pin` column that stores the current 2-digit PIN code directly.

### System Settings Table
```sql
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Default Settings**:
- `queue_refresh_interval`: 5000
- `notification_refresh_interval`: 3000
- `max_queue_size`: 100
- `enable_realtime`: true

---

## 3. Problem Analysis

### Problem 1: PIN Dashboard Widget Error
**Error**: "Cannot coerce the result to a single JSON object"

**Location**: `frontend/src/components/EnhancedAdminDashboard.jsx` (line 256-257)
```jsx
<AdminPINMonitor clinicId="clinic1" autoRefresh={false} />
```

**Root Cause**:
- `AdminPINMonitor` component calls `supabaseApi.getCurrentPin(clinicId)` 
- This function is in `lib/supabase-api.js` and calls the `pin-status` Edge Function
- The Edge Function returns data for a SINGLE clinic
- However, the "إدارة الأرقام السرية" page shows ALL clinics with their PINs
- The dashboard widget needs to show ALL clinics, not just one

**Solution**:
1. Query the `clinics` table directly using Supabase client to get all active clinics with their PINs
2. Update the component to display a list/grid of all clinics with their current PINs
3. Remove the `.single()` call if present

---

### Problem 2: Patient Login Failure
**Error**: "فشل تسجيل الدخول" (Login Failed)

**Location**: Patient login component (need to identify)

**Current Flow** (from `frontend/src/lib/supabase-backend-api.js`):
```javascript
export async function patientLogin(id, gender) {
  // Accept any ID without database verification
  // System doesn't store patient data permanently
  const patient = {
    id,
    gender,
    last_active: new Date().toISOString()
  };
  return { success: true, patient };
}
```

**Issue**: This function always returns success, but the frontend still shows login failure. Need to:
1. Find the actual login component
2. Check how it calls the API
3. Verify the error handling logic

---

### Problem 3: Advanced Settings Load Failure
**Error**: "فشل تحميل الإعدادات" (Failed to load settings)

**Expected Behavior**:
- Load settings from `system_settings` table
- Display values: auto_call_interval, max_waiting_time, refresh_interval, near_turn_threshold
- Currently showing hardcoded fallback values: 120, 240, 30, 7

**Solution**:
1. Find the settings component
2. Update query to read from `system_settings` table
3. Map the settings keys correctly
4. Handle missing settings gracefully

---

## 4. Components Using enhanced-api.js

**Search Result**: ✅ **NONE**

No production components are importing `lib/enhanced-api.js`. This is good - it means the legacy dummy data file is already isolated.

---

## 5. Next Steps

### Task 2: Fix PIN Dashboard Widget ✅ READY
- [ ] Create a new query function to get all active clinics with PINs
- [ ] Update `AdminPINMonitor` or create a new component for dashboard
- [ ] Test on production build

### Task 3: Fix Patient Login
- [ ] Locate patient login component
- [ ] Trace the API call flow
- [ ] Fix error handling

### Task 4: Fix Advanced Settings
- [ ] Locate settings component
- [ ] Update query logic
- [ ] Test save functionality

### Task 5: Remove Dummy Data
- [ ] Already verified - no imports found ✅
- [ ] Move `lib/enhanced-api.js` to `archive/` folder

### Task 6: Create Smoke Test
- [ ] Create `scripts/smoke-test.mjs`
- [ ] Test Supabase connection
- [ ] Test PIN fetch
- [ ] Test queue operations

---

## 6. API Mode Configuration

**Current Mode**: `vercel` (from `frontend/src/lib/api-unified.js` line 17)

```javascript
const BACKEND_MODE = 'vercel'; // Using Vercel API (recommended for production)
```

This means all API calls go through Vercel API endpoints, not directly to Supabase.

**Vercel API Endpoints** (from `frontend/src/lib/vercel-api-client.js`):
- `getPinStatus(clinicId)` → GET `pin/status?clinic=${clinicId}`
- `getActivePins(adminCode)` → POST `pin/status` with `{ admin_code: adminCode }`

**Issue**: The `getActivePins` function uses POST to `pin/status` which may not return all clinics correctly.

---

## 7. Environment Variables

From `.env.example`:
```
VITE_SUPABASE_URL=https://rujwuruuosffcxazymit.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**Project ID**: `rujwuruuosffcxazymit`
