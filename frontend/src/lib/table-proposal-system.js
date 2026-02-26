/**
 * table-proposal-system.js
 * نظام إدارة قاعدة البيانات الكامل من شاشة الإدارة
 * يدعم: إنشاء جداول + تعديل أعمدة + إضافة/حذف صفوف + تغيير مسميات + تعديل خواص + سياسات RLS + قيود
 * كل عملية تمر بموافقة الأدمن قبل التنفيذ
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================
// أنواع العمليات المدعومة
// ============================
export const OPERATION_TYPES = {
  CREATE_TABLE:    'create_table',
  ALTER_TABLE:     'alter_table',
  DROP_TABLE:      'drop_table',
  ADD_COLUMN:      'add_column',
  ALTER_COLUMN:    'alter_column',
  DROP_COLUMN:     'drop_column',
  RENAME_COLUMN:   'rename_column',
  RENAME_TABLE:    'rename_table',
  ADD_POLICY:      'add_policy',
  ALTER_POLICY:    'alter_policy',
  DROP_POLICY:     'drop_policy',
  ADD_INDEX:       'add_index',
  DROP_INDEX:      'drop_index',
  ADD_CONSTRAINT:  'add_constraint',
  DROP_CONSTRAINT: 'drop_constraint',
  INSERT_ROW:      'insert_row',
  UPDATE_ROW:      'update_row',
  DELETE_ROW:      'delete_row',
  BULK_INSERT:     'bulk_insert',
};

// أنواع الأعمدة المدعومة
export const COLUMN_TYPES = [
  'uuid', 'text', 'varchar', 'char',
  'integer', 'bigint', 'smallint', 'serial', 'bigserial',
  'boolean',
  'numeric', 'decimal', 'real', 'double precision',
  'date', 'time', 'timestamp', 'timestamptz',
  'jsonb', 'json',
  'bytea', 'inet', 'cidr',
];

// ============================
// توليد SQL تلقائياً
// ============================
export function generateSQL(operation) {
  const { type, payload } = operation;

  switch (type) {

    case OPERATION_TYPES.CREATE_TABLE: {
      const { table_name, columns, rls_enabled, policies } = payload;
      const colDefs = columns.map(c => {
        let def = `  ${c.name} ${c.type}`;
        if (c.primary_key) def += ' PRIMARY KEY';
        if (c.default_value !== undefined && c.default_value !== '') def += ` DEFAULT ${c.default_value}`;
        if (c.not_null && !c.primary_key) def += ' NOT NULL';
        if (c.unique && !c.primary_key) def += ' UNIQUE';
        if (c.references) def += ` REFERENCES ${c.references}`;
        return def;
      }).join(',\n');

      let sql = `-- إنشاء جدول: ${table_name}\nCREATE TABLE IF NOT EXISTS ${table_name} (\n${colDefs}\n);\n`;

      if (rls_enabled) {
        sql += `\n-- تفعيل RLS\nALTER TABLE ${table_name} ENABLE ROW LEVEL SECURITY;\n`;
      }

      if (policies && policies.length > 0) {
        policies.forEach(p => {
          sql += `\n-- سياسة: ${p.name}\nCREATE POLICY "${p.name}" ON ${table_name}\n  FOR ${p.command || 'ALL'}\n  USING (${p.using || 'true'})`;
          if (p.with_check) sql += `\n  WITH CHECK (${p.with_check})`;
          sql += ';\n';
        });
      }

      return sql;
    }

    case OPERATION_TYPES.ALTER_TABLE: {
      const { table_name, new_name } = payload;
      return `-- إعادة تسمية الجدول\nALTER TABLE ${table_name} RENAME TO ${new_name};\n`;
    }

    case OPERATION_TYPES.DROP_TABLE: {
      const { table_name, cascade } = payload;
      return `-- حذف الجدول\nDROP TABLE IF EXISTS ${table_name}${cascade ? ' CASCADE' : ''};\n`;
    }

    case OPERATION_TYPES.ADD_COLUMN: {
      const { table_name, column } = payload;
      let def = `${column.type}`;
      if (column.default_value !== undefined && column.default_value !== '') def += ` DEFAULT ${column.default_value}`;
      if (column.not_null) def += ' NOT NULL';
      if (column.unique) def += ' UNIQUE';
      return `-- إضافة عمود\nALTER TABLE ${table_name} ADD COLUMN IF NOT EXISTS ${column.name} ${def};\n`;
    }

    case OPERATION_TYPES.ALTER_COLUMN: {
      const { table_name, column_name, changes } = payload;
      let sqls = [];
      if (changes.new_type) sqls.push(`ALTER TABLE ${table_name} ALTER COLUMN ${column_name} TYPE ${changes.new_type} USING ${column_name}::${changes.new_type};`);
      if (changes.set_default !== undefined) sqls.push(`ALTER TABLE ${table_name} ALTER COLUMN ${column_name} SET DEFAULT ${changes.set_default};`);
      if (changes.drop_default) sqls.push(`ALTER TABLE ${table_name} ALTER COLUMN ${column_name} DROP DEFAULT;`);
      if (changes.set_not_null) sqls.push(`ALTER TABLE ${table_name} ALTER COLUMN ${column_name} SET NOT NULL;`);
      if (changes.drop_not_null) sqls.push(`ALTER TABLE ${table_name} ALTER COLUMN ${column_name} DROP NOT NULL;`);
      return `-- تعديل عمود\n${sqls.join('\n')}\n`;
    }

    case OPERATION_TYPES.DROP_COLUMN: {
      const { table_name, column_name, cascade } = payload;
      return `-- حذف عمود\nALTER TABLE ${table_name} DROP COLUMN IF EXISTS ${column_name}${cascade ? ' CASCADE' : ''};\n`;
    }

    case OPERATION_TYPES.RENAME_COLUMN: {
      const { table_name, old_name, new_name } = payload;
      return `-- إعادة تسمية عمود\nALTER TABLE ${table_name} RENAME COLUMN ${old_name} TO ${new_name};\n`;
    }

    case OPERATION_TYPES.ADD_POLICY: {
      const { table_name, policy } = payload;
      let sql = `-- إضافة سياسة RLS\nCREATE POLICY "${policy.name}" ON ${table_name}\n  FOR ${policy.command || 'ALL'}\n  USING (${policy.using || 'true'})`;
      if (policy.with_check) sql += `\n  WITH CHECK (${policy.with_check})`;
      return sql + ';\n';
    }

    case OPERATION_TYPES.ALTER_POLICY: {
      const { table_name, policy_name, new_using, new_with_check } = payload;
      let sql = `-- تعديل سياسة RLS\nALTER POLICY "${policy_name}" ON ${table_name}`;
      if (new_using) sql += `\n  USING (${new_using})`;
      if (new_with_check) sql += `\n  WITH CHECK (${new_with_check})`;
      return sql + ';\n';
    }

    case OPERATION_TYPES.DROP_POLICY: {
      const { table_name, policy_name } = payload;
      return `-- حذف سياسة RLS\nDROP POLICY IF EXISTS "${policy_name}" ON ${table_name};\n`;
    }

    case OPERATION_TYPES.ADD_INDEX: {
      const { table_name, index_name, columns, unique } = payload;
      return `-- إضافة فهرس\nCREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${index_name} ON ${table_name}(${columns.join(', ')});\n`;
    }

    case OPERATION_TYPES.DROP_INDEX: {
      const { index_name } = payload;
      return `-- حذف فهرس\nDROP INDEX IF EXISTS ${index_name};\n`;
    }

    case OPERATION_TYPES.ADD_CONSTRAINT: {
      const { table_name, constraint_name, constraint_def } = payload;
      return `-- إضافة قيد\nALTER TABLE ${table_name} ADD CONSTRAINT ${constraint_name} ${constraint_def};\n`;
    }

    case OPERATION_TYPES.DROP_CONSTRAINT: {
      const { table_name, constraint_name } = payload;
      return `-- حذف قيد\nALTER TABLE ${table_name} DROP CONSTRAINT IF EXISTS ${constraint_name};\n`;
    }

    case OPERATION_TYPES.INSERT_ROW: {
      const { table_name, row } = payload;
      const keys = Object.keys(row);
      const vals = keys.map(k => typeof row[k] === 'string' ? `'${row[k].replace(/'/g, "''")}'` : row[k]);
      return `-- إدراج صف\nINSERT INTO ${table_name} (${keys.join(', ')}) VALUES (${vals.join(', ')});\n`;
    }

    case OPERATION_TYPES.UPDATE_ROW: {
      const { table_name, row_id, updates } = payload;
      const sets = Object.entries(updates).map(([k, v]) => `${k} = ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v}`);
      return `-- تحديث صف\nUPDATE ${table_name} SET ${sets.join(', ')} WHERE id = '${row_id}';\n`;
    }

    case OPERATION_TYPES.DELETE_ROW: {
      const { table_name, row_id } = payload;
      return `-- حذف صف\nDELETE FROM ${table_name} WHERE id = '${row_id}';\n`;
    }

    case OPERATION_TYPES.BULK_INSERT: {
      const { table_name, rows } = payload;
      if (!rows || rows.length === 0) return '';
      const keys = Object.keys(rows[0]);
      const vals = rows.map(r => `(${keys.map(k => typeof r[k] === 'string' ? `'${r[k].replace(/'/g, "''")}'` : r[k]).join(', ')})`);
      return `-- إدراج جماعي\nINSERT INTO ${table_name} (${keys.join(', ')}) VALUES\n${vals.join(',\n')};\n`;
    }

    default:
      return `-- عملية غير معروفة: ${type}`;
  }
}

// ============================
// حفظ الاقتراح في Supabase
// ============================
export async function saveProposal(proposal) {
  try {
    const sql = generateSQL({ type: proposal.operation_type, payload: proposal.payload });
    const { data, error } = await supabase
      .from('table_proposals')
      .insert({
        table_name:    proposal.table_name,
        feature_name:  proposal.feature_name,
        purpose:       proposal.purpose,
        goal:          proposal.goal,
        columns:       proposal.payload?.columns || [],
        status:        'pending',
        proposed_by:   proposal.proposed_by || 'admin',
        sql_generated: sql,
        // حفظ كامل البيانات في columns كـ metadata
        columns: proposal.payload || {},
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data, sql };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================
// جلب الاقتراحات
// ============================
export async function getProposals(status = null) {
  try {
    let query = supabase
      .from('table_proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================
// الموافقة على الاقتراح وتنفيذه
// ============================
export async function approveAndExecute(proposalId, reviewedBy, reviewNote = '') {
  try {
    // 1. جلب الاقتراح
    const { data: proposal, error: fetchErr } = await supabase
      .from('table_proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (fetchErr || !proposal) throw new Error('الاقتراح غير موجود');
    if (proposal.status !== 'pending') throw new Error(`الاقتراح في حالة: ${proposal.status}`);

    const sql = proposal.sql_generated;
    if (!sql) throw new Error('لا يوجد SQL مولّد');

    // 2. تنفيذ SQL عبر Supabase RPC
    const { error: execErr } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => ({ error: { message: 'RPC غير متاح' } }));

    // 3. محاولة بديلة: تنفيذ مباشر عبر REST
    let execSuccess = !execErr;
    let execError = execErr?.message || '';

    if (!execSuccess) {
      // محاولة تنفيذ عبر fetch مباشر
      try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON,
            'Authorization': `Bearer ${SUPABASE_ANON}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql_query: sql }),
        });
        execSuccess = resp.ok;
        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          execError = errBody.message || `HTTP ${resp.status}`;
        }
      } catch (e) {
        execError = e.message;
      }
    }

    // 4. تحديث حالة الاقتراح
    const newStatus = execSuccess ? 'created' : 'failed';
    const { error: updateErr } = await supabase
      .from('table_proposals')
      .update({
        status:           newStatus,
        reviewed_by:      reviewedBy,
        review_note:      reviewNote || (execSuccess ? 'تم التنفيذ بنجاح' : `فشل: ${execError}`),
        reviewed_at:      new Date().toISOString(),
        created_in_db_at: execSuccess ? new Date().toISOString() : null,
      })
      .eq('id', proposalId);

    if (updateErr) throw updateErr;

    return {
      success: execSuccess,
      status: newStatus,
      sql,
      error: execSuccess ? null : execError,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================
// رفض الاقتراح
// ============================
export async function rejectProposal(proposalId, reviewedBy, reason) {
  try {
    const { error } = await supabase
      .from('table_proposals')
      .update({
        status:      'rejected',
        reviewed_by: reviewedBy,
        review_note: reason || 'تم الرفض من قبل الأدمن',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================
// جلب قائمة الجداول الموجودة في Supabase
// ============================
export async function getExistingTables() {
  try {
    const { data, error } = await supabase
      .from('table_proposals')
      .select('table_name')
      .eq('status', 'created');

    // جداول ثابتة معروفة
    const knownTables = [
      'clinics', 'unified_queue', 'settings', 'notifications', 'users',
      'floor_directions', 'exam_routes', 'smart_errors_log', 'smart_fixes_log',
      'daily_activity_logs', 'device_logins', 'permanent_audit_logs', 'table_proposals',
    ];

    const createdTables = (data || []).map(r => r.table_name);
    const allTables = [...new Set([...knownTables, ...createdTables])];

    return { success: true, tables: allTables };
  } catch (err) {
    return { success: false, tables: [], error: err.message };
  }
}

// ============================
// جلب أعمدة جدول معين
// ============================
export async function getTableColumns(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) throw error;

    // استخراج أسماء الأعمدة من أول صف
    const columns = data && data.length > 0
      ? Object.keys(data[0]).map(name => ({ name, type: 'unknown' }))
      : [];

    return { success: true, columns };
  } catch (err) {
    return { success: false, columns: [], error: err.message };
  }
}

// ============================
// التحقق من وجود جدول
// ============================
export async function tableExists(tableName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);
    return !error;
  } catch {
    return false;
  }
}

// ============================
// إحصاءات النظام
// ============================
export async function getProposalStats() {
  try {
    const { data, error } = await supabase
      .from('table_proposals')
      .select('status');

    if (error) throw error;

    const stats = { pending: 0, approved: 0, rejected: 0, created: 0, failed: 0, total: 0 };
    (data || []).forEach(r => {
      stats[r.status] = (stats[r.status] || 0) + 1;
      stats.total++;
    });

    return { success: true, stats };
  } catch (err) {
    return { success: false, stats: {}, error: err.message };
  }
}

export default {
  OPERATION_TYPES,
  COLUMN_TYPES,
  generateSQL,
  saveProposal,
  getProposals,
  approveAndExecute,
  rejectProposal,
  getExistingTables,
  getTableColumns,
  tableExists,
  getProposalStats,
};
