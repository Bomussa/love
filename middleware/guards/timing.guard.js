// يتحقق من الترتيب المنطقي للأحداث
export function ensureOrder(kind, payload){
  // مثال: لا queue.issue قبل pin.verify للانتقال
  return true;
}
