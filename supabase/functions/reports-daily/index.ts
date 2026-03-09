// Supabase Edge Function: reports-daily
// Get daily activity reports
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse, getCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date'); // YYYY-MM-DD format
    const format = searchParams.get('format') || 'json'; // json or print

    let query = db.from('vw_daily_activity').select('*');

    if (date) {
      query = query.eq('day', date);
    }

    const { data, error } = await query.order('day', { ascending: false }).limit(100);

    if (error) throw error;

    if (format === 'print') {
      // Simple HTML for printing
      const html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>التقرير اليومي</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #4CAF50; color: white; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>التقرير اليومي - نظام اللجنة الطبية</h1>
          <button onclick="window.print()">طباعة</button>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>العيادة</th>
                <th>عدد الزيارات</th>
                <th>المكتمل</th>
                <th>المتخطى</th>
                <th>متوسط الانتظار (دقائق)</th>
              </tr>
            </thead>
            <tbody>
              ${data?.map((row:any) => `
                <tr>
                  <td>${row.day}</td>
                  <td>${row.clinic_id}</td>
                  <td>${row.visits}</td>
                  <td>${row.completed_visits}</td>
                  <td>${row.skipped_visits}</td>
                  <td>${row.avg_wait_seconds ? Math.round(row.avg_wait_seconds / 60) : '-'}</td>
                </tr>
              `).join('') || '<tr><td colspan="6">لا توجد بيانات</td></tr>'}
            </tbody>
          </table>
        </body>
        </html>
      `;
      return new Response(html, {
        headers: getCorsHeaders(req, { 'Content-Type': 'text/html; charset=UTF-8' }),
      });
    }

    return corsJsonResponse({
      data: {
          report_type: 'daily',
          date_filter: date || 'all',
          records: data || [],
          total_records: data?.length || 0,
        },
    }, 200, req);
  } catch (err) {
    return corsErrorResponse(String(err), 400, req);
  }
});
