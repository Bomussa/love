// Admin Login API
// POST /admin/login
// Body: username=xxx&password=xxx (form-urlencoded)

export const onRequestPost = async (context) => {
  const { request, env } = context;

  try {
    // Parse form data
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    // Validate input
    if (!username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing username or password'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Check credentials from KV_ADMIN
    let isValid = false;
    let adminData = null;

    if (env.KV_ADMIN) {
      try {
        // Get admin credentials from KV
        const storedCreds = await env.KV_ADMIN.get('admin:credentials');
        if (storedCreds) {
          const creds = JSON.parse(storedCreds);
          if (creds.username === username && typeof creds.password === 'string' && creds.password.length > 0 && creds.password === password) {
            isValid = true;
            adminData = {
              username: username,
              role: creds.role || 'admin',
              permissions: creds.permissions || ['all']
            };
          }
        }
      } catch (e) {
        isValid = false;
        console.error('KV admin check error:', e);
      }
    }

    // Fallback: check against default credentials
    // Default: admin / admin123
    if (!isValid) {
      if (username === 'admin' && password === 'admin123') {
        isValid = true;
        adminData = {
          username: 'admin',
          role: 'admin',
          permissions: ['all']
        };
      }
    }

    // If credentials are invalid
    if (!isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Create admin session token
    const sessionToken = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session in KV
    if (env.KV_ADMIN) {
      try {
        await env.KV_ADMIN.put(
          `session:${sessionToken}`,
          JSON.stringify({
            ...adminData,
            loginTime: new Date().toISOString()
          }),
          { expirationTtl: 28800 } // 8 hours
        );
      } catch (e) {
        isValid = false;
        console.error('Session storage error:', e);
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        token: sessionToken,
        admin: adminData,
        message: 'Login successful'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Set-Cookie': `admin_token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`
        }
      }
    );

  } catch (error) {
    console.error('Admin login error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

// Handle OPTIONS for CORS
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
};

