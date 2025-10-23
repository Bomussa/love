# تعليمات النشر

1) إعداد البيئة
- انسخ `.env.example` إلى `.env.local` واملأ القيم الصحيحة.
- خزّن الأسرار في Secret Manager (لا تُcommmit).

2) البناء والتشغيل
```bash
npm i
npm run build
npm start
```

3) خلف وكيل عكسي/بوابة
- انشر middleware على نطاق ثابت، واجعل الواجهة تتحدث معه فقط.
- BE_BASE_URL يوجّه إلى Cloudflare API الموحد `/api/v1`.

4) الرجوع السريع
- عطّل Feature Flag في الواجهة للعودة إلى الاتصالات القديمة مؤقتًا.
