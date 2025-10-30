// مراقبة الاتصال، إعادة المحاولة
export async function withRetry(fn, delays=[5000,10000]){
  let lastErr;
  for(const d of [0, ...delays]){
    if(d) await new Promise(r=>setTimeout(r,d));
    try{ return await fn(); }catch(e){ lastErr=e; }
  }
  throw lastErr;
}
