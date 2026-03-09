// Supabase Edge Function: reports-daily
// Daily activity reports split into clinic/admin endpoints with role guard
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authErrorResponse, requireAuthGuard } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'access-control-allow-origin': 'https://mmc-mms.com',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    const isAdminEndpoint = path.endsWith('/admin');
    const isClinicEndpoint = path.endsWith('/clinic');

    if (!isAdminEndpoint && !isClinicEndpoint) {
      return new Response(
        JSON.stringify({ success: false, error: 'Use /reports-daily/clinic or /reports-daily/admin' }),
        { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    const guard = await requireAuthGuard(req, {
      allowedRoles: isAdminEndpoint ? ['admin'] : ['clinic', 'admin'],
      corsHeaders,
    });

    if ('response' in guard) {
      return guard.response;
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const date = url.searchParams.get('date');
    const format = url.searchParams.get('format') || 'json';

    let query = db.from('vw_daily_activity').select('*');

    if (date) {
      query = query.eq('day', date);
    }

    if (isClinicEndpoint) {
      const clinicFromQuery = url.searchParams.get('clinic_id');
      if (guard.auth.role === 'clinic' && !guard.auth.clinicId) {
        return authErrorResponse(403, corsHeaders);
      }

      const clinicId = guard.auth.role === 'admin' ? clinicFromQuery : guard.auth.clinicId;

      if (!clinicId) {
        return new Response(
          JSON.stringify({ success: false, error: 'clinic_id is required for clinic reports' }),
          { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
        );
      }

      if (guard.auth.role === 'clinic' && guard.auth.clinicId && guard.auth.clinicId !== clinicId) {
        return authErrorResponse(403, corsHeaders);
      }

      query = query.eq('clinic_id', clinicId);
    }

    const { data, error } = await query.order('day', { ascending: false }).limit(100);

    if (error) throw error;

    if (format === 'print') {
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
        headers: { 'content-type': 'text/html; charset=UTF-8', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          report_type: 'daily',
          date_filter: date || 'all',
          endpoint_scope: isAdminEndpoint ? 'admin' : 'clinic',
          records: data || [],
          total_records: data?.length || 0,
        },
      }),
      { headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  }
});
