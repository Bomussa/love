# 📑 فهرس الملفات الكامل - File Index

## 🎯 الغرض
هذا الملف يوفر فهرس سريع لجميع ملفات المشروع مع تصنيفها حسب الحالة والاستخدام.

---

## 🟢 ملفات نشطة (Currently Active)

### Entry Points
| الملف | المسار | الحالة | الأولوية |
|------|--------|--------|----------|
| `main.jsx` | `frontend/src/` | 🟢 Active | ⭐ Critical |
| `App.jsx` | `frontend/src/` | 🟢 Active | ⭐ Critical |
| `index.html` | `frontend/` | 🟢 Active | ⭐ Critical |

### Core Components (Patient Flow)
| الملف | المسار | الوصف | الحالة | الأولوية |
|------|--------|-------|--------|----------|
| `LoginPage.jsx` | `components/` | شاشة الدخول | 🟢 Active | ⭐ Critical |
| `ExamSelectionPage.jsx` | `components/` | اختيار الفحص | 🟢 Active | ⭐ Critical |
| `PatientPage.jsx` | `components/` | واجهة المريض | 🟢 Active | ⭐ Critical |
| `CompletePage.jsx` | `components/` | شاشة الإنهاء | 🟢 Active | ⭐ Critical |

### Core Components (Admin Flow)
| الملف | المسار | الوصف | الحالة | الأولوية |
|------|--------|-------|--------|----------|
| `AdminPage.jsx` | `components/` | لوحة الإدارة | 🟢 Active | ⭐ Critical |
| `AdminLoginPage.jsx` | `components/admin/` | دخول الإدارة | 🟢 Active | ⭐ Critical |
| `AdvancedDashboard.jsx` | `components/admin/` | Dashboard متقدم | 🟢 Active | ⭐ Important |

### Feature Components
| الملف | المسار | الوصف | الحالة | الأولوية |
|------|--------|-------|--------|----------|
| `QRScanner.jsx` | `components/` | ماسح QR | 🟢 Active | ⭐ Important |
| `CountdownTimer.jsx` | `components/` | عداد تنازلي | 🟢 Active | ⭐ Important |
| `AdminExtendTime.jsx` | `components/` | تمديد الوقت | 🟢 Active | ⭐ Important |
| `AdminPINMonitor.jsx` | `components/` | مراقبة PIN | 🟢 Active | 🔵 Normal |
| `AdminQueueMonitor.jsx` | `components/` | مراقبة Queues | 🟢 Active | 🔵 Normal |
| `AdminQrManager.jsx` | `components/` | إدارة QR | 🟢 Active | 🔵 Normal |

### UI Components
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `Button.jsx` | `components/` | زر | 🟢 Active |
| `Card.jsx` | `components/` | بطاقة | 🟢 Active |
| `Input.jsx` | `components/` | حقل إدخال | 🟢 Active |
| `Header.jsx` | `components/` | رأسية | 🟢 Active |

### Notification Components
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `NotificationSystem.jsx` | `components/` | نظام الإشعارات | 🟢 Active |
| `NotificationPanel.jsx` | `components/` | لوحة الإشعارات | 🟢 Active |
| `NotificationsPage.jsx` | `components/` | صفحة الإشعارات | 🟢 Active |

### Configuration Components
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `ClinicsConfiguration.jsx` | `components/` | إعداد العيادات | 🟢 Active |
| `SystemSettingsPanel.jsx` | `components/` | إعدادات النظام | 🟢 Active |
| `PatientsManagement.jsx` | `components/` | إدارة المرضى | 🟢 Active |

### Core Engines
| الملف | المسار | الوصف | الحالة | الأولوية |
|------|--------|-------|--------|----------|
| `advanced-queue-engine.js` | `core/` | محرك الطوابير المتقدم | 🟢 Active | ⭐ Critical |
| `event-bus.js` | `core/` | ناقل الأحداث | 🟢 Active | ⭐ Critical |
| `pin-engine.js` | `core/` | محرك PIN | 🟢 Active | ⭐ Critical |
| `path-engine.js` | `core/` | محرك المسارات | 🟢 Active | ⭐ Critical |
| `queue-engine.js` | `core/` | محرك الطوابير الأساسي | 🟢 Active | ⭐ Important |
| `notification-engine.js` | `core/` | محرك الإشعارات | 🟢 Active | ⭐ Important |

