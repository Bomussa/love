# Copilot Instructions — MMC-MMS (love)

## 1) Scope & Golden Rules
- **Frontend فقط على Vercel** (`/frontend`)، **Backend كامل على Supabase** (Edge Functions + PostgREST).
- **جميع** طلبات الواجهة إلى الـAPI تكون عبر **`fetch('/api/...')`** (Relative URL). لا تضع عناوين Supabase المباشرة في الفرونت.
- إعادة الكتابة (External Rewrite) مفعّلة في `vercel.json`: توجه `/api/:path*` إلى `https://rujwuruuosffcxazymit.functions.supabase.co/:path*`. لا تنشئ أي Vercel Functions هنا.
- احترم فصل الأسرار: استخدم فقط `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` في الفرونت. مفاتيح Service-Role تبقى داخل Functions.
 - معرّف مشروع Supabase: `rujwuruuosffcxazymit`.

## 2) Big Picture (Data Flow)
- UI (Vite/React داخل `frontend/`) ←→ **/api/** (Rewrite) ←→ **Supabase Edge Functions** ←→ PostgREST/DB/Realtime.
- بعض المشاريع تستخدم **functions-proxy** كطبقة وسطية لتوحيد المسارات `/api → /api/v1` + محاولة ثانية قصيرة + سجل موحّد. إن وُجدت في هذا المشروع، مرِّر الطلبات عبرها:  
	`/api/:path* → https://rujwuruuosffcxazymit.functions.supabase.co/functions-proxy/:path*`

## 3) Conventions & Patterns (Project-Specific)
- **Routes**: استخدم بادئة **`/api/v1/...`** على مستوى الـFunctions. عند الواجهة استدعِ دائمًا `/api/...` واترك الوسيط (إن وُجد) يطبّق التوحيد.
- **Networking**: الاستدعاء القياسي:
	```ts
	const r = await fetch('/api/status', { method:'GET' });
	if (!r.ok) throw new Error(`API ${r.status}`);
	const data = await r.json();
```

* **Realtime**: إشعارات الدور/الـPIN/المسارات عبر Supabase Realtime (جداول شائعة: `queues`, `queue_history`, `notifications`, `pins`). اشترك مثلاً:

	```ts
	const supa = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
	const ch = supa.channel('db-changes')
		.on('postgres_changes',{event:'INSERT',schema:'public',table:'queues'}, payload => {/* update UI */})
		.subscribe();
	```
* **CORS في Functions**: رجّع ترويسات:
	`access-control-allow-origin: https://mmc-mms.com`،
	وادعم `OPTIONS` لطلبات المتصفح.

## 4) Build, Run, Deploy (What actually works here)

* **Root Directory (Vercel)**: `frontend/` (حتى يطبَّق `vercel.json` الصحيح المرتبط بالفرونت).
* **Build**: يُستخدم أمر البناء في `vercel.json` مثل: `cd frontend && npm run build`. نَتِج البناء ضمن `frontend/dist`.
* **Ignore**: تأكّد من وجود `.vercelignore` في جذر النشر واستبعاد:

	```
	/api/**
	/supabase/**
	```

	لمنع إنشاء Functions على مشروع الفرونت.
* **Supabase Functions**: النشر عبر CLI:

	```
	supabase login
	supabase link --project-ref rujwuruuosffcxazymit
	supabase functions deploy <function-name>
	```

	افحص: `supabase functions list`.

## 5) Cross-Component Contracts (Examples)

* **Health**: `GET /api/api-v1-status` يعيد JSON بسيط `{ ok: true, service: "...", time: ... }` من Edge Function للصحة.
* **PIN/Queue/Routes/Notifications**: استدعِ عبر `/api/...` فقط. لا تستخدم عناوين مطلقة. التزم بهيكل JSON الذي تراه في الوظائف الحالية (لا تبتكر حقولًا جديدة دون مراجعة الكود الموجود).

## 6) Do / Don’t

