/**
 * Local Test Server for MMC-MMS API
 * This server runs the API locally for testing
 */

import express from 'express';
import cors from 'cors';
import handler from './api/index.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Convert Express req/res to Vercel-like format
app.all('/api/*', async (req, res) => {
  // Create Vercel-like request object with stream support
  const vercelReq = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    // Add stream support for parseBody
    on: (event, callback) => {
      if (event === 'data') {
        callback(JSON.stringify(req.body));
      } else if (event === 'end') {
        callback();
      } else if (event === 'error') {
        // no-op
      }
    }
  };
  
  // Create Vercel-like response object
  const vercelRes = {
    status: (code) => {
      res.status(code);
      return vercelRes;
    },
    json: (data) => {
      res.json(data);
    },
    send: (data) => {
      res.send(data);
    },
    setHeader: (name, value) => {
      res.setHeader(name, value);
    },
    write: (data) => {
      res.write(data);
    },
    end: () => {
      res.end();
    }
  };
  
  try {
    await handler(vercelReq, vercelRes);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MMC-MMS Test Server',
    endpoints: [
      'POST /api/v1/patient/login',
      'POST /api/v1/queue/enter',
      'GET  /api/v1/queue/status',
      'POST /api/v1/queue/call',
      'POST /api/v1/admin/login'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 MMC-MMS Test Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api/v1/*`);
  console.log(`\n✅ Ready for testing!\n`);
});
