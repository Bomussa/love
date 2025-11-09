import handler from '../index.js';

export default async function(req, res) {
  req.url = '/api/v1/pin/generate';
  return handler(req, res);
}
