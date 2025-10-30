# TESTING.md

## TDD
- ابدأ بوحدة التحقق (validation) ثم الحراسة (guards) ثم الموزّع (orchestration).

## أنواع الاختبارات
- Unit: التحقق التسلسلي، منع الازدواج، معالجة الأخطاء.
- Integration: رحلة كاملة PIN→EXIT→QUEUE.
- Negative: PIN خاطئ، جلسة غير صالحة، رقم مكرر، تعطّل Backend.
- Load: 100–300 جلسة متوازية.

## تشغيل
- وفّر عدّاد اختبار بسيط أو ادمج Runner المفضل لديك (Jest/Vitest) لاحقًا.