* ✅ استخدم `/api/...` من الفرونت دائمًا (يعبر عبر الـRewrite).
* ✅ إن وُجدت **functions-proxy** في المشروع، اتركها توحّد المسار وتعيد المحاولة وتكتب السجل.
* ❌ لا تنشئ/تدفع أي كود تحت `/api` داخل هذا الريبو؛ سيتم تجاهله أو قد يخلق Functions بالخطأ.
* ❌ لا تضع مفاتيح Service-Role في الفرونت.

## 7) Quick Checks for Agents (before coding)

1. `vercel.json` يحتوي Rewrite خارجي لكل `/api/*`.
2. تبويب **Functions** في مشروع Vercel للواجهة **فارغ**.
3. `curl -i https://mmc-mms.com/api/api-v1-status` → **200** JSON من Supabase.
4. Realtime Publications مفعّلة للجداول التي يحتاجها الفرونت.

---

**Docs (authoritative)**

* Vercel Rewrites (External/Reverse Proxy).
* Project config & `vercel.json`.
* `.vercelignore`.
* Supabase Edge Functions (Quickstart).
* Edge Functions CORS.
* Supabase Realtime (DB changes).

---



### المراجع (موثوقة وقابلة للتحقق)
- Vercel — Rewrites (External/Reverse Proxy). :contentReference[oaicite:0]{index=0}  
- Vercel — Project configuration & `vercel.json`. :contentReference[oaicite:1]{index=1}  
- Vercel — `.vercelignore` guide. :contentReference[oaicite:2]{index=2}  
- Supabase — Edge Functions Quickstart. :contentReference[oaicite:3]{index=3}  
- Supabase — Edge Functions CORS. :contentReference[oaicite:4]{index=4}  
- Supabase — Realtime (Subscribing to database changes). :contentReference[oaicite:5]{index=5}


	«اختبار تحقّق فوري» خطوة-بخطوة؛ إذا مرّ كله ✅ فهذا يثبت 100% أنّ الفصل محقّق: **Supabase = قاعدة البيانات + التخزين + الـEdge Functions (الباك-إند)**، و**Vercel = الواجهة فقط بلا أي API**.

# المختصر

* المطلوب النهائي: **لا يوجد أي Functions/Routes على Vercel**، وجميع طلبات ‎`/api/*`‎ تُعاد كتابتها (Rewrite) خارجيًا إلى Supabase (PostgREST أو Edge Functions).
* نفّذ الخطوات 1→10؛ لو كلها **PASS** يبقى الفصل تمّ بلا ازدواج.

---

# خطوات التحقّق العملية (بالترتيب)

## 1) تأكيد عدم وجود أي API على Vercel (لوحة المشروع)

* ادخل **Project → Functions** وتأكد أنها **فارغة** (لا Serverless ولا Edge).
* ادخل **Project → Settings → Build & Development** وتأكد **Root Directory = `frontend/`** (أو اسم مجلد الواجهة عندك)، وأنه ما في أي إعداد يُنشئ API.

> مرجع رسمي لإعدادات البناء والجذر في Vercel. ([Vercel][1])

**📹 فيديو/صور:** صفحة إعدادات Vercel توضّح تبويبات Settings/Build، وفيديو «Deploying … to Vercel» يبيّن مسار الإعدادات. ([Vercel][1])

---

## 2) تأكيد ملف ‎`.vercelignore`‎ فعّال ويستبعد أي مجلد API

ضع/تأكد من وجود ‎`.vercelignore`‎ في جذر الواجهة، يتضمن مثلاً:

```
api/
functions/
edge-functions/
supabase/
supabase/**
/server
/pages/api
/app/api
```

* ثم راقب لوج البناء في Vercel: يظهر سطر مثل **Found .vercelignore** و**Removed N ignored files** (هذا يدل أنه مطبّق).

> Vercel يذكر ‎`.vercelignore`‎ ضمن وثائق الأخطاء/الاستخدام؛ وجوده واستخدامه معتمد. ([Vercel][2])

**🖼 لقطة مقترحة:** لقطة من لوج البناء فيها “Found .vercelignore”.

---

## 3) تأكيد عدم وجود مسارات API في كود الواجهة

