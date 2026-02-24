// api-middleware.js
import { pathToFileURL } from 'url';

export default async function apiMiddleware(req, res, next, apiPath) {
  console.log(`API Middleware called for: ${req.url}`);
  if (req.url.startsWith('/api')) {
    try {
      const fileUrl = pathToFileURL(apiPath).href;
      const { default: handler } = await import(fileUrl);
      await handler(req, res);
    } catch (error) {
      console.error('API Handler Error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  } else {
    next();
  }
}
