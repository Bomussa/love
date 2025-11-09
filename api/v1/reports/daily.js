import handler from '../index.js';

export default async function(req, res) {
  req.url = '/api/v1/reports/daily';
  return handler(req, res);
}
