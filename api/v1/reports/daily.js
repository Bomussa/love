import handler from '../../../lib/api-handlers.js';

export default async function(req, res) {
  req.url = '/api/v1/reports/daily';
  return handler(req, res);
}
