const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type,x-request-id,apikey',
};

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.send(JSON.stringify(payload));
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { json, handleOptions };
