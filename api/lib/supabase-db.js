/**
 * Supabase Database Wrapper - Functional Approach
 * يوفر نفس interface كـ db.js لكن يستخدم Supabase
 * محسّن للسرعة والدقة
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

if (typeof window !== 'undefined') {
  // Browser environment
  supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
} else if (supabaseUrl && supabaseKey) {
  // Server environment
  supabase = createClient(supabaseUrl, supabaseKey);
}

class SupabaseDB {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * تنفيذ query - يحول SQL-like إلى Supabase calls
   */
  async query(sql, params = []) {
    if (!this.supabase) {
      console.error('[SupabaseDB] Client not initialized');
      return { rows: [] };
    }

    try {
      // تحليل نوع الـ query
      const sqlUpper = sql.trim().toUpperCase();
      
      // ==========================================
      // SELECT QUERIES
      // ==========================================
      if (sqlUpper.startsWith('SELECT')) {
        return await this._handleSelect(sql, params);
      }
      
      // ==========================================
      // INSERT QUERIES
      // ==========================================
      if (sqlUpper.startsWith('INSERT')) {
        return await this._handleInsert(sql, params);
      }
      
      // ==========================================
      // UPDATE QUERIES
      // ==========================================
      if (sqlUpper.startsWith('UPDATE')) {
        return await this._handleUpdate(sql, params);
      }
      
      // ==========================================
      // DELETE QUERIES
      // ==========================================
      if (sqlUpper.startsWith('DELETE')) {
        return await this._handleDelete(sql, params);
      }
      
      console.warn('[SupabaseDB] Unsupported query type:', sql.substring(0, 50));
      return { rows: [] };
      
    } catch (error) {
      console.error('[SupabaseDB] Query error:', error.message);
      console.error('[SupabaseDB] SQL:', sql);
      console.error('[SupabaseDB] Params:', params);
      return { rows: [] };
    }
  }

  /**
   * معالجة SELECT queries
   */
  async _handleSelect(sql, params) {
    // استخراج اسم الجدول
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      console.warn('[SupabaseDB] Could not extract table name from:', sql);
      return { rows: [] };
    }
    
    const tableName = tableMatch[1];
    let selectColumns = '*';
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch && selectMatch[1] !== '*') {
      selectColumns = selectMatch[1].trim();
    }
    let query = this.supabase.from(tableName).select(selectColumns);
    
    // ==========================================
    // WHERE CONDITIONS
    // ==========================================
    if (sql.includes('WHERE')) {
      // clinic_id = $1
      if (sql.includes('clinic_id') && params[0] !== undefined) {
        query = query.eq('clinic_id', params[0]);
      }
      
      // patient_id = $1 or $2
      if (sql.includes('patient_id')) {
        const paramIndex = sql.indexOf('patient_id') < sql.indexOf('clinic_id') ? 0 : 1;
        if (params[paramIndex] !== undefined) {
          query = query.eq('patient_id', params[paramIndex]);
        }
      }
      
      // status = 'waiting' or status = $1
      if (sql.includes('status')) {
        if (sql.includes("status = 'waiting'")) {
          query = query.eq('status', 'waiting');
        } else if (sql.includes("status = 'called'")) {
          query = query.eq('status', 'called');
        } else if (params.some(p => ['waiting', 'called', 'in', 'done', 'no_show'].includes(p))) {
          const statusParam = params.find(p => ['waiting', 'called', 'in', 'done', 'no_show'].includes(p));
          query = query.eq('status', statusParam);
        }
      }
      
      // DATE(created_at) = CURRENT_DATE
      if (sql.includes('DATE(created_at) = CURRENT_DATE') || sql.includes('created_at::date = CURRENT_DATE')) {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('created_at', today).lt('created_at', today + 'T23:59:59.999Z');
      }
      
      // exam_type = $1
      if (sql.includes('exam_type') && params.find(p => typeof p === 'string' && p.length > 0)) {
        const examType = params.find(p => typeof p === 'string' && !['male', 'female'].includes(p));
        if (examType) {
          query = query.eq('exam_type', examType);
        }
      }
      
      // gender = $1
      if (sql.includes('gender') && params.find(p => ['male', 'female'].includes(p))) {
        const gender = params.find(p => ['male', 'female'].includes(p));
        query = query.eq('gender', gender);
      }
      
      // key = $1 (for system_settings)
      if (tableName === 'system_settings' && sql.includes('key') && params[0]) {
        query = query.eq('key', params[0]);
      }
      
      // active = true
      if (sql.includes('active = true')) {
        query = query.eq('active', true);
      }
      
      // called_at IS NULL
      if (sql.includes('called_at IS NULL')) {
        query = query.is('called_at', null);
      }
      
      // called_at < NOW() - INTERVAL
      if (sql.includes('called_at <') && sql.includes('INTERVAL')) {
        const minutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        query = query.lt('called_at', minutesAgo);
      }
    }
    
    // ==========================================
    // GROUP BY (تحويل إلى aggregation)
    // ==========================================
    if (sql.includes('GROUP BY')) {
      // هذا يحتاج معالجة خاصة - للآن نرجع البيانات الخام
      // ويتم التجميع في الكود
    }
    
    // ==========================================
    // ORDER BY
    // ==========================================
    if (sql.includes('ORDER BY')) {
      if (sql.includes('number ASC') || sql.includes('number')) {
        query = query.order('number', { ascending: true });
      } else if (sql.includes('created_at ASC')) {
        query = query.order('created_at', { ascending: true });
      } else if (sql.includes('created_at DESC')) {
        query = query.order('created_at', { ascending: false });
      } else if (sql.includes('priority DESC')) {
        query = query.order('priority', { ascending: false });
      }
    }
    
    // ==========================================
    // LIMIT
    // ==========================================
    if (sql.includes('LIMIT')) {
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        query = query.limit(parseInt(limitMatch[1]));
      }
    }
    
    // تنفيذ الـ query
    const { data, error } = await query;
    
    if (error) {
      console.error('[SupabaseDB] Select error:', error);
      return { rows: [] };
    }
    
    return { rows: data || [] };
  }

  /**
   * معالجة INSERT queries
   */
  async _handleInsert(sql, params) {
    const tableMatch = sql.match(/INTO\s+(\w+)/i);
    if (!tableMatch) {
      return { rows: [] };
    }
    
    const tableName = tableMatch[1];
    
    // استخراج الأعمدة والقيم
    const columnsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
    const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
    
    if (!columnsMatch || !valuesMatch) {
      console.warn('[SupabaseDB] Could not parse INSERT query');
      return { rows: [] };
    }
    
    const columns = columnsMatch[1].split(',').map(c => c.trim());
    const valuePlaceholders = valuesMatch[1].split(',').map(v => v.trim());
    
    // بناء الـ object
    const insertData = {};
    columns.forEach((col, index) => {
      const placeholder = valuePlaceholders[index];
      if (placeholder.startsWith('$')) {
        const paramIndex = parseInt(placeholder.substring(1)) - 1;
        insertData[col] = params[paramIndex];
      } else if (placeholder === 'CURRENT_TIMESTAMP' || placeholder === 'NOW()') {
        insertData[col] = new Date().toISOString();
      } else if (placeholder.startsWith("'") && placeholder.endsWith("'")) {
        insertData[col] = placeholder.slice(1, -1);
      } else {
        insertData[col] = placeholder;
      }
    });
    
    const { data, error } = await this.supabase
      .from(tableName)
      .insert([insertData])
      .select();
    
    if (error) {
      console.error('[SupabaseDB] Insert error:', error);
      return { rows: [] };
    }
    
    return { rows: data || [] };
  }

  /**
   * معالجة UPDATE queries
   */
  async _handleUpdate(sql, params) {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch) {
      return { rows: [] };
    }
    
    const tableName = tableMatch[1];
    
    // استخراج SET clause
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    if (!setMatch) {
      console.warn('[SupabaseDB] Could not parse UPDATE SET clause');
      return { rows: [] };
    }
    
    const updateData = {};
    const setPairs = setMatch[1].split(',');
    let paramIndex = 0;
    
    setPairs.forEach(pair => {
      const [col, val] = pair.split('=').map(s => s.trim());
      if (val.startsWith('$')) {
        updateData[col] = params[paramIndex++];
      } else if (val === 'CURRENT_TIMESTAMP' || val === 'NOW()') {
        updateData[col] = new Date().toISOString();
      } else if (val.startsWith("'") && val.endsWith("'")) {
        updateData[col] = val.slice(1, -1);
      } else {
        updateData[col] = val;
      }
    });
    
    // استخراج WHERE clause
    let query = this.supabase.from(tableName).update(updateData);
    
    if (sql.includes('WHERE')) {
      if (sql.includes('id =')) {
        query = query.eq('id', params[params.length - 1]);
      } else if (sql.includes('patient_id =')) {
        query = query.eq('patient_id', params[params.length - 1]);
      } else if (sql.includes('clinic_id =')) {
        query = query.eq('clinic_id', params[params.length - 1]);
      }
    }
    
    const { data, error } = await query.select();
    
    if (error) {
      console.error('[SupabaseDB] Update error:', error);
      return { rows: [] };
    }
    
    return { rows: data || [] };
  }

  /**
   * معالجة DELETE queries
   */
  async _handleDelete(sql, params) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) {
      return { rows: [] };
    }
    
    const tableName = tableMatch[1];
    let query = this.supabase.from(tableName).delete();
    
    if (sql.includes('WHERE')) {
      if (sql.includes('id =') && params[0]) {
        query = query.eq('id', params[0]);
      } else if (sql.includes('patient_id =') && params[0]) {
        query = query.eq('patient_id', params[0]);
      }
    }
    
    const { data, error } = await query.select();
    
    if (error) {
      console.error('[SupabaseDB] Delete error:', error);
      return { rows: [] };
    }
    
    return { rows: data || [] };
  }

  /**
   * الحصول على client للـ transactions
   */
  async getClient() {
    const self = this;
    return {
      query: (sql, params) => self.query(sql, params),
      release: () => {}, // no-op for Supabase
    };
  }
}

export default new SupabaseDB();
