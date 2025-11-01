#!/usr/bin/env node
/**
 * Build script for Vercel static deployment
 * Copies static assets (index.html, assets/, public/) into the dist folder
 */

const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
fs.mkdirSync('dist', { recursive: true });

// Copy index.html to dist
fs.copyFileSync('index.html', path.join('dist', 'index.html'));

// Copy assets folder if it exists
if (fs.existsSync('assets')) {
  fs.cpSync('assets', path.join('dist', 'assets'), { recursive: true });
}

// Copy public folder if it exists
if (fs.existsSync('public')) {
  fs.cpSync('public', path.join('dist', 'public'), { recursive: true });
}

console.log('Static build prepared with assets');
