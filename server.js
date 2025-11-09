import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiHandler from './api/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.all('/api/*', async (req, res) => {
  try {
    const vercelReq = {
      ...req,
      url: req.originalUrl || req.url,
      headers: req.headers,
      method: req.method,
      body: req.body,
      query: req.query
    };
    
    const vercelRes = {
      ...res,
      status: (code) => {
        res.statusCode = code;
        return vercelRes;
      },
      json: (data) => {
        res.json(data);
        return vercelRes;
      },
      end: (data) => {
        res.end(data);
        return vercelRes;
      },
      setHeader: (key, value) => {
        res.setHeader(key, value);
        return vercelRes;
      },
      write: (data) => {
        res.write(data);
        return vercelRes;
      },
      writeHead: (statusCode, headers) => {
        res.writeHead(statusCode, headers);
        return vercelRes;
      }
    };
    
    await apiHandler(vercelReq, vercelRes);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API available at http://0.0.0.0:${PORT}/api`);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
