import handler from '../../lib/api-handlers.js';

export default async function(req, res) {
  req.url = '/api/v1/queue/status';
  return handler(req, res);
}
