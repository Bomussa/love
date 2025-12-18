/**
 * Admin Login API Endpoint
 * نقطة نهاية تسجيل دخول المسؤول
 * 
 * مشروع 2027 - نظام اللجنة الطبية العسكرية
 */

// بيانات الاعتماد الافتراضية (يمكن تغييرها عبر environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method Not Allowed' 
    });
  }

  try {
    // Parse body - handle both JSON and form-urlencoded
    let username, password;
    
    if (req.headers['content-type']?.includes('application/json')) {
      const body = req.body || {};
      username = body.username;
      password = body.password;
    } else {
      // Form-urlencoded
      const body = req.body || {};
      username = body.username;
      password = body.password;
    }

    // Validate credentials
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال اسم المستخدم وكلمة المرور',
        error_en: 'Please enter username and password'
      });
    }

    // Check credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Generate simple session token
      const sessionToken = Buffer.from(`${username}:${Date.now()}`).toString('base64');
      
      return res.status(200).json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        message_en: 'Login successful',
        token: sessionToken,
        user: {
          username: username,
          role: 'admin',
          permissions: [
            'dashboard',
            'queue_management',
            'pin_management',
            'reports',
            'clinic_configuration',
            'settings'
          ]
        },
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
        error_en: 'Invalid username or password'
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      error: 'حدث خطأ في الخادم',
      error_en: 'Server error occurred'
    });
  }
}
