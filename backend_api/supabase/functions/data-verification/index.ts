import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationResult {
  is_valid: boolean
  errors: string[]
  warnings: string[]
  data_integrity_score: number
  completeness_score: number
  accuracy_score: number
  verified_data?: any
}

/**
 * التحقق من صحة بيانات الجدول
 */
async function verifyTableData(supabase: any, tableName: string, data: any): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  let dataIntegrityScore = 100
  let completenessScore = 100
  let accuracyScore = 100

  try {
    // 1. التحقق من وجود الجدول فعلياً
    const { data: tableExists, error: tableError } = await supabase.rpc('execute_sql', {
      sql: `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '${tableName}');`
    })

    if (tableError || !tableExists?.[0]?.exists) {
      errors.push(`Table '${tableName}' does not exist in database`)
      dataIntegrityScore -= 50
    }

    // 2. التحقق من صحة البيانات المرسلة
    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format')
      completenessScore -= 30
    }

    // 3. التحقق من اكتمال البيانات
    if (Array.isArray(data) && data.length === 0) {
      warnings.push('Data array is empty')
      completenessScore -= 20
    }

    // 4. التحقق من الأعمدة المطلوبة
    const { data: columns } = await supabase.rpc('execute_sql', {
      sql: `SELECT column_name, is_nullable, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = '${tableName}';`
    })

    if (columns && Array.isArray(data)) {
      const requiredColumns = columns.filter((col: any) => col.is_nullable === 'NO')
      
      data.forEach((row: any, index: number) => {
        requiredColumns.forEach((col: any) => {
          if (row[col.column_name] === null || row[col.column_name] === undefined) {
            errors.push(`Row ${index}: Missing required column '${col.column_name}'`)
            completenessScore -= 5
          }
        })
      })
    }

    // 5. التحقق من أنواع البيانات
    if (columns && Array.isArray(data)) {
      data.forEach((row: any, index: number) => {
        columns.forEach((col: any) => {
          const value = row[col.column_name]
          if (value !== null && value !== undefined) {
            const isValidType = validateDataType(value, col.data_type)
            if (!isValidType) {
              errors.push(`Row ${index}: Invalid type for column '${col.column_name}'. Expected ${col.data_type}`)
              accuracyScore -= 5
            }
          }
        })
      })
    }

    // 6. التحقق من القيود الفريدة
    const { data: uniqueConstraints } = await supabase.rpc('execute_sql', {
      sql: `SELECT constraint_name, column_name 
            FROM information_schema.constraint_column_usage 
            WHERE table_schema = 'public' AND table_name = '${tableName}' 
            AND constraint_name LIKE '%_key';`
    })

    if (uniqueConstraints && Array.isArray(data)) {
      const uniqueColumns = uniqueConstraints.map((c: any) => c.column_name)
      uniqueColumns.forEach((colName: string) => {
        const values = data.map((row: any) => row[colName])
        const duplicates = values.filter((v: any, i: number) => values.indexOf(v) !== i)
        if (duplicates.length > 0) {
          errors.push(`Duplicate values found in unique column '${colName}': ${duplicates.join(', ')}`)
          dataIntegrityScore -= 10
        }
      })
    }

    // 7. التحقق من القيود الأجنبية
    const { data: foreignKeys } = await supabase.rpc('execute_sql', {
      sql: `SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = '${tableName}';`
    })

    if (foreignKeys && Array.isArray(data)) {
      for (const fk of foreignKeys) {
        const columnName = fk.column_name
        const foreignTable = fk.foreign_table_name
        const foreignColumn = fk.foreign_column_name

        for (const row of data) {
          const value = row[columnName]
          if (value !== null && value !== undefined) {
            const { data: exists } = await supabase.rpc('execute_sql', {
              sql: `SELECT EXISTS (SELECT 1 FROM public.${foreignTable} WHERE ${foreignColumn} = '${value}');`
            })

            if (!exists?.[0]?.exists) {
              errors.push(`Foreign key violation: Value '${value}' in column '${columnName}' does not exist in '${foreignTable}.${foreignColumn}'`)
              dataIntegrityScore -= 15
            }
          }
        }
      }
    }

  } catch (error: any) {
    errors.push(`Verification error: ${error.message}`)
    accuracyScore = 0
  }

  // حساب النتيجة النهائية
  const isValid = errors.length === 0 && dataIntegrityScore >= 70 && completenessScore >= 70 && accuracyScore >= 70

  return {
    is_valid: isValid,
    errors,
    warnings,
    data_integrity_score: Math.max(0, dataIntegrityScore),
    completeness_score: Math.max(0, completenessScore),
    accuracy_score: Math.max(0, accuracyScore),
    verified_data: isValid ? data : null
  }
}

