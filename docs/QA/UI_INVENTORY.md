# UI Inventory - MMCMMS Project
## Complete Route and Component Catalog

---

## Public Routes

| Route | Component | Status | Notes |
|-------|-----------|--------|-------|
| `/` | LoginPage | ✅ PASS | Patient login with military/personal number |
| `/admin` | AdminDashboardV2 (via auth) | ✅ PASS | Requires admin credentials |
| `/clinic/login` | ClinicLoginPage | ✅ PASS | Clinic staff login |
| `/clinic/:id` | ClinicDashboard | ✅ PASS | Clinic-specific queue view |
| `/display` | DisplayPage | ✅ PASS | Public queue display board |
| `/qrscan` | QrScanPage | ✅ PASS | QR code scanner entry |

## Admin Dashboard Tabs

| Tab ID | Component | Label (AR) | Label (EN) | Status | Interactive Elements |
|--------|-----------|------------|------------|--------|---------------------|
| `dashboard` | (inline) | الرئيسية | Dashboard | ✅ PASS | Stats cards, clinic table, refresh btn |
| `queues` | QueueManagement | الطوابير | Queues | ✅ PASS | Next btn, edit, delete, per-clinic controls |
| `pins` | PINManagement | الأرقام السرية | PINs | ✅ PASS | Add pin, bulk generate, delete expired |
| `notifications` | NotificationsManagementV2 | الإشعارات | Notifications | ✅ PASS | Template editor, toggle phases |
| `routes` | RoutesManagement | المسارات | Routes | ✅ PASS | Add route, edit, delete, reorder |
| `floor_directions` | FloorDirectionsManager | توجيه الطوابق | Floor Directions | ✅ PASS | Add direction, edit, delete |
| `reports` | ReportsSection | التقارير | Reports | ✅ PASS | Date range, export, charts |
| `clinics` | ClinicsManagement | العيادات | Clinics | ✅ PASS | Add clinic, edit, delete, toggle open/close |
| `system` | SystemStatus | حالة النظام | System | ✅ PASS | Health check, DB status, connection info |
| `settings` | SettingsSection | الإعدادات | Settings | ✅ PASS | Center name, hours, toggles, registration settings |
| `users` | UsersManagement | المستخدمين | Users | ✅ PASS | Add user, edit permissions, toggle active, delete |
| `activity` | ActivityLog | سجل النشاطات | Activity | ✅ PASS | Filter, search, date range |
| `backup` | BackupExport | النسخ والتصدير | Backup | ✅ PASS | Export JSON, import, clear data |
| `offline` | OfflineSettings | العمل أوفلاين | Offline | ✅ PASS | Toggle offline mode, sync status |
| `content` | ContentManagement | إدارة المحتوى | Content | ✅ PASS | Manage text content, translations |
| `appearance` | AppearanceManagement | المظهر | Appearance | ✅ PASS | Theme colors, logo, layout options |
| `database` | DatabaseManagement | قاعدة البيانات | Database | ✅ PASS | Table viewer, record counts, cleanup |
| `features` | FeatureControlPanel | التحكم بالميزات | Features | ✅ PASS | Feature toggles |
| `apimonitor` | APIMonitor | مراقبة API | API Monitor | ✅ PASS | Endpoint health, response times |
| `qa_repair` | QARepairPanel | الجودة والإصلاح | QA & Repair | ✅ PASS | Run QA, view findings, execute repairs |
| `smart_system` | SmartDiagnosticsPanel | النظام الذكي | Smart System | ✅ PASS | Diagnostics, auto-heal status |
| `files` | FilesCenter | مركز الملفات | Files Center | ✅ PASS | API documentation, file management |
| `advanced-notifications` | AdvancedNotificationsManager | إشعارات متقدمة | Adv. Notifications | ✅ PASS | Advanced notification templates |

## Notification Phases (R6 Compliance)

| Phase | Defined | Implemented | Closeable |
|-------|---------|-------------|-----------|
| START_HINT | ✅ | ✅ notification-engine.js:311 | ✅ |
| NEAR_TURN | ✅ | ✅ notification-engine.js:324 | ✅ |
| YOUR_TURN | ✅ | ✅ notification-engine.js:345 | ✅ |
| STEP_DONE_NEXT | ✅ | ✅ notification-engine.js:366 | ✅ |

## Known Fixes Applied

| ID | Issue | Status | Files Changed |
|----|-------|--------|---------------|
| K1 | PIN random→deterministic | ✅ FIXED | AdminDashboardV2.jsx |
| K2 | Duplicate getSettings | ✅ FIXED | api-unified.js, PatientPage.jsx |
| K3 | /api→/api/v1 canonical | ✅ FIXED | vercel.json, network-status-monitor.js |
| K4 | Hardcoded secrets | ✅ FIXED | v1.js (backend) |
| K5 | Dead code cleanup | ✅ FIXED | Removed 4 backup files |
| BUG | Build failure (orphaned code) | ✅ FIXED | AdminDashboardV2.jsx |
| BUG | adminLogin missing in api-unified | ✅ FIXED | api-unified.js |
| BUG | admin_users vs admins table mismatch | ✅ FIXED | v1.js (backend) |
| BUG | Password hash inconsistency | ✅ FIXED | v1.js, api-unified.js |

## API Endpoints (Backend v1.js)

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/health` | GET | ✅ | Health check with env status |
| `/api/v1/admin/login` | POST | ✅ | Admin authentication |
| `/api/v1/settings` | GET | ✅ | Get queue settings |
| `/api/v1/settings` | PATCH | ✅ | Update queue settings |
| `/api/v1/queue/enter` | POST | ✅ | Enter patient into queue |
| `/api/v1/queue/status` | GET | ✅ | Get patient queue status |
| `/api/v1/qa/deep_run` | GET | ✅ | Run QA deep analysis |
| `/api/v1/repair/execute` | POST | ✅ | Execute repair action |
| `/api/v1/pin/daily` | GET | ✅ | Get daily PIN for clinic |
