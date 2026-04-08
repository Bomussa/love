import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function logApiUsage(supabase: any, log: any) {
  try {
    await supabase.from('api_logs').insert(log)
  } catch (error) {
    console.error('Error logging API usage:', error)
  }
}

async function checkApiStatus(supabase: any, apiName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('api_status')
    .select('is_active')
    .eq('api_name', apiName)
    .single()
  
  if (error || !data) return false
  return data.is_active
}

serve(async (req) => {
  const startTime = Date.now()
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من أن المستخدم إداري
    const { data: admin } = await supabaseClient
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!admin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin only.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    let response: any
    let apiName = ''

    // GET /api/db/policies - عرض جميع السياسات
    if (method === 'GET' && path === '/api/db/policies') {
      apiName = 'get_all_policies'
      if (!await checkApiStatus(supabaseClient, apiName)) {
        throw new Error('API is disabled')
      }

      const { data, error } = await supabaseClient
        .from('pg_policies')
        .select('*')
        .eq('schemaname', 'public')

      if (error) throw error
      response = { success: true, data }
    }

    // GET /api/db/tables/:name/policies - عرض سياسات جدول معين
    else if (method === 'GET' && path.includes('/policies')) {
      apiName = 'get_table_policies'
      if (!await checkApiStatus(supabaseClient, apiName)) {
        throw new Error('API is disabled')
      }

      const tableName = path.split('/')[4]
      
      const { data, error } = await supabaseClient.rpc('execute_sql', {
        sql: `SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = '${tableName}';`
      })

      if (error) throw error
      response = { success: true, data }
    }

    // POST /api/db/policies - إنشاء سياسة جديدة
    else if (method === 'POST' && path === '/api/db/policies') {
      apiName = 'create_policy'
      if (!await checkApiStatus(supabaseClient, apiName)) {
        throw new Error('API is disabled')
      }

      const body = await req.json()
      const { policy_name, table_name, command, using_expression, with_check_expression } = body

      if (!policy_name || !table_name || !command) {
        throw new Error('Missing required fields: policy_name, table_name, command')
      }

      let createPolicySQL = `CREATE POLICY ${policy_name} ON public.${table_name} FOR ${command}`
      
      if (using_expression) {
        createPolicySQL += ` USING (${using_expression})`
      }
      
      if (with_check_expression) {
        createPolicySQL += ` WITH CHECK (${with_check_expression})`
      }
      
      createPolicySQL += ';'

      const { error } = await supabaseClient.rpc('execute_sql', { sql: createPolicySQL })
      if (error) throw error

      // حفظ في جدول الإدارة
      await supabaseClient.from('db_policy_management').insert({
        policy_name,
        table_name,
        policy_command: command,
        policy_definition: createPolicySQL,
        created_by: user.id
      })

      response = { success: true, message: 'Policy created successfully', policy_name }
    }

    // DELETE /api/db/policies/:name - حذف سياسة
    else if (method === 'DELETE' && path.startsWith('/api/db/policies/')) {
      apiName = 'delete_policy'
      if (!await checkApiStatus(supabaseClient, apiName)) {
        throw new Error('API is disabled')
      }

      const body = await req.json()
      const { table_name } = body
      const policyName = path.split('/')[4]

      if (!table_name) {
        throw new Error('Missing required field: table_name')
      }

      const { error } = await supabaseClient.rpc('execute_sql', {
        sql: `DROP POLICY IF EXISTS ${policyName} ON public.${table_name};`
      })
      if (error) throw error

      // حذف من جدول الإدارة
      await supabaseClient
        .from('db_policy_management')
        .delete()
        .eq('policy_name', policyName)
        .eq('table_name', table_name)

      response = { success: true, message: 'Policy deleted successfully' }
    }

    // PATCH /api/db/policies/:name/toggle - تفعيل/تعطيل سياسة
    else if (method === 'PATCH' && path.includes('/toggle')) {
      apiName = 'toggle_policy'
      if (!await checkApiStatus(supabaseClient, apiName)) {
        throw new Error('API is disabled')
      }

      const policyName = path.split('/')[4]
      const body = await req.json()
      const { table_name, enable } = body

      if (!table_name) {
        throw new Error('Missing required field: table_name')
      }

      // في PostgreSQL، لا يمكن تعطيل سياسة مباشرة، يجب حذفها وإعادة إنشائها
      // لذلك سنقوم بتحديث حالتها في جدول الإدارة فقط
      await supabaseClient
        .from('db_policy_management')
        .update({ is_active: enable, updated_at: new Date().toISOString() })
        .eq('policy_name', policyName)
        .eq('table_name', table_name)

      response = { 
        success: true, 
        message: `Policy ${enable ? 'enabled' : 'disabled'} in management system`,
        note: 'PostgreSQL does not support disabling policies. Policy status updated in management table only.'
      }
    }

    else {
      throw new Error('Invalid endpoint or method')
    }

    const executionTime = Date.now() - startTime

    // تسجيل الاستخدام
    await logApiUsage(supabaseClient, {
      api_name: apiName,
      user_id: user.id,
      request_method: method,
      request_path: path,
      response_status: 200,
      response_body: response,
      execution_time_ms: executionTime,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown'
    })

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
