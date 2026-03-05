# Post-Merge Verification Guide

## Pre-Merge Checks

```bash
# 1. Frontend Build
cd love-frontend/frontend
npm install
npx vite build
# Expected: ✓ built in ~10s, 0 errors

# 2. Check for dead backup files
find frontend/src -name "*.backup" -o -name "*.conflict_backup" -o -name "*.old"
# Expected: No results
```

## Post-Merge Smoke Tests

### 1. Health Check
```bash
curl -s https://mmc-mms.com/api/v1/health
# Expected: {"status":"ok","version":"2.0.0","env_configured":true}
```

### 2. Frontend Load
```bash
curl -s -o /dev/null -w "%{http_code}" https://mmc-mms.com
# Expected: 200
```

### 3. Admin Login
- Navigate to `https://mmc-mms.com/admin`
- Click "الإدارة" 
- Enter: Bomussa / 14490
- Expected: Dashboard loads with statistics

### 4. PIN Generation Verification
- Go to admin → الأرقام السرية
- Click "+ إضافة" → Select any clinic
- Verify PIN is 2-digit (10-99) and deterministic (same value each day for same clinic)
- Click "⚡ توليد للكل" → Verify each clinic gets unique daily PIN

### 5. Settings Persistence
- Go to admin → الإعدادات
- Change "اسم المركز" to "Test"
- Refresh page
- Verify "Test" is persisted
- Change back to original

### 6. API Path Canonicality
```bash
# Verify /api/v1 paths work
curl -s -o /dev/null -w "%{http_code}" https://mmc-mms.com/api/v1/health
# Expected: 200 (or 401 if Vercel auth)

# Verify legacy path redirects
curl -s -o /dev/null -w "%{http_code}" https://mmc-mms.com/api/health
# Expected: 200 (proxied through vercel.json)
```

### 7. All Admin Tabs Load
Navigate through each tab and verify no blank/error screens:
- [ ] الرئيسية (Dashboard)
- [ ] الطوابير (Queues)
- [ ] الأرقام السرية (PINs)
- [ ] الإشعارات (Notifications)
- [ ] المسارات (Routes)
- [ ] توجيه الطوابق (Floor Directions)
- [ ] التقارير (Reports)
- [ ] العيادات (Clinics)
- [ ] حالة النظام (System)
- [ ] الإعدادات (Settings)
- [ ] المستخدمين (Users)
- [ ] سجل النشاطات (Activity)
- [ ] النسخ والتصدير (Backup)
- [ ] العمل أوفلاين (Offline)
- [ ] إدارة المحتوى (Content)
- [ ] المظهر (Appearance)
- [ ] قاعدة البيانات (Database)
- [ ] التحكم بالميزات (Features)
- [ ] مراقبة API (API Monitor)
- [ ] الجودة والإصلاح (QA & Repair)
- [ ] النظام الذكي (Smart System)

## Regression Prevention
- Any new component MUST be added to `ui_inventory.json`
- PIN generation MUST use `generateDailyPIN(clinicId)` - never `Math.random()`
- Settings access MUST use `getAllSettings()` for system settings and `getSettings(type)` for theme
- Admin login MUST query `admin_users` table (not `admins`)
- All API calls MUST use `/api/v1/` prefix