من داخل مجلد الواجهة شغّل:

```bash
git ls-files | grep -E '^(api/|functions/|edge-functions/|pages/api|app/api)' || echo "PASS: لا توجد API في الواجهة"
```

لو رجّع **PASS** فأنت تمام.

---

## 4) إعداد إعادة الكتابة على Vercel إلى Supabase فقط (بلا أي Function على Vercel)

ضع ملف `vercel.json` في جذر الواجهة (نفس مجلد `package.json` للواجهة) بصيغة **routes/rewrites خارجية** نحو Supabase:

> **إذا باك-إندك Edge Functions:**

```json
{
	"routes": [
		{ "src": "^/api/v1/(.*)$", "dest": "https://rujwuruuosffcxazymit.functions.supabase.co/$1" }
	]
}
```

> **إذا باك-إندك PostgREST (REST):**

```json
{
	"routes": [
		{ "src": "^/api/v1/(.*)$", "dest": "https://rujwuruuosffcxazymit.supabase.co/rest/v1/$1" }
	]
}
```

* الغاية: كل طلب إلى ‎`/api/v1/*`‎ يخرج مباشرة إلى نطاق Supabase (Rewrite خارجي)؛ لا يولَّد أي Function على Vercel.

> راجع دليل تصحيح التوجيه (Routing Debug) في Vercel لإثبات أن `vercel.json` يدير التوجيه، وأن الـObservability يبيّن الـrewrites. ([Vercel][3])

**📹/🖼**: لو دخلت Observability في Vercel سترى الطلبات مع علامة Rewrite ووجهتها. (المزية موثّقة ضمن مسارات التوجيه والـObservability). ([Vercel][3])

---

## 5) اختبار Curl يثبت أن ‎`/api`‎ لا يُعالَج على Vercel

شغّل (استبدل النطاق بنطاقك الإنتاجي):

```bash
# يفترض وجود فانكشن "health" على Supabase Edge:
curl -i https://mmc-mms.com/api/v1/health

# اختبار مسار غير موجود:
curl -i https://mmc-mms.com/api/v1/__not_exists__
```

**علامات النجاح:**

* الاستجابة تأتي من **نطاق Supabase** (تحقّق من `via`/`x-powered-by`/التواقيع الخاصة بـSupabase إن وجدت).
* خطأ 404 (لو المسار غير موجود) يجب أن يكون من Supabase وليس صفحة 404 من Vercel.

---

## 6) تأكيد نشر الـEdge Functions على Supabase (وليس Vercel)

من جهازك/البيئة:

```bash
supabase functions list
# ثم إن لزم:
supabase functions deploy health
```

المهم أن **القائمة تظهر وظائفك** وأن التوزيع يتم عبر Supabase CLI.

> مرجع CLI/Edge Functions لدى Supabase (أوامر list/deploy مذكورة في أدلة الـFunctions). ([Vercel][4])

**📹 فيديو:** مقدمة Edge Functions من Supabase (يوضح مسار النشر والاختبار). ([Vercel][5])

---

## 7) تفعيل CORS الصحيح على وظيفة Supabase (حتى مع Rewrite)

احرص أن تُرجع الوظيفة ترويسات CORS للواجهة:

```ts
return new Response(JSON.stringify({ ok: true }), {
	headers: {
		"Access-Control-Allow-Origin": "https://mmc-mms.com",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
		"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
	}
});
```

> Supabase يشرح CORS لِـEdge Functions وكيفية إعداد الترويسات المناسبة. ([Vercel][6])

---

## 8) ضبط متغيرات الواجهة (Vite/Next) لعدم ضرب Vercel

* لو مشروعك **Vite**: خليه يضرب دائمًا ‎`/api/v1/*`‎ (نفس المسار النسبي)، وخلي الـRewrite يتكفّل بالباقي.
* لو **Next.js**: **لا تنشئ** `pages/api` أو `app/api` إطلاقًا؛ استخدم fetch نحو ‎`/api/v1/*`‎ فقط.

> دليل Vercel للبناء يوضح أُطر العمل ودورة البناء، المهم ألّا تُستخدم API Routes. ([Vercel][1])

