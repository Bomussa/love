# البيانات التشغيلية الحالية - 30 أكتوبر 2025

## مصدر البيانات
جميع البيانات التالية تم جمعها مباشرة من الأنظمة الحية عبر APIs في تاريخ 30 أكتوبر 2025.

---

## 1. بيانات Vercel الحالية (من API مباشرة)

### معلومات المشروع

```json
{
  "project_id": "prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM",
  "project_name": "love",
  "framework": "vite",
  "team_id": "team_aFtFTvzgabqENB5bOxn4SiO7",
  "team_name": "bomousa-mmc",
  "node_version": "20.x",
  "created_at": 1761345303919,
  "updated_at": 1761824219708,
  "live": false
}
```

### النطاقات الحالية
- `mmc-mms.com`
- `love-bomussa.vercel.app`
- `love-mmc-mms-bomussa.vercel.app`
- `www.mmc-mms.com`

### آخر نشر (Production)
```json
{
  "deployment_id": "dpl_BhZwBgDnZJqgvDtML38xMMJ5Br1b",
  "url": "love-p3mq9bd48-bomussa.vercel.app",
  "created_at": 1761824188406,
  "state": "READY",
  "target": "production",
  "commit_sha": "1e03b92bbf56e7aaa3228d222ac23085dd8ca751",
  "commit_message": "fix: إصلاح replace للمسارات - استبدال شامل بـ /g"
}
```

---

## 2. بيانات GitHub الحالية (من git pull)

### آخر commit في main
```
1e03b92 fix: إصلاح replace للمسارات - استبدال شامل بـ /g
```

### package.json الحالي
```json
{
  "name": "medical-center-complete",
  "version": "1.0.0",
  "type": "module",
  "description": "Military Medical Committee System - Complete Application",
  "engines": {
    "node": ">=18.17 <21"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@supabase/supabase-js": "^2.77.0",
    "axios": "^1.12.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "cors": "^2.8.5",
    "date-fns": "^2.30.0",
    "dotenv": "^17.2.3",
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "lucide-react": "^0.294.0",
    "qrcode": "^1.5.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hot-toast": "^2.4.1",
    "tailwind-merge": "^2.0.0",
    "tailwindcss-animate": "^1.0.7",
    "ws": "^8.14.2"
  }
}
```

---

## 3. معلومات Access Tokens الحالية

### Vercel Token (من الصورة الأخيرة)
- **الاسم:** manus
- **النطاق:** Full Account
- **الصلاحية:** 1 Day
- **ينتهي في:** 31/10/2025
- **الرمز:** V9773imAQMYE3D2fEChnrZCJ

### Supabase Token (من الصور السابقة)
- **الاسم:** gpt
- **النطاق:** Full Account
- **الصلاحية:** 60 Days
- **ينتهي في:** 28/12/2025
- **الرمز:** 1ovD1J6nsobmg23G5GyQ1LA0

---

## 4. ملخص الحالة الحالية

### الحالة التشغيلية
- ✅ Vercel Deployment: READY (production)
- ✅ GitHub Repository: متزامن
- ✅ Node Version: 20.x
- ✅ Framework: Vite

### المستودعات المتصلة
1. **Bomussa/love** (رئيسي)
2. **Bomussa/mms**
3. **Bomussa/love-api**
4. **Bomussa/fix**

---

**تاريخ التقرير:** 30 أكتوبر 2025 - 08:17 UTC  
**المصدر:** Vercel API + GitHub + Live Systems

---

## 5. بيانات Supabase الحالية (من Management API)

### معلومات المشروع
```json
{
  "project_id": "rujwuruuosffcxazymit",
  "organization_id": "wkjhsmalzkikvaosxvib",
  "name": "MMC-MMS",
  "region": "ap-southeast-1",
  "status": "ACTIVE_HEALTHY",
  "database": {
    "host": "db.rujwuruuosffcxazymit.supabase.co",
    "version": "17.6.1.025",
    "postgres_engine": "17",
    "release_channel": "ga"
  },
  "created_at": "2025-10-25T10:14:25.79233Z"
}
```

### Edge Functions المنشورة (22 دالة)
1. `health` - فحص صحة النظام
2. `queue-enter` - دخول الطابور
3. `queue-status` - حالة الطابور
4. `queue-call` - استدعاء المريض
5. `pin-status` - حالة الرقم السري
6. `admin-login` - تسجيل دخول المشرف
7. `patient-login` - تسجيل دخول المريض
8. `admin-status` - حالة المشرف
9. `admin-set-call-interval` - تعيين فترة الاستدعاء
10. `queue-done` - إنهاء الطابور
11. `queue-position` - موقع في الطابور
12. `queue-cancel` - إلغاء من الطابور
13. `pin-generate` - توليد رقم سري
14. `route-create` - إنشاء مسار
15. `route-get` - الحصول على مسار
16. `path-choose` - اختيار مسار
17. `clinic-exit` - خروج من العيادة
18. `stats-dashboard` - إحصائيات لوحة التحكم
19. `stats-queues` - إحصائيات الطوابير
20. `events-stream` - بث الأحداث
21. `notify-status` - حالة الإشعارات
22. `metrics` - المقاييس

### نقاط النهاية (Endpoints)
- **API URL:** `https://rujwuruuosffcxazymit.supabase.co`
- **Database Host:** `db.rujwuruuosffcxazymit.supabase.co`
- **Storage:** `https://rujwuruuosffcxazymit.storage.supabase.co`
- **Functions:** `https://rujwuruuosffcxazymit.supabase.co/functions/v1/`

### الحالة
- ✅ Status: `ACTIVE_HEALTHY`
- ✅ Database: PostgreSQL 17.6.1
- ✅ Region: `ap-southeast-1` (Singapore)
- ✅ Total Edge Functions: 22

---

**آخر تحديث:** 30 أكتوبر 2025 - 08:30 UTC  
**المصدر:** Supabase Management API (Live Data)
