# التحديثات الجديدة - README Section

## 🚀 Recent Updates (2025-11-18)

### 🔧 Critical API Fixes

#### Fixed PGRST116 Error
- **Problem:** `PGRST116: Cannot coerce the result to a single JSON object`
- **Solution:** Replaced `.single()` with `.maybeSingle()` in all Supabase queries
- **Files affected:**
  - `frontend/src/lib/supabase-backend-api.js` (5 locations)
  - Functions: `getPathway()`, `enterQueue()`, `queueDone()`, `getPatientPosition()`
- **Impact:** ✅ Eliminates errors when no results are found

#### Fixed Database Column Error
- **Problem:** `column "created_at" does not exist` in `queues` table
- **Solution:** Updated all queries to use `entered_at` instead of `created_at`
- **Files affected:**
  - `api/index.js` (line 627)
  - `lib/api-handlers.js` (line 597)
- **Impact:** ✅ Correct queue ordering and no more column errors

---

### ⚡ Performance Improvements

#### Build Optimization
- **Terser Configuration:**
  - Drop console.log in production ✅
  - 2-pass compression ✅
  - Aggressive optimizations (unsafe mode) ✅
  - Remove all comments ✅

- **Code Splitting:**
  - `vendor-react`: 154.86 KB (React + React DOM)
  - `vendor-supabase`: 164.91 KB (Supabase SDK)
  - `vendor-router`: Separate chunk for React Router
  - `vendor`: 104.81 KB (Other libraries)
  - **Result:** Better caching and parallel loading ✅

- **ESBuild Optimization:**
  - Minify identifiers, syntax, and whitespace ✅
  - Tree shaking enabled ✅
  - Legal comments removed ✅

#### Frontend Optimization
- **index.html improvements:**
  - Preconnect to Supabase API ✅
  - DNS prefetch ✅
  - Module preload for main.jsx ✅
  - Inline critical CSS ✅
  - Loading spinner for better UX ✅

- **Expected Results:**
  - First Contentful Paint: 2.3s → **1.2s** (48% improvement)
  - Largest Contentful Paint: 7.1s → **2.5s** (65% improvement)
  - Total Blocking Time: 520ms → **150ms** (71% improvement)
  - Speed Index: 3.4s → **1.8s** (47% improvement)
  - Overall PageSpeed Score: ~40-50 → **85-95** ✅

---

### 📦 Build Results

```
✓ 1849 modules transformed
✓ Built in 24.57s

Bundle sizes:
- index.js: 166.18 KB (main app)
- vendor-supabase.js: 164.91 KB
- vendor-react.js: 154.86 KB
- vendor.js: 104.81 KB
- polyfills.js: 121.70 KB

Total dist size: 5.5 MB
Total JS size: 1.4 MB
```

---

### 🔍 Database Schema Verification

#### Confirmed `queues` Table Structure:
```sql
CREATE TABLE queues (
    id UUID PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    display_number INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting',
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- ✅ Correct column
    called_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by_pin TEXT
);
```

**Note:** The table uses `entered_at`, not `created_at` ✅

---

### 📝 Files Changed

1. **frontend/src/lib/supabase-backend-api.js**
   - Fixed 5 instances of `.single()` → `.maybeSingle()`
   - Affected functions: getPathway, enterQueue, queueDone (2x), getPatientPosition

2. **api/index.js**
   - Fixed queue ordering: `created_at` → `entered_at`

3. **lib/api-handlers.js**
   - Fixed queue ordering: `created_at` → `entered_at`

4. **frontend/vite.config.js**
   - Enhanced Terser optimization
   - Improved code splitting
   - Added ESBuild optimization
   - Enabled aggressive minification

5. **frontend/index.html**
   - Added preconnect and DNS prefetch
   - Added module preload
   - Inline critical CSS
   - Added loading spinner

---

### ✅ Testing Status

- [x] Database schema verified
- [x] Local build successful (no errors)
- [x] Code splitting working correctly
- [x] Minification applied
- [ ] Vercel preview deployment (pending)
- [ ] PageSpeed Insights test (pending)
- [ ] Functional testing on preview (pending)

---

### 🎯 Next Steps

1. Merge this PR after successful Vercel preview testing
2. Monitor PageSpeed Insights scores
3. Address security vulnerabilities in dependencies (separate PR)
4. Consider additional image optimization

---

### 📚 Related Issues

- Fixes: PGRST116 error
- Fixes: Column "created_at" does not exist
- Improves: PageSpeed Insights scores
- Improves: Build performance

---

### 👥 Contributors

- Comprehensive API and performance fixes
- Database schema verification
- Build optimization

