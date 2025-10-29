export const notifyHandler = (ctx) => async (req, res, body) => {
  // الطبقة الوسطية لا تولد إشعار؛ فقط تبث حدثًا للإدارة/الواجهة
  res.json({ ok:true });
};
