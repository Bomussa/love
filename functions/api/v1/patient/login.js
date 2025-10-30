// Patient Login API
// POST /api/v1/patient/login
// Body: { patientId, gender }

// In-memory storage (will be replaced by KV when available)
const sessions = new Map();

export const onRequestPost = async (context) => {
  const { request, env } = context;

  try {
    // Parse request body
    const body = await request.json();
    const { patientId, gender } = body;

    // Validate input
    if (!patientId || !gender) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: patientId and gender'
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

    // Validate patientId format (2-12 digits)
    if (!/^\d{2,12}$/.test(patientId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid patientId format. Must be 2-12 digits.'
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

    // Validate gender
    if (!['male', 'female'].includes(gender)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid gender. Must be "male" or "female".'
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

    // Create patient session
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const patientData = {
      id: sessionId,
      patientId: patientId,
      gender: gender,
      loginTime: new Date().toISOString(),
      status: 'logged_in'
    };

    // Store in memory first
    sessions.set(sessionId, patientData);

    // Try to store in KV if available
    if (env?.KV_CACHE) {
      try {
        await env.KV_CACHE.put(
          `patient:${sessionId}`,
          JSON.stringify(patientData),
          { expirationTtl: 86400 } // 24 hours
        );
      } catch (e) {
        console.log('KV storage not available, using memory storage');
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: patientData,
        message: 'Login successful'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('Patient login error:', error);
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

