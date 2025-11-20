# دليل الصيانة - نظام اللجنة الطبية
## Maintenance Guide - Medical Committee System

**آخر تحديث**: 18 نوفمبر 2025  
**الإصدار**: 2.0  
**المسؤول**: فريق التطوير

---

## نظرة عامة

هذا الدليل يوفر معلومات شاملة حول صيانة نظام اللجنة الطبية. يتضمن الدليل إرشادات للمراقبة اليومية، حل المشاكل الشائعة، تحديث النظام، والنسخ الاحتياطي. يجب على جميع أعضاء فريق الصيانة قراءة هذا الدليل بعناية والرجوع إليه عند الحاجة.

---

## البنية التحتية

### Frontend (Vercel)

النظام الأمامي مستضاف على Vercel ويستخدم إطار عمل Vite مع React. المشروع يحتوي على ثلاث بيئات رئيسية: Production على الفرع `main`، Preview على الفروع الأخرى، والتطوير المحلي على `localhost:3000`. جميع التحديثات على GitHub تؤدي تلقائياً إلى deployment جديد.

**معلومات المشروع**:
- Project ID: `prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM`
- Team ID: `team_aFtFTvzgabqENB5bOxn4SiO7`
- Production URL: `https://love.vercel.app`
- Dashboard: `https://vercel.com/bomussa/love`

**متغيرات البيئة المطلوبة**:
- `VITE_SUPABASE_URL`: رابط Supabase
- `VITE_SUPABASE_ANON_KEY`: مفتاح Supabase العام

### Backend (Supabase)

قاعدة البيانات والـ API مستضافة على Supabase. النظام يستخدم PostgreSQL كقاعدة بيانات رئيسية، Edge Functions للمنطق الخلفي، Realtime للتحديثات الحية، والمصادقة للأمان.

**معلومات المشروع**:
- Project Ref: `rujwuruuosffcxazymit`
- URL: `https://rujwuruuosffcxazymit.supabase.co`
- Dashboard: `https://supabase.com/dashboard/project/rujwuruuosffcxazymit`

**الجداول الرئيسية**:
- `clinics`: معلومات العيادات
- `patients`: معلومات المرضى
- `queues`: طوابير الانتظار
- `notifications`: الإشعارات
- `pins`: أكواد PIN اليومية

**Edge Functions**:
- `stats-dashboard`: إحصائيات لوحة التحكم
- `pin-daily`: نظام PIN اليومي
- `queue-status`: حالة الطوابير
- `pin-generate`: إصدار PIN (قديم، لا يُستخدم)

---

## المراقبة اليومية

### فحص Vercel Deployments

يجب التحقق يومياً من حالة آخر deployment في Vercel Dashboard. الحالة المطلوبة هي **READY** باللون الأخضر. إذا كانت الحالة **ERROR** أو **FAILED**، يجب فحص Build Logs فوراً. إذا كانت الحالة **QUEUED** لأكثر من 5 دقائق، يجب التواصل مع دعم Vercel.

**الأمر للتحقق عبر CLI**:
```bash
manus-mcp-cli tool call list_deployments --server vercel \
  --input '{"projectId":"prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM","teamId":"team_aFtFTvzgabqENB5bOxn4SiO7"}'
```

### فحص Supabase Functions

يجب التحقق من أن جميع Edge Functions تعمل بشكل صحيح. يمكن اختبار كل function عبر curl أو من Supabase Dashboard.

**اختبار stats-dashboard**:
```bash
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://rujwuruuosffcxazymit.supabase.co/functions/v1/stats-dashboard
```

**اختبار pin-daily**:
```bash
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  "https://rujwuruuosffcxazymit.supabase.co/functions/v1/pin-daily?clinicId=1"
```

### فحص قاعدة البيانات

يجب مراقبة حجم قاعدة البيانات يومياً. إذا تجاوز الحجم 80% من الحد المسموح، يجب أرشفة البيانات القديمة. يجب أيضاً التحقق من أداء الاستعلامات في Supabase Dashboard تحت "Performance".

