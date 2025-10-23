// تنسيق المخرجات، الأكواد، والإشعارات الموحدة
export function ok(data){ return { ok:true, ...data }; }
export function fail(code, details){ return { ok:false, code, details }; }
