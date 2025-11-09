import handler from '../../lib/api-handlers.js';

export default async function(req, res) {
  req.url = '/api/v1/patient/login';
  return handler(req, res);
}