**استعلامات مفيدة**:
```sql
-- عدد المرضى في الانتظار
SELECT COUNT(*) FROM queues WHERE status = 'waiting';

-- عدد الإشعارات غير المقروءة
SELECT COUNT(*) FROM notifications WHERE read = false;

-- آخر 10 أكواد PIN
SELECT * FROM pins ORDER BY created_at DESC LIMIT 10;
```

---

## حل المشاكل الشائعة

### مشكلة: Dashboard لا يعرض بيانات

**الأعراض**: لوحة التحكم تعرض "جاري التحميل..." أو أخطاء.

**الأسباب المحتملة**:
1. `stats-dashboard` function لا تعمل
2. مشكلة في الاتصال بـ Supabase
3. خطأ في الكود

**الحل**:
1. افتح Console في المتصفح (F12)
2. ابحث عن أخطاء في Network tab
3. اختبر `stats-dashboard` function يدوياً
4. تحقق من متغيرات البيئة في Vercel
5. أعد deployment إذا لزم الأمر

### مشكلة: PIN لا يعمل

**الأعراض**: المستخدمون لا يستطيعون الدخول باستخدام PIN.

**الأسباب المحتملة**:
1. `pin-daily` function غير منشورة
2. PIN منتهي الصلاحية
3. خطأ في التحقق

**الحل**:
1. تحقق من نشر `pin-daily` function:
   ```bash
   supabase functions list
   ```
2. اختبر الوظيفة يدوياً:
   ```bash
   curl -H "Authorization: Bearer YOUR_ANON_KEY" \
     "https://rujwuruuosffcxazymit.supabase.co/functions/v1/pin-daily?clinicId=1"
   ```
3. أصدر PIN جديد من لوحة التحكم
4. تحقق من جدول `pins` في قاعدة البيانات

### مشكلة: الإشعارات لا تصل

**الأعراض**: المرضى لا يتلقون إشعارات.

**الأسباب المحتملة**:
1. Realtime غير متصل
2. مشكلة في الاشتراك
3. خطأ في الكود

**الحل**:
1. افتح Console وابحث عن أخطاء Realtime
2. تحقق من حالة الاتصال في Network tab
3. أعد تحميل الصفحة
4. تحقق من جدول `notifications` في قاعدة البيانات
5. اختبر إرسال إشعار يدوياً:
   ```sql
   INSERT INTO notifications (patient_id, type, title, message)
   VALUES (1, 'info', 'اختبار', 'هذا إشعار تجريبي');
   ```

### مشكلة: Deployment فشل

**الأعراض**: Vercel deployment في حالة ERROR أو FAILED.

**الأسباب المحتملة**:
1. خطأ في الكود
2. مشكلة في Dependencies
3. خطأ في Build configuration

**الحل**:
1. افتح Build Logs في Vercel Dashboard
2. اقرأ رسالة الخطأ بعناية
3. إذا كان خطأ في الكود، أصلحه وادفع commit جديد
4. إذا كان خطأ في Dependencies، حدّث `package.json`
5. إذا كان خطأ في Build، تحقق من `vercel.json`

---

## التحديثات والنشر

### تحديث Frontend

لتحديث Frontend، اتبع الخطوات التالية بعناية:

1. **Clone المستودع**:
   ```bash
   git clone https://github.com/Bomussa/love.git
   cd love
   ```

2. **أنشئ فرع جديد**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **قم بالتعديلات المطلوبة**

4. **اختبر محلياً**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Commit والدفع**:
   ```bash
   git add .
   git commit -m "وصف التعديلات"
   git push origin feature/your-feature-name
   ```

6. **أنشئ Pull Request** في GitHub

7. **انتظر Preview Deployment** من Vercel

8. **اختبر Preview** قبل الدمج

9. **ادمج في main** بعد الموافقة

### تحديث Supabase Functions

لتحديث Edge Function:

1. **عدّل الكود** في `supabase/functions/function-name/index.ts`

2. **اختبر محلياً** (اختياري):
   ```bash
   supabase functions serve function-name
   ```

3. **انشر على Supabase**:
   ```bash
   supabase functions deploy function-name --project-ref rujwuruuosffcxazymit
   ```

4. **اختبر Function** بعد النشر:
   ```bash
   curl -H "Authorization: Bearer YOUR_ANON_KEY" \
     https://rujwuruuosffcxazymit.supabase.co/functions/v1/function-name
   ```

### تحديث قاعدة البيانات

لتحديث Schema:

1. **أنشئ Migration**:
   ```bash
   supabase migration new your_migration_name
   ```

2. **اكتب SQL** في الملف الجديد في `supabase/migrations/`

3. **اختبر محلياً** (اختياري):
   ```bash
   supabase db reset
   ```

4. **ادفع إلى GitHub**:
   ```bash
   git add supabase/migrations/
   git commit -m "Add migration: your_migration_name"
   git push
   ```

5. **نفّذ على Production** من Supabase Dashboard

---

## النسخ الاحتياطي

### نسخ احتياطي لقاعدة البيانات

يجب عمل نسخة احتياطية يومية لقاعدة البيانات. Supabase يوفر نسخ احتياطية تلقائية، لكن يُنصح بعمل نسخ يدوية أيضاً.

**عبر Supabase Dashboard**:
1. اذهب إلى Database → Backups
2. اضغط "Create backup"
3. انتظر حتى ينتهي
4. حمّل النسخة الاحتياطية

**عبر CLI**:
```bash
supabase db dump -f backup_$(date +%Y%m%d).sql --project-ref rujwuruuosffcxazymit
```

### نسخ احتياطي للكود

الكود محفوظ تلقائياً على GitHub. يُنصح بعمل Fork للمستودع كنسخة احتياطية إضافية.

**Fork المستودع**:
1. اذهب إلى https://github.com/Bomussa/love
2. اضغط "Fork"
3. اختر حسابك
4. انتظر حتى ينتهي

---

## الأمان

### تحديث المفاتيح

يجب تغيير جميع المفاتيح السرية كل 3 أشهر:

1. **Supabase Keys**:
   - اذهب إلى Supabase Dashboard → Settings → API
   - أصدر مفاتيح جديدة
   - حدّث في Vercel Environment Variables
   - أعد Deployment

2. **Vercel Token**:
   - اذهب إلى Vercel Dashboard → Settings → Tokens
   - أصدر token جديد
   - حدّث في GitHub Secrets

### مراقبة الوصول

يجب مراجعة سجلات الوصول أسبوعياً:

**في Supabase**:
- اذهب إلى Logs → API Logs
- ابحث عن طلبات مشبوهة
- احظر IPs المشبوهة

**في Vercel**:
- اذهب إلى Analytics → Security
- راجع التنبيهات
- فعّل Firewall إذا لزم الأمر

---

## جهات الاتصال

### الدعم الفني

- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **GitHub Support**: https://support.github.com

### فريق التطوير

- **المهندس الرئيسي**: Manus AI
- **المستودع**: https://github.com/Bomussa/love
- **البريد الإلكتروني**: bomussa@hotmail.com

---

## الملاحق

### قائمة الأوامر المفيدة

```bash
# Vercel
vercel --version
vercel login
vercel deploy
vercel logs

# Supabase
supabase --version
supabase login
supabase functions list
supabase db dump

# Git
git status
git log --oneline
git checkout -b new-branch
git push origin branch-name
```

### قائمة الروابط المهمة

- GitHub Repository: https://github.com/Bomussa/love
- Vercel Dashboard: https://vercel.com/bomussa/love
- Supabase Dashboard: https://supabase.com/dashboard/project/rujwuruuosffcxazymit
- Production URL: https://love.vercel.app

---

**آخر مراجعة**: 18 نوفمبر 2025  
**الإصدار**: 2.0  
**الحالة**: نشط
