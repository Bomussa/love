import handler from '../../../lib/api-handlers.js';

export default async function(req, res) {
  req.url = '/api/v1/stats/dashboard';
  return handler(req, res);
}
