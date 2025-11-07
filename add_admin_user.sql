-- تعطيل RLS مؤقتاً لإضافة المستخدم
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;

-- إضافة مستخدم الإدارة
INSERT INTO admins (id, username, password_hash, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'bomussa',
  '14490',
  'SUPER_ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  updated_at = NOW();

-- إعادة تفعيل RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- عرض المستخدمين
SELECT * FROM admins;