### API Services
| الملف | المسار | الوصف | الحالة | الأولوية |
|------|--------|-------|--------|----------|
| `api-unified.js` | `lib/` | API موحدة | 🟢 Active | ⭐ Critical |
| `local-api.js` | `lib/` | Local Storage API | 🟢 Active | ⭐ Critical |
| `auth-service.js` | `lib/` | خدمة المصادقة | 🟢 Active | ⭐ Critical |
| `mms-core-api.js` | `lib/` | MMS Core | 🟢 Active | ⭐ Important |

### Libraries
| الملف | المسار | الوصف | الحالة | الأولوية |
|------|--------|-------|--------|----------|
| `dynamic-pathways.js` | `lib/` | المسارات الديناميكية | 🟢 Active | ⭐ Important |
| `enhanced-themes.js` | `lib/` | نظام الثيمات | 🟢 Active | ⭐ Important |
| `i18n.js` | `lib/` | الترجمة | 🟢 Active | ⭐ Important |
| `utils.js` | `lib/` | وظائف مساعدة | 🟢 Active | 🔵 Normal |
| `settings.js` | `lib/` | الإعدادات | 🟢 Active | 🔵 Normal |
| `workflow.js` | `lib/` | سير العمل | 🟢 Active | 🔵 Normal |

### React Hooks
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `useQueueWatcher.js` | `hooks/` | مراقبة الطابور | 🟢 Active |
| `useSmartUpdater.js` | `hooks/` | تحديث ذكي | 🟢 Active |

### Configuration
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `admin-credentials.js` | `config/` | بيانات الإدارة | 🟢 Active |
| `refresh.constants.js` | `core/config/` | ثوابت التحديث | 🟢 Active |

### Routing Services
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `routeMapService.ts` | `core/routing/` | خريطة المسارات | 🟢 Active |
| `routeService.ts` | `core/routing/` | خدمة المسارات | 🟢 Active |

---

## 🟡 ملفات قديمة (Old Versions - Not Used)

### Old API Layer
| الملف | المسار | السبب | البديل |
|------|--------|-------|--------|
| `api.js` | `lib/` | نسخة قديمة | `api-unified.js` |
| `enhanced-api.js` | `lib/` | نسخة قديمة | `api-unified.js` |
| `api-adapter.js` | `lib/` | غير مستخدم | `api-unified.js` |

### Old Storage Layer
| الملف | المسار | السبب | البديل |
|------|--------|-------|--------|
| `db.js` | `lib/` | نسخة قديمة | `local-api.js` |
| `offline-storage.js` | `lib/` | نسخة قديمة | `local-api.js` |
| `unified-storage.js` | `lib/` | نسخة قديمة | `local-api.js` |

### Old Managers
| الملف | المسار | السبب | البديل |
|------|--------|-------|--------|
| `queueManager.js` | `lib/` | نسخة قديمة | `advanced-queue-engine.js` |
| `routingManager.js` | `lib/` | نسخة قديمة | `dynamic-pathways.js` |

### TypeScript Duplicates
| الملف | المسار | السبب | البديل |
|------|--------|-------|--------|
| `pinService.ts` | `core/` | نسخة TS | `pin-engine.js` |
| `queueManager.ts` | `core/` | نسخة TS | `queue-engine.js` |
| `fs-atomic.ts` | `utils/` | غير مستخدم | - |
| `logger.ts` | `utils/` | غير مستخدم | - |
| `time.ts` | `utils/` | غير مستخدم | - |

### Old Dashboard
| الملف | المسار | السبب | البديل |
|------|--------|-------|--------|
| `EnhancedAdminDashboard.jsx` | `components/` | نسخة قديمة | `AdvancedDashboard.jsx` |

---

## 🔴 ملفات مؤرشفة (Archived)

### Moved to _archived/
| الملف | المسار الجديد | السبب |
|------|---------------|-------|
| `queue-engine.backup.js` | `src/_archived/` | نسخة احتياطية قديمة |

---

## 🔵 ملفات اختبار (Test/Demo Files)

### Static Test Pages
| الملف | المسار | الوصف |
|------|--------|-------|
| `test-admin-login.html` | `public/` | صفحة اختبار |
| `test-standalone.html` | `public/` | صفحة اختبار |
| `ZFDTicketDisplay.jsx` | `components/` | عرض تذكرة |
| `QrScanPage.jsx` | `components/` | صفحة مسح QR |
| `EnhancedThemeSelector.jsx` | `components/` | اختيار الثيم |

