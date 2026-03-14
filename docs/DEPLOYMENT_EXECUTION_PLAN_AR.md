# خطة تنفيذ مؤكدة لاستعادة النشر (Frontend + Supabase Integration)

## 1) النطاق الفعلي
- **Frontend**: مستودع `love` على Vercel (`prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM`).
- **Backend Runtime**: Supabase Functions المشار إليها من `vercel.json` عبر rewrite `/api/(.*)`.

## 2) خطة التنفيذ الدقيقة (Timeline)
1. **T0-T10m (Audit سريع إلزامي)**
   - التحقق من `vercel.json` محليًا.
   - التحقق من إعدادات المشروع على Vercel عبر API (`--check`).
2. **T10-T20m (Apply)**
   - فرض إعدادات الاستعادة عبر API (`--apply`).
3. **T20-T35m (Deploy + Monitor)**
   - إطلاق Production deployment (`--redeploy --wait`).
4. **T35-T50m (Smoke Tests)**
   - التحقق من الدومين الأساسي و`www`.
   - التحقق من `/api/api-v1-status`.
5. **T50-T60m (Closure)**
   - توثيق النتيجة + نقطة rollback الجاهزة.

### جدول القرار لكل مرحلة

| المرحلة | الشرط المطلوب | الأمر المستخدم | معيار النجاح | إجراء عند الفشل |
|---|---|---|---|---|
| T0-T10m Audit | الوصول إلى مستودع `love` ووجود `vercel.json` متوافق مع rewrite `/api/(.*)` | `node scripts/vercel-recover-deploy.mjs --check` | لا توجد حالات mismatch في الإعدادات الحرجة (project/build/output/env domains) | إيقاف التنفيذ، توثيق عنصر mismatch، ثم تصحيح الإعدادات قبل أي `--apply` |
| T10-T20m Apply | نجاح مرحلة Audit بنسبة قبول >= 98% وغياب أخطاء صلاحيات API | `node scripts/vercel-recover-deploy.mjs --apply` | تم تطبيق جميع الإعدادات المطلوبة دون أخطاء HTTP 4xx/5xx | rollback فوري إلى snapshot الإعدادات السابقة عبر PATCH ثم إعادة التحقق |
| T20-T35m Deploy | الإعدادات المطبقة صحيحة ومرتبطة بالمشروع `prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM` | `node scripts/vercel-recover-deploy.mjs --redeploy --wait` | deployment بحالة `READY` على production | إلغاء الاستمرار، جمع deployment logs، إصلاح سبب الفشل، ثم إعادة النشر |
| T35-T50m Smoke Tests | وجود deployment production جاهز | `curl -I https://mmc-mms.com && curl -I https://www.mmc-mms.com && curl https://mmc-mms.com/api/api-v1-status` | الدومين الأساسي و`www` يعرضان نفس التجربة، وAPI health لا ترجع 5xx | rollback إلى آخر deployment مستقر + فتح incident مع سبب واضح |
| T50-T60m Closure | اكتمال smoke/UAT وتوثيق الأدلة | `date -u && node scripts/vercel-recover-deploy.mjs --check` | توثيق كامل للأدلة والزمن ونتائج الفحوصات مع قرار Go/No-Go | اعتبار النشر غير مكتمل، منع الإغلاق، وإعادة الجولة من T0 |

## 3) احتمالات الفشل + التعامل
- **فشل اتصال API (Network/Proxy)**: إعادة التشغيل من بيئة CI مع اتصال مباشر.
- **غياب ربط Git في Vercel project.link**: تنفيذ Redeploy يدوي من Dashboard بعد `--apply`.
- **فشل Deployment**: جمع logs من deployment ID وتصحيح build/runtime ثم إعادة النشر.

## 4) Rollback points
1. قبل `--apply`: snapshot لإعدادات المشروع الحالية.
2. بعد `--apply` وقبل `--redeploy`: إمكانية العودة للإعدادات السابقة فورًا عبر PATCH.
3. بعد نشر production: إن فشل smoke/UAT يتم Promote لآخر deployment جاهز.

## 4.1) Rollback Trigger Matrix (إيقاف النشر فورًا)

| Trigger | مؤشّر الإيقاف الفوري | العتبة | الإجراء الفوري |
|---|---|---|---|
| فشل إعدادات حرجة | mismatch في domains / rewrites / env vars الحرجة | أي mismatch غير مبرر | **STOP** + rollback للإعدادات السابقة قبل المتابعة |
| فشل نشر Production | deployment status = `ERROR` أو timeout | أول محاولة فاشلة بعد `--redeploy --wait` | **STOP** + جمع logs + rollback لآخر deployment مستقر |
| فشل صحة API | endpoint `/api/api-v1-status` يُرجع 5xx أو timeout متكرر | فشلان متتاليان خلال 5 دقائق | **STOP** + rollback فوري + تحقيق سبب runtime |
| فشل تماثل الدومين | `www` لا يعرض نفس المحتوى المتوقع من `mmc-mms.com` | تباين وظيفي مؤكد في مسارين متتاليين | **STOP** + rollback + إصلاح DNS/redirects |
| ارتفاع الفشل العام | نسبة الفشل > 10% في فحوصات Go/No-Go | تجاوز العتبة في أي مرحلة | **STOP** كامل وعدم الترويج لأي release |
| اختراق معيار القبول | نسبة النجاح < 98% | أي جولة تحقق أقل من 98% | **NO-GO** + rollback/إعادة تنفيذ الخطة |

