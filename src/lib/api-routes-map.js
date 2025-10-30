// Mapping من المسارات القديمة إلى Supabase Edge Functions
// الملفات القديمة كانت: /api/v1/category/action
// Supabase Functions: category-action

export const ROUTE_MAP = {
  // Patient
  '/patient/login': 'patient-login',
  
  // Admin
  '/admin/login': 'admin-login',
  '/admin/status': 'admin-status',
  '/admin/set-call-interval': 'admin-set-call-interval',
  
  // Queue
  '/queue/enter': 'queue-enter',
  '/queue/status': 'queue-status',
  '/queue/call': 'queue-call',
  '/queue/done': 'queue-done',
  '/queue/position': 'queue-position',
  '/queue/cancel': 'queue-cancel',
  
  // PIN
  '/pin/status': 'pin-status',
  '/pin/generate': 'pin-generate',
  
  // Route
  '/route/create': 'route-create',
  '/route/get': 'route-get',
  
  // Path
  '/path/choose': 'path-choose',
  
  // Clinic
  '/clinic/exit': 'clinic-exit',
  
  // Stats
  '/stats/dashboard': 'stats-dashboard',
  '/stats/queues': 'stats-queues',
  
  // Events
  '/events/stream': 'events-stream',
  
  // Notify
  '/notify/status': 'notify-status',
  
  // Health
  '/health/status': 'health',
  '/health': 'health'
}

// دالة لتحويل المسار القديم إلى اسم Function
export function mapRoute(oldPath) {
  // إزالة /api/v1 إذا كان موجوداً
  const cleanPath = oldPath.replace(/^\/api\/v1/, '')
  
  // البحث في الـ map
  if (ROUTE_MAP[cleanPath]) {
    return ROUTE_MAP[cleanPath]
  }
  
  // إذا لم يوجد، نحاول التحويل التلقائي
  // /category/action → category-action
  return cleanPath.replace(/^\//, '').replace(/\//g, '-')
}