### Test Scripts
| الملف | المسار | الوصف |
|------|--------|-------|
| `test-60-patients.js` | `/` | اختبار 60 مراجع |

---

## ⚙️ ملفات الإعدادات (Configuration Files)

### Build & Development
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `vite.config.js` | `frontend/` | إعدادات Vite | 🟢 Active |
| `tailwind.config.js` | `frontend/` | إعدادات Tailwind | 🟢 Active |
| `package.json` | `frontend/` | Dependencies | 🟢 Active |
| `yarn.lock` | `frontend/` | Yarn lock | 🟢 Active |

### Deployment
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `vercel.json` | `/` | إعدادات Vercel | 🟢 Active |
| `.vercelignore` | `/` | Vercel ignore | 🟢 Active |

### Environment
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `.env` | `frontend/` | Frontend env | 🟢 Active |
| `.env` | `backend/` | Backend env | 🟢 Active |

### Documentation
| الملف | المسار | الوصف | الحالة |
|------|--------|-------|--------|
| `README.md` | `/` | دليل رئيسي | 🟢 Active |
| `ARCHITECTURE.md` | `/` | البنية المعمارية | 🟢 Active |
| `FILE_INDEX.md` | `/` | فهرس الملفات | 🟢 Active |
| `README_DEPLOYMENT.md` | `/` | دليل النشر | 🟢 Active |
| `VERCEL_SETUP_INSTRUCTIONS.md` | `/` | إعداد Vercel | 🟢 Active |

---

## 📊 إحصائيات

### حسب الحالة
```
🟢 Active Files: 60+
🟡 Old Versions: 12
🔴 Archived: 1
🔵 Test/Demo: 5
⚙️ Configuration: 12
```

### حسب النوع
```
Components: 25
Core Engines: 6
Libraries: 10
Hooks: 2
Config: 2
Routing: 2
Types: 1
Utils: 3
API Routes: 6
Documentation: 5
```

### حسب الأولوية
```
⭐ Critical: 20
⭐ Important: 15
🔵 Normal: 10
🟡 Low: 25
```

---

## 🔍 دليل البحث السريع

### أين أجد...?

#### نظام الطوابير
```
Core Logic: core/advanced-queue-engine.js
API: lib/local-api.js (enterQueue, completeQueue)
UI: components/PatientPage.jsx
Monitoring: components/AdminQueueMonitor.jsx
```

#### نظام المصادقة
```
Service: lib/auth-service.js
UI (Admin): components/admin/AdminLoginPage.jsx
UI (Patient): components/LoginPage.jsx
Config: config/admin-credentials.js
```

#### نظام PIN
```
Engine: core/pin-engine.js
API: lib/local-api.js (completeQueue validation)
Monitoring: components/AdminPINMonitor.jsx
```

#### المسارات الديناميكية
```
Logic: lib/dynamic-pathways.js
Engine: core/path-engine.js
Services: core/routing/*.ts
```

#### الإشعارات
```
Engine: core/notification-engine.js
System: components/NotificationSystem.jsx
Panel: components/NotificationPanel.jsx
Page: components/NotificationsPage.jsx
```

#### الثيمات
```
Themes: lib/enhanced-themes.js
Selector: components/EnhancedThemeSelector.jsx
```

#### الترجمة
```
Service: lib/i18n.js
Usage: import { t } from '../lib/i18n'
```

---

## 🛠️ للصيانة

### قبل تعديل ملف:
1. تحقق من حالته في هذا الفهرس
2. تحقق من الملفات المرتبطة
3. ابحث عن imports في المشروع
4. راجع ARCHITECTURE.md

### لإضافة ملف جديد:
1. حدد المجلد المناسب
2. اتبع naming convention
3. أضفه في هذا الفهرس
4. حدّث ARCHITECTURE.md
5. أضف تعليق في الكود

### لأرشفة ملف:
1. انقله إلى _archived/
2. حدّث imports
3. اختبر المشروع
4. حدّث هذا الفهرس
5. وثّق السبب

---

<div align="center">

**Version:** 2.0.0  
**Last Updated:** November 4, 2025  
**Total Files Indexed:** 90+

Made for easy maintenance 🛠️

</div>
