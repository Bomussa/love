# إعدادات Vercel المطلوبة لمشروع love

## معلومات المشروع
- **Project ID:** `prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM`
- **Team ID:** `team_aFtFTvzgabqENB5bOxn4SiO7`
- **Project Name:** love

## الإعدادات المطلوبة (Settings → Build & Development Settings)

### Framework Preset
```
Vite
```

### Node.js Version
```
20.x
```

### Install Command
```
npm install
```

### Build Command
```
npm run build
```

### Output Directory
```
dist
```

### Root Directory
```
(فارغ - يعني الجذر /)
```

**مهم جدًا:** يجب أن يكون حقل Root Directory **فارغًا تمامًا** أو يحتوي على `.` فقط.

## المتغيرات البيئية المطلوبة (Settings → Environment Variables)

يجب التأكد من وجود هذه المتغيرات لجميع البيئات (Development, Preview, Production):

```
VITE_API_BASE=https://mmc-mms.com/api/v1
UPSTREAM_API_BASE=https://rujwuruuosffcazymit.supabase.co/functions/v1
FRONTEND_ORIGIN=https://mmc-mms.com
VITE_SUPABASE_URL=(القيمة الموجودة)
VITE_SUPABASE_ANON_KEY=(القيمة الموجودة)
```

## خطوات التطبيق اليدوي

1. افتح https://vercel.com/bomussa/love/settings
2. اذهب إلى **Build & Development Settings**
3. تأكد من الإعدادات أعلاه بالضبط
4. احفظ التغييرات
5. ارجع إلى **Deployments** → اختر آخر deployment → **Redeploy**

## التحقق من النجاح

بعد إعادة النشر، يجب أن:
- ✅ لا يظهر `Could not read package.json`
- ✅ لا يظهر `Missing script: "build"`
- ✅ لا يظهر تحذير `vercel.json … root directory`
- ✅ ينتهي البناء بـ `Ready` ومجلد الإخراج `dist`
