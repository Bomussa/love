# دليل هيكل مشروع «الملازم غانم» (تجميع نظيف)

هذا الدليل يوضح البنية المنظمة للملفات الأساسية للتشغيل والبناء والنشر، مع شرح دور كل مسار، لتسهيل الصيانة وفهم التطبيق بالكامل.

## نظرة عامة
- نوع التطبيق: واجهة أمامية Vite + React 18 + Tailwind CSS + تعبيرات خلفية Express (جاهزة) + PostgreSQL (اختياري لاحقاً)
- اللغة الافتراضية: العربية مع دعم الإنجليزية وتبديل فوري RTL/LTR
- الثيمات: 6 ثيمات محفوظة محلياً (localStorage)
- الإشعارات: Server-Sent Events (SSE) مع مخزن مؤقت لإعادة البث
- التخزين: localStorage حالياً + ملفات JSON (لمنظومة السيرفر عندما تكون فعّالة)

## المخطط الهيكلي (مختصر)

- config/
  - routeMap.json: تعريف مسارات العيادات والمسارات السريرية
- data/ ...: ملفات JSON دائمة (settings, routes, reports، إلخ)
- db/ ...: تهيئة قاعدة البيانات (PostgreSQL)
- deploy/ ...: سكربتات النشر (Cloudflare Tunnel, systemd)
- dist_server/ ...: الكود المترجم للسيرفر (Express)
- infra/ ...: سكربتات مساعدة (health, worker-api)
- public/
  - index.html, manifest, images
- src/
  - App.jsx: نقطة دخول الواجهة (حالة التنقل + SSE + الثيم)
  - main.jsx, index.ts
  - components/ ...: المكونات (LoginPage, ExamSelectionPage, PatientPage, AdminPage, ...)
  - lib/
    - api.js: عميل API resilient مع fallbacks للتطوير
    - i18n.js: الترجمات وتغيير اللغة
    - enhanced-themes.js: تعريف الثيمات والدوال المساعدة
    - utils.js: الأدوات (مسارات العيادات حسب الفحص والجنس)
  - middle/ ...: وسيطات وخدمات مشتركة (للإشعارات، SSE buffer)
  - pages/, reports/, security/, types/, utils/
- theme/
  - palette.json, tokens.css: تعريفات الألوان والرموز
- tools/
  - system-check.ps1: فحص النظام والخدمات
  - assemble-project.js: سكربت التجميع الحالي
  - deploy/*, build/*, verify/*: أدوات البناء والنشر والتحقق
- package*.json, vite.config.js, tailwind.config.js, postcss.config.js, docker-compose.yml
- start-mms.ps1: تشغيل الإنتاج محلياً

## التشغيل
- تطوير:
  - npm run dev
- إنتاج:
  - npm run build (يبني الواجهة + يتحقق من السيرفر إذا موجود)
  - npm start (تشغيل السيرفر الإنتاجي)

## النشر
- Docker + PostgreSQL عبر docker-compose.yml
- Cloudflare Tunnel (اختياري) عبر deploy/

## الإشعارات (SSE)
- endpoint: /api/events
- أنواع الأحداث: NEAR_TURN, YOUR_TURN, STEP_DONE_NEXT
- واجهة الويب تُظهر رسائل ثنائية اللغة حسب اللغة الحالية

## PIN ومسار العيادة
- إصدار PIN: POST /api/pin/issue
- تحقق PIN: POST /api/pin/validate
- دخول العيادة: POST /api/queue/enter
- إنهاء العيادة: POST /api/queue/complete
- الواجهة: العيادة الأولى تتطلب PIN للخروج فقط؛ الدخول بدون PIN مع أيقونة خضراء عند الدخول

## أفضل الممارسات
- لا تغيّر أسماء الثيمات أو مفاتيح localStorage
- حافظ على RTL عند العربية
- فعّل SSE عند توفر الخادم؛ استخدم المحاكاة فقط خلال التطوير

## ملاحظات
- تم استبعاد مجلدات الاختبارات والنسخ الاحتياطية واللقطات لضمان مشروع عمل نظيف.
