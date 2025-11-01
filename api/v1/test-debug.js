// ملف اختبار لفهم كيف يعمل Vercel catch-all routes
module.exports = (req, res) => {
  const debug = {
    url: req.url,
    method: req.method,
    query: req.query,
    headers: req.headers,
  };
  
  res.status(200).json(debug);
};
