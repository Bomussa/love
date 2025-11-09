import handler from '../index.js';

export default async function(req, res) {
  // تعديل المسار ليتطابق مع ما هو موجود في api/index.js
  req.url = '/api/v1/patient/login';
  return handler(req, res);
}
