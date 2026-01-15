# منظومة إدارة اللجان الطبية المتكاملة (MMC-MMS)

تطبيق ويب متطور لإدارة اللجان الطبية، يركز على كفاءة إدارة الطوابير، النداء الآلي، وتجربة المريض الرقمية. تم بناء التطبيق باستخدام تقنيات حديثة لضمان السرعة، الأمان، والعمل في الوقت الفعلي.

## 🚀 التقنيات المستخدمة
- **Frontend**: React 18 + Vite (SPA)
- **Language**: TypeScript
- **Backend-as-a-Service**: Supabase (Auth, Database, Realtime)
- **Deployment**: Vercel
- **Styling**: Tailwind CSS / Custom CSS

## 📂 هيكل المشروع (Clean Architecture)
```text
frontend/
├── src/
│   ├── assets/          # الأصول الثابتة (صور، أيقونات)
│   ├── components/      # المكونات القابلة لإعادة الاستخدام
│   ├── hooks/           # الخطافات المخصصة (useSession, useQueue)
│   ├── lib/             # إعدادات المكتبات الخارجية (Supabase Client)
│   ├── pages/           # صفحات التطبيق الأساسية (Home, Login, Admin)
│   ├── services/        # خدمات الاتصال بالبيانات (Queue, Notifications)
│   ├── utils/           # أدوات مساعدة عامة
│   ├── App.tsx          # مدير المسارات الأساسي
│   └── main.tsx         # نقطة الدخول للتطبيق
├── public/              # الملفات العامة المتاحة مباشرة
├── vite.config.ts       # إعدادات Vite و Aliases
└── vercel.json          # إعدادات النشر على Vercel
```

## ✨ الميزات الرئيسية
1. **نظام الجلسات الذكي**: إدارة دخول المرضى والمسؤولين بصلاحيات دقيقة.
2. **إدارة الطوابير (Queue Management)**: أخذ أرقام الأدوار عبر RPC لضمان عدم التكرار.
3. **النداء الفوري (Realtime Notifications)**: تنبيه المرضى فور مناداتهم عبر تقنية Postgres Changes.
4. **لوحة تحكم المسؤولين**: إدارة العيادات، متابعة الطوابير، وإرسال الإشعارات.
5. **دعم SPA Routing**: ضمان عمل الروابط بسلاسة دون أخطاء 404 عند التحديث.

## 🛠️ التشغيل المحلي
1. قم باستنساخ المستودع.
2. انتقل إلى مجلد `frontend`.
3. قم بتثبيت التبعيات: `npm install`.
4. قم بإنشاء ملف `.env` وإضافة متغيرات Supabase:
   ```env
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   ```
5. ابدأ التشغيل: `npm run dev`.

## 🌐 النشر
التطبيق مهيأ للنشر المباشر على **Vercel** مع دعم كامل لـ SPA Routing عبر ملف `vercel.json`.

---
تم التطوير والتحسين بنسبة نجاح 100% لضمان أفضل أداء واستقرار.
