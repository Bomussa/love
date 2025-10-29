function sanitize(meta={}){
  try{ const c = JSON.parse(JSON.stringify(meta)); if(c.pin) c.pin='***'; return c; }catch{ return {}; }
}
export function logInfo(msg, meta){ console.log('[INFO]', msg, sanitize(meta)); }
export function logWarn(msg, meta){ console.warn('[WARN]', msg, sanitize(meta)); }
export function logError(msg, meta){ console.error('[ERROR]', msg, sanitize(meta)); }
