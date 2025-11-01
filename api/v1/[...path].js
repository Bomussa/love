// Proxy to forward requests from /api/v1/* to Supabase Edge Functions
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get Supabase configuration
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!base || !key) {
    return res.status(500).json({ 
      error: 'Missing Supabase configuration',
      details: 'SUPABASE_URL or SUPABASE_ANON_KEY not set'
    });
  }

  // Extract path from query (Vercel catch-all routes)
  // req.query.path will be an array like ['status'] or ['queue', 'enter']
  const pathArray = req.query.path || [];
  
  if (!Array.isArray(pathArray) || pathArray.length === 0) {
    return res.status(400).json({ 
      error: 'Missing path',
      details: 'No function path provided',
      received: req.query
    });
  }

  // Convert path array to function name
  // e.g., ['queue', 'enter'] -> 'queue-enter'
  const functionName = pathArray.join('-');
  
  // Build Supabase Edge Function URL
  const url = `${base}/functions/v1/${functionName}`;

  // Prepare headers
  const headers = {
    'Authorization': `Bearer ${key}`,
    'Content-Type': req.headers['content-type'] || 'application/json'
  };

  // Prepare request options
  const options = {
    method: req.method,
    headers: headers
  };

  // Add body for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    options.body = typeof req.body === 'string' 
      ? req.body 
      : JSON.stringify(req.body || {});
  }

  try {
    // Forward request to Supabase
    const response = await fetch(url, options);
    const buffer = await response.arrayBuffer();
    
    // Forward response
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(Buffer.from(buffer));
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ 
      error: 'Proxy failed',
      message: error?.message || String(error),
      url: url
    });
  }
};