/**
 * التحقق من نوع البيانات
 */
function validateDataType(value: any, expectedType: string): boolean {
  const type = expectedType.toLowerCase()

  if (type.includes('int') || type.includes('serial')) {
    return Number.isInteger(Number(value))
  }
  
  if (type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('double')) {
    return !isNaN(Number(value))
  }
  
  if (type.includes('bool')) {
    return typeof value === 'boolean'
  }
  
  if (type.includes('uuid')) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(String(value))
  }
  
  if (type.includes('timestamp') || type.includes('date')) {
    return !isNaN(Date.parse(String(value)))
  }
  
  if (type.includes('json')) {
    try {
      JSON.parse(typeof value === 'string' ? value : JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  // افتراضياً، نقبل أي نوع نصي
  return true
}

/**
 * التحقق من صحة السياسات الأمنية
 */
async function verifyPolicyData(supabase: any, policyName: string, tableName: string): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  let dataIntegrityScore = 100
  let completenessScore = 100
  let accuracyScore = 100

  try {
    // 1. التحقق من وجود الجدول
    const { data: tableExists } = await supabase.rpc('execute_sql', {
      sql: `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '${tableName}');`
    })

    if (!tableExists?.[0]?.exists) {
      errors.push(`Table '${tableName}' does not exist`)
      dataIntegrityScore -= 50
    }

    // 2. التحقق من وجود السياسة فعلياً
    const { data: policyExists } = await supabase.rpc('execute_sql', {
      sql: `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = '${tableName}' AND policyname = '${policyName}');`
    })

    if (!policyExists?.[0]?.exists) {
      errors.push(`Policy '${policyName}' does not exist on table '${tableName}'`)
      dataIntegrityScore -= 40
    }

    // 3. التحقق من تفعيل RLS على الجدول
    const { data: rlsEnabled } = await supabase.rpc('execute_sql', {
      sql: `SELECT c.relrowsecurity FROM pg_class c WHERE c.relname = '${tableName}';`
    })

    if (!rlsEnabled?.[0]?.relrowsecurity) {
      warnings.push(`RLS is not enabled on table '${tableName}'. Policy may not be effective.`)
      completenessScore -= 20
    }

    // 4. التحقق من صحة تعبيرات السياسة
    const { data: policyDetails } = await supabase.rpc('execute_sql', {
      sql: `SELECT cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = '${tableName}' AND policyname = '${policyName}';`
    })

    if (policyDetails && policyDetails[0]) {
      const policy = policyDetails[0]
      
      if (!policy.qual && !policy.with_check) {
        warnings.push(`Policy '${policyName}' has no USING or WITH CHECK expressions. It may allow unrestricted access.`)
        accuracyScore -= 15
      }
    }

  } catch (error: any) {
    errors.push(`Policy verification error: ${error.message}`)
    accuracyScore = 0
  }

  const isValid = errors.length === 0 && dataIntegrityScore >= 70

  return {
    is_valid: isValid,
    errors,
    warnings,
    data_integrity_score: Math.max(0, dataIntegrityScore),
    completeness_score: Math.max(0, completenessScore),
    accuracy_score: Math.max(0, accuracyScore)
  }
}

/**
 * التحقق الشامل من قاعدة البيانات
 */
async function verifyDatabaseIntegrity(supabase: any): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  let dataIntegrityScore = 100
  let completenessScore = 100
  let accuracyScore = 100

  try {
    // 1. فحص الجداول بدون RLS
    const { data: tablesWithoutRLS } = await supabase.rpc('execute_sql', {
      sql: `SELECT t.tablename 
            FROM pg_tables t 
            JOIN pg_class c ON c.relname = t.tablename 
            WHERE t.schemaname = 'public' AND c.relrowsecurity = false;`
    })

    if (tablesWithoutRLS && tablesWithoutRLS.length > 0) {
      warnings.push(`${tablesWithoutRLS.length} tables without RLS: ${tablesWithoutRLS.map((t: any) => t.tablename).join(', ')}`)
      dataIntegrityScore -= (tablesWithoutRLS.length * 2)
    }

    // 2. فحص الجداول بدون سياسات
    const { data: tablesWithoutPolicies } = await supabase.rpc('execute_sql', {
      sql: `SELECT t.tablename 
            FROM pg_tables t 
            JOIN pg_class c ON c.relname = t.tablename 
            LEFT JOIN pg_policies p ON p.tablename = t.tablename 
            WHERE t.schemaname = 'public' AND c.relrowsecurity = true 
            GROUP BY t.tablename 
            HAVING COUNT(p.policyname) = 0;`
    })

    if (tablesWithoutPolicies && tablesWithoutPolicies.length > 0) {
      errors.push(`${tablesWithoutPolicies.length} tables with RLS enabled but no policies: ${tablesWithoutPolicies.map((t: any) => t.tablename).join(', ')}`)
      dataIntegrityScore -= (tablesWithoutPolicies.length * 5)
    }

    // 3. فحص القيود الأجنبية المكسورة
    const { data: brokenForeignKeys } = await supabase.rpc('execute_sql', {
      sql: `SELECT conname, conrelid::regclass AS table_name 
            FROM pg_constraint 
            WHERE contype = 'f' AND convalidated = false;`
    })

    if (brokenForeignKeys && brokenForeignKeys.length > 0) {
      errors.push(`${brokenForeignKeys.length} broken foreign key constraints found`)
      dataIntegrityScore -= (brokenForeignKeys.length * 10)
    }

    // 4. فحص الفهارس المفقودة على الأعمدة الأجنبية
    const { data: missingIndexes } = await supabase.rpc('execute_sql', {
      sql: `SELECT tc.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            AND NOT EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE schemaname = 'public' 
              AND tablename = tc.table_name 
              AND indexdef LIKE '%' || kcu.column_name || '%'
            );`
    })

    if (missingIndexes && missingIndexes.length > 0) {
      warnings.push(`${missingIndexes.length} foreign key columns without indexes (may affect performance)`)
      completenessScore -= (missingIndexes.length * 3)
    }

    // 5. فحص الجداول الفارغة
    const { data: tables } = await supabase.rpc('execute_sql', {
      sql: `SELECT tablename FROM pg_tables WHERE schemaname = 'public';`
    })

    if (tables) {
      for (const table of tables) {
        const { data: count } = await supabase.rpc('execute_sql', {
          sql: `SELECT COUNT(*) as count FROM public.${table.tablename};`
        })
        
        if (count && count[0].count === 0) {
          warnings.push(`Table '${table.tablename}' is empty`)
        }
      }
    }

  } catch (error: any) {
    errors.push(`Database integrity check error: ${error.message}`)
    accuracyScore = 0
  }

  const isValid = errors.length === 0 && dataIntegrityScore >= 80

  return {
    is_valid: isValid,
    errors,
    warnings,
    data_integrity_score: Math.max(0, dataIntegrityScore),
    completeness_score: Math.max(0, completenessScore),
    accuracy_score: Math.max(0, accuracyScore)
  }
}

serve(async (req) => {
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

    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    let response: any

    // POST /api/verify/table-data - التحقق من بيانات جدول
    if (method === 'POST' && path === '/api/verify/table-data') {
      const body = await req.json()
      const { table_name, data } = body

      if (!table_name || !data) {
        throw new Error('Missing required fields: table_name, data')
      }

      const result = await verifyTableData(supabaseClient, table_name, data)
      response = { success: true, verification: result }
    }

    // POST /api/verify/policy - التحقق من سياسة أمنية
    else if (method === 'POST' && path === '/api/verify/policy') {
      const body = await req.json()
      const { policy_name, table_name } = body

      if (!policy_name || !table_name) {
        throw new Error('Missing required fields: policy_name, table_name')
      }

      const result = await verifyPolicyData(supabaseClient, policy_name, table_name)
      response = { success: true, verification: result }
    }

    // GET /api/verify/database-integrity - التحقق الشامل من قاعدة البيانات
    else if (method === 'GET' && path === '/api/verify/database-integrity') {
      const result = await verifyDatabaseIntegrity(supabaseClient)
      response = { success: true, verification: result }
    }

    else {
      throw new Error('Invalid endpoint or method')
    }

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
