/**
 * Reports API - Unified Endpoint
 * Handles: /api/v1/reports/daily, /weekly, /monthly, /annual
 */

import { generateDailyReport, generateWeeklyReport, generateMonthlyReport, generateAnnualReport } from '../lib/reports.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const reportType = pathParts[pathParts.length - 1];

    switch (reportType) {
      case 'daily':
        return await handleDaily(req, res);
      case 'weekly':
        return await handleWeekly(req, res);
      case 'monthly':
        return await handleMonthly(req, res);
      case 'annual':
        return await handleAnnual(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: 'Report type not found'
        });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

async function handleDaily(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const date = url.searchParams.get('date');
  const report = await generateDailyReport(date);

  return res.status(200).json({
    success: true,
    report
  });
}

async function handleWeekly(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const week = url.searchParams.get('week');
  const report = await generateWeeklyReport(week);

  return res.status(200).json({
    success: true,
    report
  });
}

async function handleMonthly(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const month = url.searchParams.get('month');
  const report = await generateMonthlyReport(month);

  return res.status(200).json({
    success: true,
    report
  });
}

async function handleAnnual(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const year = url.searchParams.get('year');
  const report = await generateAnnualReport(year);

  return res.status(200).json({
    success: true,
    report
  });
}

