# 🔧 دليل الصيانة

## النسخ الاحتياطي

\`\`\`bash
# نسخ احتياطي لقاعدة البيانات
npm run db:backup

# استعادة
npm run db:restore backup.sql
\`\`\`

## المراقبة

- Vercel Dashboard: https://vercel.com/bomussa/love
- Supabase Dashboard: https://supabase.com/dashboard/project/rujwuruuosffcxazymit
- API Health (new): `GET /api/backend/health`
- API Status (new): `GET /api/backend/status`
- Backward compatibility remains available: `GET /api/health` and `GET /api/v1/status`

```bash
# API monitoring checks (recommended)
curl -fsS https://mmc-mms.com/api/backend/health
curl -fsS https://mmc-mms.com/api/backend/status
```

## الصيانة الدورية

- ✅ فحص السجلات أسبوعيًا
- ✅ نسخ احتياطي يومي
- ✅ تحديث الاعتماديات شهريًا

---
**آخر تحديث:** 08 نوفمبر 2025
