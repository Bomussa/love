/**
 * Export Secrets Endpoint
 * استخراج جميع الأسرار والمتغيرات البيئية بشكل آمن
 * مع فحص JWT expiration dates
 */

import crypto from 'crypto';

// دالة لفك تشفير JWT واستخراج تاريخ الانتهاء
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return {
      iss: payload.iss,
      exp: payload.exp,
      iat: payload.iat,
      expires_at: payload.exp ? new Date(payload.exp * 1000).toISOString() : null
    };
  } catch {
    return null;
  }
}

// دالة لحساب SHA-256
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// دالة للتشفير (AES-256-GCM)
function encrypt(text, passphrase) {
  const key = crypto.scryptSync(passphrase, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return {
    data: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-export-token, x-passphrase');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  
  // التحقق من التوكن (أمان بسيط)
  const exportToken = req.headers['x-export-token'];
  const expectedToken = process.env.EXPORT_TOKEN || 'default-export-token-change-me';
  
  if (exportToken !== expectedToken) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  
  // جمع جميع المتغيرات البيئية المهمة
  const secrets = [
    // Supabase
    { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL },
    { name: 'SUPABASE_ANON_KEY', value: process.env.SUPABASE_ANON_KEY },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: 'VITE_SUPABASE_URL', value: process.env.VITE_SUPABASE_URL },
    { name: 'VITE_SUPABASE_ANON_KEY', value: process.env.VITE_SUPABASE_ANON_KEY },
    
    // Postgres
    { name: 'POSTGRES_HOST', value: process.env.POSTGRES_HOST },
    { name: 'POSTGRES_USER', value: process.env.POSTGRES_USER },
    { name: 'POSTGRES_PASSWORD', value: process.env.POSTGRES_PASSWORD },
    { name: 'POSTGRES_DATABASE', value: process.env.POSTGRES_DATABASE },
    
    // API
    { name: 'API_ORIGIN', value: process.env.API_ORIGIN },
    { name: 'VITE_API_BASE_URL', value: process.env.VITE_API_BASE_URL },
    { name: 'FRONTEND_ORIGIN', value: process.env.FRONTEND_ORIGIN },
    
    // Vercel
    { name: 'VERCEL_URL', value: process.env.VERCEL_URL },
    { name: 'VERCEL_ENV', value: process.env.VERCEL_ENV },
    { name: 'VERCEL_GIT_COMMIT_SHA', value: process.env.VERCEL_GIT_COMMIT_SHA },
    
    // Other
    { name: 'EXPORT_TOKEN', value: process.env.EXPORT_TOKEN },
    { name: 'CRON_SECRET', value: process.env.CRON_SECRET }
  ];
  
  // معالجة كل سر
  const items = secrets
    .filter(s => s.value) // فقط المتغيرات الموجودة
    .map(s => {
      const item = {
        name: s.name,
        length: s.value.length,
        sha256: sha256(s.value).substring(0, 16), // أول 16 حرف من البصمة
        preview: s.value.substring(0, 20) + '...' // أول 20 حرف
      };
      
      // فحص إذا كان JWT
      const jwt = decodeJWT(s.value);
      if (jwt) {
        item.is_jwt = true;
        item.expires_at = jwt.expires_at;
        item.issuer = jwt.iss;
      }
      
      return item;
    });
  
  // فحص إذا كان المستخدم يريد التشفير
  const passphrase = req.headers['x-passphrase'];
  
  if (passphrase) {
    // تشفير البيانات الحساسة
    const fullSecrets = secrets
      .filter(s => s.value)
      .reduce((acc, s) => {
        acc[s.name] = s.value;
        return acc;
      }, {});
    
    const encrypted = encrypt(JSON.stringify(fullSecrets), passphrase);
    
    return res.status(200).json({
      ok: true,
      encrypted: true,
      meta: {
        count: items.length,
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'unknown'
      },
      enc: encrypted,
      items: items // معلومات غير حساسة فقط
    });
  }
  
  // إرجاع بدون تشفير (معلومات محدودة فقط)
  return res.status(200).json({
    ok: true,
    encrypted: false,
    meta: {
      count: items.length,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'unknown',
      warning: 'Full values not included for security. Use x-passphrase header to get encrypted full values.'
    },
    items: items
  });
}
