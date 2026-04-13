# إعدادات البناء والنشر في Vercel

**المشروع:** love  
**التاريخ:** 08 نوفمبر 2025  
**المصدر:** https://vercel.com/bomussa/love/settings/build-and-deployment

---

## Framework Settings

### Framework Preset
```
Framework: Vite
```

### Build Command
```bash
cd frontend && npm run build
```

### Output Directory
```
frontend/dist
```

### Install Command
```bash
cd frontend && npm install
```

### Development Command
```
vite
```

---

## Root Directory

**القيمة:** (فارغ - الكود في الجذر)

**الإعدادات:**
- ✅ Include files outside the root directory: **Enabled**
- ❌ Skip deployments when no changes: **Disabled**

---

## Node.js Version

**الإصدار:** (افتراضي - آخر إصدار LTS)

---

## Build Performance

### Instant Build
- **الحالة:** Disabled
- **الوصف:** تسريع البناء بتخطي قائمة الانتظار

### Build Machine
- **النوع:** Standard performance
- **المواصفات:** 4 vCPUs, 8 GB Memory
- **الوصف:** خيار فعال من حيث التكلفة للتطبيقات الخفيفة

**الخيارات الأخرى:**
- Enhanced performance: 8 vCPUs, 16 GB Memory
- Turbo performance: 30 vCPUs, 60 GB Memory

---

## Deployment Checks

**الحالة:** No checks configured

---

## Rolling Releases

**الحالة:** Disabled

---

## Production Build Priority

**الحالة:** Enabled  
**الوصف:** بناء Production له أولوية على Pre-Production

---

## ملخص الإعدادات

```json
{
  "framework": "vite",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install",
  "devCommand": "vite",
  "rootDirectory": "",
  "includeFilesOutsideRoot": true,
  "skipDeploymentsOnNoChanges": false,
  "nodeVersion": "default",
  "buildMachine": "standard",
  "instantBuild": false,
  "productionBuildPriority": true
}
```

---

## vercel.json المقابل

```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install",
  "framework": "vite",
  "cleanUrls": true
}
```

---

**آخر تحديث:** 08 نوفمبر 2025
