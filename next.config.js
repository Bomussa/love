/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    CORE_API_BASE: process.env.CORE_API_BASE || 'http://localhost:3000/api/v1', // Mock for local development
  },
};

module.exports = nextConfig;
