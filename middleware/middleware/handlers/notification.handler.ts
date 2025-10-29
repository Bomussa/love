/**
 * handlers/notification.handler.ts
 * مبدئيًا: الطبقة الوسطية لا تخزن ولا تولّد الإشعار؛ فقط تُطلق قناة البث عند الأحداث.
 */
export const notifyInfo = (be:any) => async (req:any, res:any) => {
  return res.json({ ok:true });
};
