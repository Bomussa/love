# 🏗️ البنية المعمارية الكاملة - Medical Queue Management System

## 📑 جدول المحتويات
1. [نظرة عامة](#نظرة-عامة)
2. [خارطة الملفات الكاملة](#خارطة-الملفات-الكاملة)
3. [Flow Diagrams](#flow-diagrams)
4. [الملفات المستخدمة vs المؤرشفة](#الملفات-المستخدمة-vs-المؤرشفة)
5. [Dependencies](#dependencies)

---

## نظرة عامة

### Stack التقني
```
┌─────────────────────────────────────────┐
│         Frontend (React + Vite)         │
│  ┌───────────────────────────────────┐  │
│  │     Components Layer              │  │
│  │  - LoginPage, PatientPage, Admin  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │     Core Business Logic           │  │
│  │  - Queue Engine, Event Bus, PIN   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │     API & Services Layer          │  │
│  │  - Unified API, Local Storage     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────┐
│        Backend (FastAPI + MongoDB)      │
│  - REST API Endpoints                   │
│  - Database Operations                  │
│  - Business Logic                       │
└─────────────────────────────────────────┘
```

---

## خارطة الملفات الكاملة

### 📦 Frontend Structure (Detailed)

```
frontend/
├── public/
│   ├── img/
│   │   ├── logo.png                    # شعار المركز
│   │   └── icons/                      # أيقونات
│   ├── js/
│   │   └── external-libs/              # مكتبات خارجية
│   ├── index.html                      # ⚠️ Static (unused in SPA)
│   └── *.html                          # ⚠️ Test pages
│
├── src/
│   ├── components/                     # ⭐ React Components
│   │   │
│   │   ├── admin/                      # 🔐 Admin-only
│   │   │   ├── AdminLoginPage.jsx      # ⭐ Login for admins
│   │   │   └── AdvancedDashboard.jsx   # ⭐ Advanced analytics
│   │   │
│   │   ├── AdminPage.jsx               # ⭐ Main Admin Panel
│   │   ├── PatientPage.jsx             # ⭐ Patient Queue View
│   │   ├── LoginPage.jsx               # ⭐ Patient/Admin Login
│   │   ├── ExamSelectionPage.jsx       # ⭐ Select Exam Type
│   │   ├── CompletePage.jsx            # ⭐ Completion Screen
│   │   │
│   │   ├── QRScanner.jsx               # ⭐ QR Code Scanner
│   │   ├── CountdownTimer.jsx          # ⭐ Timer with Progress
│   │   │
│   │   ├── AdminExtendTime.jsx         # ⭐ Time Extension UI
│   │   ├── AdminPINMonitor.jsx         # 📊 PIN Management
│   │   ├── AdminQueueMonitor.jsx       # 📊 Queue Monitoring
│   │   ├── AdminQrManager.jsx          # 📊 QR Management
│   │   │
│   │   ├── NotificationSystem.jsx      # 🔔 Notifications
│   │   ├── NotificationPanel.jsx       # 🔔 Panel
│   │   ├── NotificationsPage.jsx       # 🔔 Page
│   │   │
│   │   ├── ClinicsConfiguration.jsx    # ⚙️ Clinic Config
│   │   ├── SystemSettingsPanel.jsx     # ⚙️ System Settings
│   │   ├── PatientsManagement.jsx      # 👥 Patient Management
│   │   │
│   │   ├── EnhancedAdminDashboard.jsx  # ⚠️ Old version
│   │   ├── EnhancedThemeSelector.jsx   # 🎨 Theme Selector
│   │   ├── ZFDTicketDisplay.jsx        # 🎫 Ticket Display
│   │   │
│   │   ├── Button.jsx                  # 🧱 UI Component
│   │   ├── Card.jsx                    # 🧱 UI Component
│   │   ├── Input.jsx                   # 🧱 UI Component
│   │   ├── Header.jsx                  # 🧱 UI Component
│   │   └── QrScanPage.jsx              # 📱 QR Scan Page
│   │
│   ├── core/                           # ⭐ Business Logic Core
│   │   │
│   │   ├── advanced-queue-engine.js    # ⭐ ACTIVE: Advanced Queue
│   │   │   # Features:
│   │   │   # - Dual timers (2min clinic, 5min patient)
│   │   │   # - Auto-move to end after 4min
│   │   │   # - Smart warnings
│   │   │
│   │   ├── event-bus.js                # ⭐ ACTIVE: Event System
│   │   │   # Features:
│   │   │   # - Publish/Subscribe pattern
│   │   │   # - SSE integration (disabled)
│   │   │   # - Cross-component communication
│   │   │
│   │   ├── pin-engine.js               # ⭐ ACTIVE: PIN Management
│   │   │   # Features:
│   │   │   # - Daily PIN generation
│   │   │   # - Clinic-specific PINs
│   │   │   # - Validation logic
│   │   │
│   │   ├── path-engine.js              # ⭐ ACTIVE: Pathway Logic
│   │   │   # Features:
│   │   │   # - Dynamic path selection
│   │   │   # - Load balancing
│   │   │   # - Path caching
│   │   │
│   │   ├── queue-engine.js             # ⭐ ACTIVE: Basic Queue
│   │   │   # Features:
│   │   │   # - FIFO queue management
│   │   │   # - Queue status tracking
│   │   │   # - Basic operations
│   │   │
│   │   ├── notification-engine.js      # ⭐ ACTIVE: Notifications
│   │   │   # Features:
│   │   │   # - Real-time notifications
│   │   │   # - Audio alerts
│   │   │   # - Priority system
│   │   │
│   │   ├── config/
│   │   │   └── refresh.constants.js    # Refresh intervals
│   │   │
│   │   ├── routing/
│   │   │   ├── routeMapService.ts      # Route mapping
│   │   │   └── routeService.ts         # Route service
│   │   │
│   │   ├── pinService.ts               # ⚠️ TypeScript version
│   │   └── queueManager.ts             # ⚠️ TypeScript version
│   │
│   ├── lib/                            # ⭐ Libraries & Services
│   │   │
│   │   ├── api-unified.js              # ⭐ ACTIVE: Unified API
│   │   │   # Features:
│   │   │   # - Fallback to local-api
│   │   │   # - Request routing
│   │   │   # - Error handling
│   │   │
│   │   ├── local-api.js                # ⭐ ACTIVE: Local Storage API
│   │   │   # Features:
│   │   │   # - 100% client-side
│   │   │   # - localStorage persistence
│   │   │   # - Mock data generation
│   │   │
│   │   ├── auth-service.js             # ⭐ ACTIVE: Authentication
│   │   │   # Features:
│   │   │   # - JWT-style tokens
│   │   │   # - Role-based access
│   │   │   # - Session management
│   │   │   # - Security logs
│   │   │
│   │   ├── mms-core-api.js             # ⭐ ACTIVE: MMS Integration
│   │   │   # Features:
│   │   │   # - External API connection
│   │   │   # - Fallback handling
│   │   │
│   │   ├── dynamic-pathways.js         # ⭐ ACTIVE: Dynamic Routing
│   │   │   # Features:
│   │   │   # - Exam-specific paths
│   │   │   # - Load-based routing
│   │   │   # - 80% balance score
│   │   │
│   │   ├── enhanced-themes.js          # ⭐ ACTIVE: Theme System
│   │   │   # Themes:
│   │   │   # - Medical Professional
│   │   │   # - Medical Calm
│   │   │   # - Medical Warm
│   │   │   # - Classic
│   │   │
│   │   ├── i18n.js                     # ⭐ ACTIVE: i18n
│   │   │   # Languages: Arabic, English
│   │   │
│   │   ├── utils.js                    # ⭐ ACTIVE: Utilities
│   │   ├── settings.js                 # ⭐ ACTIVE: Settings
│   │   ├── workflow.js                 # ⭐ ACTIVE: Workflow
│   │   │
│   │   ├── api.js                      # ⚠️ Old API (replaced)
│   │   ├── enhanced-api.js             # ⚠️ Old enhanced (replaced)
│   │   ├── api-adapter.js              # ⚠️ Adapter (unused)
│   │   ├── db.js                       # ⚠️ Old DB (replaced)
│   │   ├── offline-storage.js          # ⚠️ Old storage (replaced)
│   │   ├── unified-storage.js          # ⚠️ Old unified (replaced)
│   │   ├── queueManager.js             # ⚠️ Old manager (replaced)
│   │   └── routingManager.js           # ⚠️ Old routing (replaced)
│   │
│   ├── config/
│   │   └── admin-credentials.js        # ⭐ Admin credentials
│   │
│   ├── hooks/                          # ⭐ React Hooks
│   │   ├── useQueueWatcher.js          # Real-time queue updates
│   │   └── useSmartUpdater.js          # Smart refresh
│   │
│   ├── pages/                          # ⚠️ API Routes (CF Workers)
│   │   └── api/
│   │       ├── admin/
│   │       │   └── settings.js
│   │       ├── patient/
│   │       │   └── enqueue.js
│   │       ├── queue/
│   │       │   ├── call-next.js
│   │       │   ├── complete.js
│   │       │   └── status.js
│   │       └── system/
│   │           └── tick.js
│   │
│   ├── types/                          # TypeScript Types
│   │   └── config.d.ts
│   │
│   ├── utils/                          # ⚠️ TypeScript Utils
│   │   ├── fs-atomic.ts
│   │   ├── logger.ts
│   │   └── time.ts
│   │
│   ├── _archived/                      # ⚠️ Archived Files
│   │   └── queue-engine.backup.js      # Old backup
│   │
│   ├── App.jsx                         # ⭐ Main App Component
│   ├── main.jsx                        # ⭐ Entry Point
│   └── api/
│       └── index.ts                    # ⚠️ API index (unused)
│
├── .env                                # ⭐ Environment Variables
├── package.json                        # ⭐ Dependencies
├── vite.config.js                      # ⭐ Vite Config
├── tailwind.config.js                  # ⭐ Tailwind Config
└── yarn.lock                           # Yarn lock file

Legend:
⭐ = Currently used / Critical
🔐 = Admin only
📊 = Monitoring/Analytics
🔔 = Notifications
⚙️ = Configuration
👥 = User management
🎨 = UI/Styling
🧱 = UI Building blocks
📱 = Mobile features
⚠️ = Archived/Old/Unused
```

---

## Flow Diagrams

### 1. Patient Flow (رحلة المريض)
```
┌────────────────┐
│  QR Scan /     │
│  Manual Entry  │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  LoginPage     │
│  - Enter ID    │
│  - Select Sex  │
└───────┬────────┘
        │
        ▼
┌─────────────────┐
│ ExamSelection   │
│ - Choose Exam   │
│ - Auto Pathway  │
└───────┬─────────┘
        │
        ▼
┌──────────────────┐
│ PatientPage      │
│ - View Queue     │
│ - Enter Clinic   │
│ - Enter PIN      │
│ - Move to Next   │
└───────┬──────────┘
        │ (Loop)
        ▼
┌──────────────────┐
│ CompletePage     │
│ - Success        │
│ - Download PDF   │
└──────────────────┘
```

### 2. Queue System Flow (نظام الطوابير)
```
┌─────────────────────────────────────────┐
│     Advanced Queue Engine               │
└─────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌────────────┐    ┌─────────────┐
│ 2min Timer │    │ 5min Timer  │
│ (Clinic)   │    │ (Patient)   │
│ - Internal │    │ - Visible   │
│ - Auto call│    │ - Warning   │
└─────┬──────┘    └──────┬──────┘
      │                  │
      │    ┌─────────────┘
      │    │
      ▼    ▼
┌──────────────────┐
│  After 2min:     │
│  - Call next     │
│  - Patient still │
│    has 3min      │
└──────────────────┘
      │
      ▼
┌──────────────────┐
│  After 4min:     │
│  - Show warning  │
│  - 1min left     │
└──────────────────┘
      │
      ▼
┌──────────────────┐
│  After 5min:     │
│  - Move to end   │
│  - New number    │
└──────────────────┘
```

### 3. Admin Flow (رحلة المسؤول)
```
┌────────────────┐
│ AdminLoginPage │
│ - Username     │
│ - Password     │
│ - Auth Service │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ AdminPage      │
│ - Dashboard    │
│ - Menu         │
└───────┬────────┘
        │
   ┌────┴────┬────────┬────────┬────────┐
   │         │        │        │        │
   ▼         ▼        ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Dash  │ │Queue │ │ PIN  │ │Extend│ │Stats │
│board │ │Monit.│ │Monit.│ │Time  │ │& Rep.│
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

---

## الملفات المستخدمة vs المؤرشفة

### ✅ Actively Used (60+ files)

#### Components (25 files)
```
LoginPage.jsx                 ⭐ Critical
PatientPage.jsx              ⭐ Critical
AdminPage.jsx                ⭐ Critical
ExamSelectionPage.jsx        ⭐ Important
CompletePage.jsx             ⭐ Important
QRScanner.jsx                ⭐ Important
CountdownTimer.jsx           ⭐ Important
AdminLoginPage.jsx           ⭐ Important
AdvancedDashboard.jsx        ⭐ Important
AdminExtendTime.jsx          ⭐ Important
Button.jsx, Card.jsx, Input.jsx
... (+ 12 more UI components)
```

#### Core (7 files)
```
advanced-queue-engine.js     ⭐ Critical
event-bus.js                 ⭐ Critical
pin-engine.js                ⭐ Critical
path-engine.js               ⭐ Critical
queue-engine.js              ⭐ Critical
notification-engine.js       ⭐ Important
```

#### Lib (10 files)
```
api-unified.js               ⭐ Critical
local-api.js                 ⭐ Critical
auth-service.js              ⭐ Critical
mms-core-api.js              ⭐ Important
dynamic-pathways.js          ⭐ Important
enhanced-themes.js           ⭐ Important
i18n.js                      ⭐ Important
utils.js                     ⭐ Important
settings.js, workflow.js
```

### ⚠️ Archived/Unused (15+ files)

#### Old API Versions
```
api.js                       → Replaced by api-unified.js
enhanced-api.js              → Replaced by api-unified.js
api-adapter.js               → Not used
```

#### Old Storage
```
db.js                        → Replaced by local-api.js
offline-storage.js           → Replaced by local-api.js
unified-storage.js           → Replaced by local-api.js
```

#### Old Managers
```
queueManager.js              → Replaced by advanced-queue-engine.js
routingManager.js            → Replaced by dynamic-pathways.js
```

#### Backups
```
queue-engine.backup.js       → Old backup (moved to _archived/)
```

#### TypeScript Duplicates
```
pinService.ts                → JS version exists (pin-engine.js)
queueManager.ts              → JS version exists (queue-engine.js)
```

#### Test Pages
```
public/*.html                → Static test pages (not used in SPA)
```

---

## Dependencies

### Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.1",
    "lucide-react": "^0.469.0",
    "@radix-ui/react-*": "Multiple UI components",
    "tailwindcss": "^3.4.15"
  },
  "devDependencies": {
    "vite": "^7.1.12",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.23.0"
  }
}
```

### Backend (requirements.txt)
```
fastapi
uvicorn
motor (MongoDB async driver)
pymongo
pydantic
```

---

## Configuration Files

### Important Config Files
```
vite.config.js          # Vite configuration
tailwind.config.js      # Tailwind CSS
vercel.json             # Vercel deployment
.vercelignore           # Vercel ignore
.env                    # Environment variables
package.json            # Node dependencies
```

---

## Data Flow

### 1. API Request Flow
```
Component
    ↓
api-unified.js
    ↓ (checks availability)
    ├─→ mms-core-api.js → External API
    │       ↓ (if fails)
    └─→ local-api.js → localStorage
            ↓
         Returns data
```

### 2. Event Flow
```
Action (e.g., Click button)
    ↓
Component calls method
    ↓
advanced-queue-engine.js updates state
    ↓
event-bus.js emits event
    ↓
All subscribed components receive update
    ↓
Components re-render
```

### 3. Authentication Flow
```
Login form submit
    ↓
auth-service.js validates
    ↓
Check failed attempts
    ↓
Validate credentials
    ↓
Create session token
    ↓
Store in localStorage
    ↓
Emit auth event
    ↓
App updates UI
```

---

## File Size Overview

### Largest Files
```
advanced-queue-engine.js    ~15 KB
auth-service.js             ~8 KB
local-api.js                ~30 KB
AdvancedDashboard.jsx       ~10 KB
AdminPage.jsx               ~20 KB
PatientPage.jsx             ~25 KB
```

### Total Size
```
Components: ~200 KB
Core: ~50 KB
Lib: ~100 KB
Total Source: ~350 KB
Built Bundle: ~466 KB (gzipped: ~140 KB)
```

---

## Best Practices for Maintenance

### Adding New Feature
1. Check if similar feature exists
2. Use existing patterns (e.g., event-bus for communication)
3. Follow naming conventions
4. Update this file

### Modifying Core Logic
1. Test in isolated environment first
2. Check all dependencies
3. Update related components
4. Run full test suite

### Deprecating File
1. Move to `_archived/`
2. Update imports in all files
3. Test thoroughly
4. Document in CHANGELOG

---

<div align="center">

**Version:** 2.0.0  
**Last Updated:** November 4, 2025  
**Maintainer:** Development Team

</div>
