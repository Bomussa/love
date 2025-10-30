// قراءة فقط — إن احتجنا استعلامات مباشرة (تعتمد على بيئتك). Placeholder.
export const db = {
  readOnly: async (q, params)=>({ rows:[], count:0 })
};
