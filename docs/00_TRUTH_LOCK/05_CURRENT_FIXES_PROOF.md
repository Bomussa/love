# 05_CURRENT_FIXES_PROOF
**Generated**: 2026-02-24

## Fix 1: Domain Redirect Loop Prevention
- **File**: Vercel Dashboard → Domain Settings
- **Before**: `mmc-mms.com` → 308 redirect to `www.mmc-mms.com`
- **After**: Both domains connect directly to Production environment
- **Evidence**: Vercel domain settings updated 2026-02-24
- **Risk**: Eliminated 308 permanent redirect that caused browser cache issues

## Fix 2: Statistics Display (Unique Patients vs Queue Rows)
- **File**: `frontend/src/components/AdminDashboardV2.jsx`
- **Lines**: ~1145-1200 (loadAllData function)
- **Before**: `todayPatients = unified_queue.count` (returned 31 for 3 patients × 10 clinics)
- **After**: `todayPatients = COUNT(DISTINCT patient_id)` filtered by today's date
- **Evidence**: Commit `94ce36d`

## Fix 3: Font Unification (Cairo)
- **Files**: `frontend/index.html`, `frontend/tailwind.config.js`, `frontend/src/index.css`, all notification JS files
- **Before**: Mixed Inter + Cairo fonts
- **After**: Cairo as sole primary font (wght@300;400;500;600;700;800;900)
- **Evidence**: Commit `118101c`

## Fix 4: Supabase Named Imports
- **Files**: 9 component files
- **Before**: `import supabase from '...'` (default import causing white screen)
- **After**: `import { supabase } from '...'` (named import)
- **Evidence**: Commit `fc08cab`

## Fix 5: PIN Validation Sync
- **File**: `frontend/src/lib/api-unified.js`
- **Before**: PIN check failed with 501, fell back to local only
- **After**: Reads from Supabase `pins` table with date filter
- **Evidence**: Commit `fd5b479` + Supabase `pins` table updated 2026-02-24

## Fix 6: Operational Notifications Management
- **Files**: `frontend/src/components/OperationalNotificationsManager.jsx` (NEW)
- **DB**: `operational_notifications` table created in Supabase
- **Before**: Notification templates hardcoded in notification-engine.js
- **After**: Templates stored in DB, editable via Admin UI
- **Evidence**: Commit `118101c`

## Fix 7: notification-engine Dynamic Templates
- **File**: `frontend/src/core/notification-engine.js`
- **Lines**: 3-50 (getOperationalTemplates function)
- **Before**: Hardcoded Arabic strings
- **After**: Reads from `operational_notifications` table, falls back to hardcoded if DB unavailable
- **Evidence**: Commit `118101c`
