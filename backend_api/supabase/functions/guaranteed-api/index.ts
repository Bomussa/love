import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_TIMEOUT_MS = 25000 // 25 ثانية (أقل من timeout Supabase Edge Functions)
const MAX_EXECUTION_TIME_MS = 20000 // 20 ثانية للتنفيذ الفعلي

interface OperationConfig {
  operationType: string
  operationName: string
  requestData: any
  timeoutMs?: number
  priority?: number
  maxRetries?: number
}

/**
 * إنشاء عملية في الطابور مع ضمان الرد
 */
async function createQueuedOperation(
  supabase: any,
  userId: string,
  config: OperationConfig
): Promise<string> {
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS
  const timeoutAt = new Date(Date.now() + timeoutMs)

  const { data, error } = await supabase
    .from('operation_queue')
    .insert({
      operation_type: config.operationType,
      operation_name: config.operationName,
      request_data: config.requestData,
      user_id: userId,
      timeout_at: timeoutAt.toISOString(),
      priority: config.priority || 5,
      max_retries: config.maxRetries || 3,
      status: 'processing'
    })
    .select()
    .single()

  if (error) throw error
  return data.id
}

/**
 * تنفيذ عملية مع ضمان الرد
 */
async function executeWithGuarantee(
  supabase: any,
  operationId: string,
  executionFn: () => Promise<any>
): Promise<any> {
  const startTime = Date.now()

  try {
    // تحديث التقدم: بدء العملية
    await supabase.rpc('update_operation_progress', {
      p_operation_id: operationId,
      p_progress: 10,
      p_current_step: 'Starting operation',
      p_message: 'Operation initiated'
    })

    // تنفيذ العملية مع timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), MAX_EXECUTION_TIME_MS)
    )

    const result = await Promise.race([
      executionFn(),
      timeoutPromise
    ])

    // تحديث التقدم: اكتمال العملية
    await supabase.rpc('update_operation_progress', {
      p_operation_id: operationId,
      p_progress: 100,
      p_current_step: 'Completed',
      p_message: 'Operation completed successfully'
    })

    // حفظ النتيجة النهائية
    await supabase.rpc('save_partial_result', {
      p_operation_id: operationId,
      p_result_part: result,
      p_part_number: 1,
      p_total_parts: 1,
      p_is_final: true
    })

    // تحديث حالة العملية
    await supabase
      .from('operation_queue')
      .update({
        status: 'completed',
        result: result,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', operationId)

    return {
      success: true,
      operation_id: operationId,
      execution_time_ms: Date.now() - startTime,
      data: result
    }

  } catch (error: any) {
    // في حالة الخطأ، نحفظ نتيجة جزئية أو رد احتياطي
    const { data: fallback } = await supabase.rpc('get_fallback_response', {
      p_operation_type: 'general'
    })

    // تحديث حالة العملية
    await supabase
      .from('operation_queue')
      .update({
        status: error.message === 'Operation timeout' ? 'timeout' : 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', operationId)

    // إرجاع رد احتياطي بدلاً من فشل كامل
    return {
      success: false,
      operation_id: operationId,
      execution_time_ms: Date.now() - startTime,
      status: 'fallback',
      message: error.message,
      fallback_data: fallback || {
        message: 'Operation failed but system is operational',
        retry_available: true
      }
    }
  }
}

/**
 * الحصول على حالة عملية
 */
async function getOperationStatus(supabase: any, operationId: string): Promise<any> {
  // الحصول على معلومات العملية
  const { data: operation, error: opError } = await supabase
    .from('operation_queue')
    .select('*')
    .eq('id', operationId)
    .single()

  if (opError) throw opError

  // الحصول على آخر تقدم
  const { data: progress } = await supabase
    .from('operation_progress')
    .select('*')
    .eq('operation_id', operationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // الحصول على النتائج الجزئية
  const { data: partialResults } = await supabase
    .from('partial_results')
    .select('*')
    .eq('operation_id', operationId)
    .order('part_number')

  return {
    operation,
    progress,
    partial_results: partialResults || [],
    has_final_result: partialResults?.some((r: any) => r.is_final) || false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestStartTime = Date.now()

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      // حتى بدون مصادقة، نرجع رد احتياطي
      return new Response(
        JSON.stringify({
          success: false,
          status: 'fallback',
          message: 'Authentication required',
          fallback_data: { authenticated: false }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'fallback',
          message: 'Invalid authentication',
          fallback_data: { authenticated: false }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    let response: any

    // POST /api/guaranteed/execute - تنفيذ عملية مع ضمان الرد
    if (method === 'POST' && path === '/api/guaranteed/execute') {
      const body = await req.json()
      const { operation_type, operation_name, operation_data, timeout_ms } = body

      if (!operation_type || !operation_name) {
        throw new Error('Missing required fields: operation_type, operation_name')
      }

      // إنشاء عملية في الطابور
      const operationId = await createQueuedOperation(supabaseClient, user.id, {
        operationType: operation_type,
        operationName: operation_name,
        requestData: operation_data || {},
        timeoutMs: timeout_ms
      })

      // تنفيذ العملية حسب النوع
      let executionFn: () => Promise<any>

      switch (operation_type) {
        case 'get_tables':
          executionFn = async () => {
            const { data, error } = await supabaseClient.rpc('execute_sql', {
              sql: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
            })
            if (error) throw error
            return { tables: data }
          }
          break

        case 'get_policies':
          executionFn = async () => {
            const { data, error } = await supabaseClient.rpc('execute_sql', {
              sql: "SELECT * FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;"
            })
            if (error) throw error
            return { policies: data }
          }
          break

        case 'verify_database':
          executionFn = async () => {
            // التحقق من RLS
            const { data: rlsData } = await supabaseClient.rpc('execute_sql', {
              sql: `SELECT COUNT(*) FILTER (WHERE c.relrowsecurity = true) as enabled,
                           COUNT(*) FILTER (WHERE c.relrowsecurity = false) as disabled
                    FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename
                    WHERE t.schemaname = 'public';`
            })

            // التحقق من السياسات
            const { data: policiesData } = await supabaseClient.rpc('execute_sql', {
              sql: "SELECT COUNT(*) as count FROM pg_policies WHERE schemaname = 'public';"
            })

            return {
              rls_status: rlsData?.[0] || {},
              total_policies: policiesData?.[0]?.count || 0,
              verified_at: new Date().toISOString()
            }
          }
          break

        default:
          executionFn = async () => ({
            message: 'Operation type not implemented',
            operation_type
          })
      }

      // تنفيذ مع ضمان الرد
      response = await executeWithGuarantee(supabaseClient, operationId, executionFn)
    }

    // GET /api/guaranteed/status/:id - الحصول على حالة عملية
    else if (method === 'GET' && path.includes('/status/')) {
      const operationId = path.split('/').pop()
      
      if (!operationId) {
        throw new Error('Missing operation ID')
      }

      const status = await getOperationStatus(supabaseClient, operationId)
      response = { success: true, ...status }
    }

    // GET /api/guaranteed/health - فحص صحة النظام
    else if (method === 'GET' && path === '/api/guaranteed/health') {
      // دائماً نرجع رد، حتى لو كان النظام معطل
      try {
        const { data: queueStats } = await supabaseClient
          .from('operation_queue')
          .select('status')

        const stats = {
          total: queueStats?.length || 0,
          pending: queueStats?.filter((q: any) => q.status === 'pending').length || 0,
          processing: queueStats?.filter((q: any) => q.status === 'processing').length || 0,
          completed: queueStats?.filter((q: any) => q.status === 'completed').length || 0,
          failed: queueStats?.filter((q: any) => q.status === 'failed').length || 0
        }

        response = {
          success: true,
          status: 'healthy',
          uptime_ms: Date.now() - requestStartTime,
          queue_stats: stats
        }
      } catch (error) {
        // حتى في حالة الخطأ، نرجع رد
        response = {
          success: false,
          status: 'degraded',
          message: 'System is operational but some features may be limited',
          uptime_ms: Date.now() - requestStartTime
        }
      }
    }

    else {
      // رد احتياطي لأي endpoint غير معروف
      response = {
        success: false,
        status: 'fallback',
        message: 'Unknown endpoint',
        available_endpoints: [
          'POST /api/guaranteed/execute',
          'GET /api/guaranteed/status/:id',
          'GET /api/guaranteed/health'
        ]
      }
    }

    // ضمان وجود رد دائماً
    if (!response) {
      response = {
        success: false,
        status: 'fallback',
        message: 'No response generated',
        timestamp: new Date().toISOString()
      }
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    // حتى في حالة الخطأ الكامل، نرجع رد مفيد
    const fallbackResponse = {
      success: false,
      status: 'error',
      message: error.message || 'An unexpected error occurred',
      error_type: error.name || 'UnknownError',
      timestamp: new Date().toISOString(),
      execution_time_ms: Date.now() - requestStartTime,
      fallback_data: {
        system_operational: true,
        retry_recommended: true
      }
    }

    return new Response(
      JSON.stringify(fallbackResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
