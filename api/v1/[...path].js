/**
 * Vercel Serverless Function - API Proxy
 * Proxies all /api/v1/* requests to Supabase Edge Functions
 * Converts path separators: /queue/enter → queue-enter
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    // Get the path from query params
    const { path } = req.query
    
    if (!path || path.length === 0) {
      return res.status(400).json({ error: 'Missing path' })
    }

    // Convert path array to function name
    // Example: ['queue', 'enter'] → 'queue-enter'
    const functionName = path.join('-')

    // Build Supabase Function URL
    const supabaseUrl = `${SUPABASE_URL}/functions/v1/${functionName}`

    console.log(`[Proxy] ${req.method} /api/v1/${path.join('/')} → ${functionName}`)

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }

    // Copy relevant headers from original request
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization
    }

    // Prepare fetch options
    const fetchOptions = {
      method: req.method,
      headers,
    }

    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body)
    }

    // Make request to Supabase
    const response = await fetch(supabaseUrl, fetchOptions)
    
    // Get response data
    const data = await response.text()
    
    // Try to parse as JSON
    let jsonData
    try {
      jsonData = JSON.parse(data)
    } catch (e) {
      jsonData = { message: data }
    }

    // Return response
    res.status(response.status).json(jsonData)

  } catch (error) {
    console.error('[Proxy Error]', error)
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    })
  }
}
