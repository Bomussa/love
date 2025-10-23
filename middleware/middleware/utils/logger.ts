/**
 * utils/logger.ts
 * يُسجّل فقط (لا تخزين)، مع إخفاء الحساس.
 */
export function logInfo(msg:string, meta:any={}) { console.log('[INFO]', msg, sanitize(meta)); }
export function logWarn(msg:string, meta:any={}) { console.warn('[WARN]', msg, sanitize(meta)); }
export function logError(msg:string, meta:any={}) { console.error('[ERROR]', msg, sanitize(meta)); }
function sanitize(m:any){ try{ const c = JSON.parse(JSON.stringify(m)); if(c.pin) c.pin='***'; return c; }catch{ return {}; } }
