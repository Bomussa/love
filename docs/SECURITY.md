# سياسة الأمان / Security Policy

## الإصدارات المدعومة / Supported Versions

| الإصدار / Version | مدعوم / Supported |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## الإبلاغ عن ثغرة أمنية / Reporting a Vulnerability

إذا اكتشفت ثغرة أمنية في هذا المشروع، يرجى الإبلاغ عنها بشكل مسؤول:

If you discover a security vulnerability in this project, please report it responsibly:

1. **لا تنشر الثغرة علناً** / **Do not disclose publicly**
2. أرسل تقريراً إلى: **[البريد الإلكتروني]** / Send a report to: **[email]**
3. قدم وصفاً تفصيلياً للثغرة / Provide detailed description
4. سنرد خلال 48 ساعة / We will respond within 48 hours

## التحديثات الأمنية الأخيرة / Recent Security Updates

### 2025-10-24
- ✅ تحديث axios من ^1.12.2 إلى ^1.7.7
- ✅ تحديث vite من ^7.1.10 إلى ^5.4.11
- ✅ تحديث wrangler من ^4.43.0 إلى ^3.80.4
- ✅ إزالة console.log من الكود الإنتاجي
- ✅ تحسين .gitignore لحماية المتغيرات البيئية

## أفضل الممارسات الأمنية / Security Best Practices

### للمطورين / For Developers
- استخدم متغيرات بيئية للمعلومات الحساسة / Use environment variables for sensitive data
- لا تضع أكواد API في الكود المصدري / Never hardcode API keys
- راجع التبعيات بانتظام / Review dependencies regularly
- استخدم `npm audit` للفحص الدوري / Use `npm audit` for regular checks

### للنشر / For Deployment
- استخدم HTTPS فقط / Use HTTPS only
- فعّل CORS بشكل صحيح / Configure CORS properly
- استخدم Cloudflare Workers للحماية / Use Cloudflare Workers for protection
- راقب السجلات بانتظام / Monitor logs regularly

## الاتصال / Contact

للأسئلة الأمنية: **security@[domain].com**
For security questions: **security@[domain].com**

