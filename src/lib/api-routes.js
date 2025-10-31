/**
 * API Routes Mapping
 * Maps frontend API paths to Supabase Edge Function names
 */

export const API_ROUTE_MAP = {
  // Queue operations
  '/queue/enter': 'queue-enter',
  '/queue/status': 'queue-status',
  '/queue/call': 'queue-call',
  '/queue/done': 'queue-done',
  '/queue/position': 'queue-position',
  '/queue/cancel': 'queue-cancel',
  
  // PIN operations
  '/pin/status': 'pin-status',
  '/pin/generate': 'pin-generate',
  
  // Admin operations
  '/admin/login': 'admin-login',
  '/admin/status': 'admin-status',
  '/admin/set-call-interval': 'admin-set-call-interval',
  
  // Patient operations
  '/patient/login': 'patient-login',
  
  // Route operations
  '/route/create': 'route-create',
  '/route/get': 'route-get',
  
  // Path operations
  '/path/choose': 'path-choose',
  
  // Clinic operations
  '/clinic/exit': 'clinic-exit',
  
  // Stats operations
  '/stats/dashboard': 'stats-dashboard',
  '/stats/queues': 'stats-queues',
  
  // Events
  '/events/stream': 'events-stream',
  
  // Notifications
  '/notify/status': 'notify-status',
  
  // Metrics
  '/metrics': 'metrics',
  
  // Health check
  '/health': 'health'
}

/**
 * Convert frontend API path to Supabase Edge Function name
 * @param {string} path - Frontend API path (e.g., '/queue/enter')
 * @returns {string} - Supabase Edge Function name (e.g., 'queue-enter')
 */
export function mapApiPath(path) {
  // Remove leading /api/v1 if present
  const cleanPath = path.replace(/^\/api\/v1/, '')
  
  // Check if we have a direct mapping
  if (API_ROUTE_MAP[cleanPath]) {
    return API_ROUTE_MAP[cleanPath]
  }
  
  // Fallback: convert slashes to dashes
  return cleanPath.replace(/^\//, '').replace(/\//g, '-')
}
