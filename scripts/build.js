#!/usr/bin/env node
/**
 * Build script for Vercel static deployment
 * Copies static assets (index.html, assets/, public/) into the dist folder
 */

const fs = require('fs');
const path = require('path');

// Remove dist directory if it exists, then recreate it
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist', { recursive: true });

// Copy index.html to dist
try {
  fs.copyFileSync('index.html', path.join('dist', 'index.html'));
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error("Error: 'index.html' not found. Please ensure the file exists before running the build script.");
  } else {
    console.error("Error copying 'index.html':", err.message);
  }
  process.exit(1);
}

// Copy assets folder if it exists
if (fs.existsSync('assets')) {
  fs.cpSync('assets', path.join('dist', 'assets'), { recursive: true });
}

// Copy public folder if it exists
if (fs.existsSync('public')) {
  fs.cpSync('public', path.join('dist', 'public'), { recursive: true });
}

console.log('Static build prepared with assets');