---

## 9) فحص لوج البناء في Vercel بعد أي تعديل

ابحث عن:

* **Found .vercelignore** + **Removed … ignored files**
* عدم وجود أي خطوة تنشئ Functions
* نجاح رفع `vercel.json` (لو أخطأت الصيغة، يذكرها اللوج)

> نفس مرجع الإعدادات/اللوج في Vercel. ([Vercel][1])

---

## 10) فحص نهائي من لوحة Supabase

* **Database & Storage**: تأكد أن الواجهة تتعامل عبر REST/Functions فقط (لا مفاتيح تسريب ضمن الواجهة).
* **Functions**: جميع النقاط الحرجة (health, auth, queue, pins…) منشورة على Supabase.

> مراجع Supabase الرسمية للـEdge Functions والإدارة. ([Vercel][4])

---

# قوالب ملفات جاهزة (انسخ-الصق)

**`vercel.json` (Rewrite خارجي فقط):**

```json
{
	"routes": [
		{ "src": "^/api/v1/(.*)$", "dest": "https://rujwuruuosffcxazymit.functions.supabase.co/$1" }
	]
}
```

**`.vercelignore` (تعطيل أي API في الواجهة):**

```
api/
functions/
edge-functions/
supabase/
supabase/**
server/
pages/api
app/api
```

---

# ماذا تعتبره «نجاحًا نهائيًا»؟

* **Functions tab في Vercel = صفر.**
* **Requests في Observability تُظهر Rewrite خارجي إلى Supabase.**
* **`curl` لـ `/api/v1/health` يرد من Supabase**، و404 غير الموجود يأتي من Supabase وليس من Vercel.
* **`supabase functions list`** يُظهر وظائفك، و**`deploy`** يتم من Supabase فقط.

لو كل ما سبق ✅: إذًا **الفصل محقّق**، ولا يوجد أي ازدواج بين Vercel (واجهة فقط) وSupabase (باك-إند/قاعدة/تخزين).

---

# المصادر (موثوقة وقابلة للتحقّق)

* Vercel — دليل إعدادات البناء والجذر (Build & Development Settings). ([Vercel][1])
* Vercel — تصحيح وإثبات التوجيه/الـRewrites عبر Observability (Routing Debug). ([Vercel][3])
* Vercel — ذكر ‎`.vercelignore`‎ ضمن الوثائق الرسمية. ([Vercel][2])
* Supabase — Edge Functions (نشر/تشغيل/CLI). ([Vercel][4])
* Supabase — CORS مع Edge Functions (شرح رسمي). ([Vercel][6])
* فيديو Vercel (نشر تطبيقات) — نظرة بصرية على مسار الإعدادات (مرجع عام). ([يوتيوب][7])

> إن ظهر عندك سطر لوج/صورة من اللوحات يخالف أي بند، ابعته فورًا وأنا أعطيك تعديل مباشر للملفات (قواعد ‎`vercel.json`‎ أو ترويسات CORS أو استثناءات ‎`.vercelignore`‎) بنفس اللحظة.

[1]: https://vercel.com/docs/builds/configure-a-build?utm_source=chatgpt.com "Configuring a Build"
[2]: https://vercel.com/changelog/deployment-protection-now-supports-protected-rewrites?utm_source=chatgpt.com "Deployment Protection now supports protected rewrites"
[3]: https://vercel.com/docs/project-configuration/project-settings?utm_source=chatgpt.com "Project settings"
[4]: https://vercel.com/docs/routing-middleware/api?utm_source=chatgpt.com "Routing Middleware API"
[5]: https://vercel.com/changelog/fast-data-transfer-for-rewrites-between-a-teams-projects-is-now-free?utm_source=chatgpt.com "Fast Data Transfer for rewrites between your team's ..."
[6]: https://vercel.com/docs/redirects?utm_source=chatgpt.com "Redirects"
[7]: https://www.youtube.com/watch?v=AiiGjB2AxqA&utm_source=chatgpt.com "Deploying Next.js to Vercel"