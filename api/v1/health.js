// api/v1/health.js
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ts: new Date().toISOString() }));
};