## 5) اختبارات ما قبل/بعد النشر
- Build محلي: `npm run build --workspace frontend`.
- تحقق الإعدادات: `node scripts/vercel-recover-deploy.mjs --check`.
- تحقق إنتاجي:
  - `curl -I https://mmc-mms.com`
  - `curl -I https://www.mmc-mms.com`
  - `curl https://mmc-mms.com/api/api-v1-status`

## 5.1) Post-Deploy Monitoring (أول 30 دقيقة، كل 5 دقائق)

> الهدف: منع النجاح الوهمي عبر متابعة متكررة لمدة 30 دقيقة بعد تفعيل production.

| الوقت بعد النشر | الفحوصات | مؤشرات الصحة (KPIs) | قاعدة القرار |
|---|---|---|---|
| +0m | Head requests للدومينين + API health | `2xx/3xx` للدومينين، وAPI زمن استجابة < 1500ms | إذا فشل أي مؤشر: فتح incident فوري |
| +5m | إعادة الفحوصات + مراجعة deployment logs | عدم وجود spikes أخطاء 5xx | فشل متكرر مرتين = rollback |
| +10m | تحقق تماثل المحتوى بين `www` وroot | نفس المحتوى/المسار المتوقع للمستخدم | أي divergence = rollback |
| +15m | API health + latency trend | ثبات latency وعدم تزايد حاد | انحدار مستمر = تفعيل خطة rollback |
| +20m | فحص DNS/redirect headers | redirects صحيحة وبدون loop | loop أو misroute = rollback |
| +25m | إعادة smoke كاملة | نجاح >= 98% | أقل من ذلك = NO-GO |
| +30m | Final gate review | نجاح شامل + لا incident مفتوح P1/P0 | إعلان الاستقرار أو rollback |

**أوامر التنفيذ المقترحة لكل interval (5m):**
- `curl -s -o /dev/null -w "%{http_code} %{time_total}\n" https://mmc-mms.com`
- `curl -s -o /dev/null -w "%{http_code} %{time_total}\n" https://www.mmc-mms.com`
- `curl -s -o /dev/null -w "%{http_code} %{time_total}\n" https://mmc-mms.com/api/api-v1-status`

## 5.2) Evidence Checklist

- رابط deployment المستخدم في الإنتاج (Production URL + Deployment ID).
- timestamp UTC لبداية `--apply` ونهايته.
- timestamp UTC لبداية `--redeploy --wait` ونهايته.
- نتيجة `--check` قبل التطبيق وبعده (قبل/بعد).
- مخرجات فحوصات الدومين:
  - `https://mmc-mms.com`
  - `https://www.mmc-mms.com`
- نتائج API health (`/api/api-v1-status`) مع أكواد HTTP وزمن الاستجابة.
- سجل قرارات Go/No-Go مع سبب القرار بالأرقام (نجاح/فشل %).
- رابط/مرجع logs في Vercel/Supabase عند وجود incident.

> لا يُغلق التنفيذ بدون الأدلة أعلاه؛ أي بند مفقود يعني أن حالة النشر **غير مكتملة**.

## 5.3) Known Environment Limitations

- **Proxy Caching**: قد يعيد proxy استجابة 200 من cache بينما الـorigin غير صحي؛ لذلك يلزم فحص headers وزمن الاستجابة وتكرار الطلب.
- **WAF Challenge/Bypass**: قد تظهر استجابة 200/302 ناتجة عن صفحة تحدّي WAF وليس التطبيق الفعلي؛ يجب التحقق من body/headers الدالة على origin الحقيقي.
- **DNS Propagation Delay**: بعد أي تعديل DNS قد تظهر نتائج متفاوتة جغرافيًا؛ لا تُعتبر النتيجة ناجحة حتى ثبات النتائج عبر القياسات المتكررة.
- **Transient Network Errors**: timeout عابر وحيد لا يُعد فشلًا نهائيًا، لكن التكرار في قياسين متتاليين يفعّل rollback trigger.
- **False Positive from Single Probe**: الاعتماد على فحص وحيد غير كافٍ؛ النجاح يعتمد على سلسلة فحوصات 30 دقيقة وليس نقطة زمنية واحدة.

## 6) معايير الإغلاق
- لا mismatch في إعدادات Vercel الأساسية.
- deployment production بحالة `READY`.
- استجابة النطاقين سليمة، و`www` يطابق مسار العرض المتفق.
- endpoint الصحي لا يرجع 5xx.
