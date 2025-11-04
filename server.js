import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.use(cors()); // Enable CORS for all routes
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Serve index.html for all routes (SPA support)
// Note: API routes are handled by Cloudflare Pages Functions in production
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║   Medical Military Committee System - 2027   ║
╠═══════════════════════════════════════════════╣
║  Server: http://${HOST}:${PORT}              ║
║  Status: Running                              ║
║  Environment: ${process.env.NODE_ENV || 'development'}                    ║
║                                               ║
║  Note: This server only serves the frontend.  ║
║  API is handled by Cloudflare Pages Functions ║
╚═══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

