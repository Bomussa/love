/**
 * نظام مراقبة الدوال والجداول (Function & Table Monitoring System)
 * يراقب حالة الدوال (RPC Functions) والجداول (Database Tables)
 * ويسجل الأخطاء والتحذيرات والنجاحات
 */

class FunctionTableMonitor {
  constructor() {
    this.functionStatus = new Map();
    this.tableStatus = new Map();
    this.functionLogs = [];
    this.tableLogs = [];
    this.errors = [];
    this.warnings = [];
    this.isMonitoring = false;
    this.healthScore = 100;
  }

  /**
   * بدء المراقبة الشاملة للدوال والجداول
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // بدء فحص دوري
    this.startPeriodicHealthCheck();
    
    console.log('✅ نظام مراقبة الدوال والجداول: تم البدء');
  }

  /**
   * تسجيل استدعاء دالة وحالتها
   */
  logFunctionCall(functionName, params = {}, result = null, error = null, duration = 0) {
    const status = error ? 'error' : 'success';
    const timestamp = new Date();

    const functionLog = {
      name: functionName,
      status: status,
      params: this.sanitizeParams(params),
      result: this.sanitizeResult(result),
      error: error ? error.message : null,
      errorCode: error ? error.code : null,
      duration: duration,
      timestamp: timestamp
    };

    this.functionLogs.push(functionLog);

    // تحديث حالة الدالة
    if (!this.functionStatus.has(functionName)) {
      this.functionStatus.set(functionName, {
        name: functionName,
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        lastCalled: null,
        lastError: null,
        avgDuration: 0,
        status: 'unknown'
      });
    }

    const funcStatus = this.functionStatus.get(functionName);
    funcStatus.totalCalls++;
    funcStatus.lastCalled = timestamp;

    if (error) {
      funcStatus.errorCount++;
      funcStatus.lastError = error.message;
      funcStatus.status = 'error';
      this.errors.push({
        type: 'function_error',
        functionName: functionName,
        error: error.message,
        timestamp: timestamp
      });
    } else {
      funcStatus.successCount++;
      funcStatus.status = 'healthy';
    }

    // حساب متوسط المدة
    funcStatus.avgDuration = (funcStatus.avgDuration * (funcStatus.totalCalls - 1) + duration) / funcStatus.totalCalls;

    // الاحتفاظ بآخر 1000 سجل فقط
    if (this.functionLogs.length > 1000) {
      this.functionLogs.shift();
    }

    console.log(`🔧 دالة: ${functionName} - ${status.toUpperCase()}`, functionLog);
    
    return functionLog;
  }

  /**
   * تسجيل عملية جدول وحالتها
   */
  logTableOperation(tableName, operation = 'select', rowCount = 0, error = null, duration = 0) {
    const status = error ? 'error' : 'success';
    const timestamp = new Date();

    const tableLog = {
      table: tableName,
      operation: operation, // select, insert, update, delete
      rowCount: rowCount,
      status: status,
      error: error ? error.message : null,
      duration: duration,
      timestamp: timestamp
    };

    this.tableLogs.push(tableLog);

    // تحديث حالة الجدول
    if (!this.tableStatus.has(tableName)) {
      this.tableStatus.set(tableName, {
        name: tableName,
        totalOperations: 0,
        selectCount: 0,
        insertCount: 0,
        updateCount: 0,
        deleteCount: 0,
        totalRows: 0,
        lastOperation: null,
        lastError: null,
        status: 'unknown'
      });
    }

    const tblStatus = this.tableStatus.get(tableName);
    tblStatus.totalOperations++;
    tblStatus.lastOperation = timestamp;

    // تحديث عدد العمليات حسب النوع
    switch (operation) {
      case 'select':
        tblStatus.selectCount++;
        break;
      case 'insert':
        tblStatus.insertCount++;
        break;
      case 'update':
        tblStatus.updateCount++;
        break;
      case 'delete':
        tblStatus.deleteCount++;
        break;
    }

    tblStatus.totalRows += rowCount;

    if (error) {
      tblStatus.lastError = error.message;
      tblStatus.status = 'error';
      this.errors.push({
        type: 'table_error',
        tableName: tableName,
        operation: operation,
        error: error.message,
        timestamp: timestamp
      });
    } else {
      tblStatus.status = 'healthy';
    }

    // الاحتفاظ بآخر 1000 سجل فقط
    if (this.tableLogs.length > 1000) {
      this.tableLogs.shift();
    }

    console.log(`📊 جدول: ${tableName} (${operation}) - ${status.toUpperCase()}`, tableLog);
    
    return tableLog;
  }

  /**
   * مراقبة استدعاء RPC Function
   */
  async monitorRPCCall(supabase, functionName, params = {}) {
    const startTime = performance.now();
    
    try {
      const { data, error } = await supabase.rpc(functionName, params);
      
      const duration = performance.now() - startTime;
      
      if (error) {
        this.logFunctionCall(functionName, params, null, error, duration);
        throw error;
      }

      this.logFunctionCall(functionName, params, data, null, duration);
      return { data, error: null };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logFunctionCall(functionName, params, null, error, duration);
      return { data: null, error };
    }
  }

  /**
   * مراقبة استعلام جدول
   */
  async monitorTableQuery(supabase, tableName, query) {
    const startTime = performance.now();
    
    try {
      const { data, error, count } = await query;
      
      const duration = performance.now() - startTime;
      const rowCount = Array.isArray(data) ? data.length : (count || 0);
      
      if (error) {
        this.logTableOperation(tableName, 'select', 0, error, duration);
        throw error;
      }

      this.logTableOperation(tableName, 'select', rowCount, null, duration);
      return { data, error: null, count: rowCount };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logTableOperation(tableName, 'select', 0, error, duration);
      return { data: null, error, count: 0 };
    }
  }

  /**
   * مراقبة عملية إدراج
   */
  async monitorInsert(supabase, tableName, data) {
    const startTime = performance.now();
    
    try {
      const { data: insertedData, error } = await supabase
        .from(tableName)
        .insert(data);
      
      const duration = performance.now() - startTime;
      const rowCount = Array.isArray(insertedData) ? insertedData.length : 1;
      
      if (error) {
        this.logTableOperation(tableName, 'insert', 0, error, duration);
        throw error;
      }

      this.logTableOperation(tableName, 'insert', rowCount, null, duration);
      return { data: insertedData, error: null };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logTableOperation(tableName, 'insert', 0, error, duration);
      return { data: null, error };
    }
  }

  /**
   * مراقبة عملية تحديث
   */
  async monitorUpdate(supabase, tableName, data, filter) {
    const startTime = performance.now();
    
    try {
      let query = supabase.from(tableName).update(data);
      
      // تطبيق الفلاتر
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: updatedData, error } = await query;
      
      const duration = performance.now() - startTime;
      const rowCount = Array.isArray(updatedData) ? updatedData.length : 1;
      
      if (error) {
        this.logTableOperation(tableName, 'update', 0, error, duration);
        throw error;
      }

      this.logTableOperation(tableName, 'update', rowCount, null, duration);
      return { data: updatedData, error: null };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logTableOperation(tableName, 'update', 0, error, duration);
      return { data: null, error };
    }
  }

  /**
   * مراقبة عملية حذف
   */
  async monitorDelete(supabase, tableName, filter) {
    const startTime = performance.now();
    
    try {
      let query = supabase.from(tableName).delete();
      
      // تطبيق الفلاتر
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: deletedData, error } = await query;
      
      const duration = performance.now() - startTime;
      const rowCount = Array.isArray(deletedData) ? deletedData.length : 1;
      
      if (error) {
        this.logTableOperation(tableName, 'delete', 0, error, duration);
        throw error;
      }

      this.logTableOperation(tableName, 'delete', rowCount, null, duration);
      return { data: deletedData, error: null };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logTableOperation(tableName, 'delete', 0, error, duration);
      return { data: null, error };
    }
  }

  /**
   * فحص صحة النظام الدوري
   */
  startPeriodicHealthCheck() {
    setInterval(() => {
      this.performHealthCheck();
    }, 10000); // فحص كل 10 ثوانٍ
  }

  /**
   * فحص صحة النظام الشامل
   */
  performHealthCheck() {
    let healthScore = 100;
    const issues = [];

    // فحص الدوال
    this.functionStatus.forEach((status, functionName) => {
      const errorRate = status.totalCalls > 0 
        ? (status.errorCount / status.totalCalls) * 100 
        : 0;

      if (errorRate > 50) {
        issues.push({
          type: 'function_high_error_rate',
          name: functionName,
          errorRate: errorRate.toFixed(2) + '%'
        });
        healthScore -= 20;
      } else if (errorRate > 10) {
        this.warnings.push({
          type: 'function_warning',
          name: functionName,
          errorRate: errorRate.toFixed(2) + '%'
        });
        healthScore -= 5;
      }

      // فحص المدة
      if (status.avgDuration > 5000) { // أكثر من 5 ثوانٍ
        this.warnings.push({
          type: 'function_slow',
          name: functionName,
          avgDuration: status.avgDuration.toFixed(2) + 'ms'
        });
        healthScore -= 3;
      }
    });

    // فحص الجداول
    this.tableStatus.forEach((status, tableName) => {
      const errorRate = status.totalOperations > 0 
        ? (status.errorCount || 0) / status.totalOperations * 100 
        : 0;

      if (errorRate > 50) {
        issues.push({
          type: 'table_high_error_rate',
          name: tableName,
          errorRate: errorRate.toFixed(2) + '%'
        });
        healthScore -= 20;
      } else if (errorRate > 10) {
        this.warnings.push({
          type: 'table_warning',
          name: tableName,
          errorRate: errorRate.toFixed(2) + '%'
        });
        healthScore -= 5;
      }
    });

    // تحديث درجة الصحة
    this.healthScore = Math.max(0, healthScore);

    if (issues.length > 0) {
      console.warn('⚠️ مشاكل صحية مكتشفة:', issues);
    }

    return {
      healthScore: this.healthScore,
      issues: issues,
      warnings: this.warnings,
      timestamp: new Date()
    };
  }

  /**
   * الحصول على تقرير الصحة الشامل
   */
  getHealthReport() {
    const functionStats = Array.from(this.functionStatus.values()).map(status => ({
      name: status.name,
      totalCalls: status.totalCalls,
      successCount: status.successCount,
      errorCount: status.errorCount,
      successRate: status.totalCalls > 0 
        ? ((status.successCount / status.totalCalls) * 100).toFixed(2) + '%'
        : 'N/A',
      avgDuration: status.avgDuration.toFixed(2) + 'ms',
      status: status.status,
      lastCalled: status.lastCalled,
      lastError: status.lastError
    }));

    const tableStats = Array.from(this.tableStatus.values()).map(status => ({
      name: status.name,
      totalOperations: status.totalOperations,
      selectCount: status.selectCount,
      insertCount: status.insertCount,
      updateCount: status.updateCount,
      deleteCount: status.deleteCount,
      totalRows: status.totalRows,
      status: status.status,
      lastOperation: status.lastOperation,
      lastError: status.lastError
    }));

    return {
      timestamp: new Date(),
      healthScore: this.healthScore,
      functionStats: functionStats,
      tableStats: tableStats,
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      recentErrors: this.errors.slice(-10),
      recentWarnings: this.warnings.slice(-10)
    };
  }

  /**
   * تنظيف البيانات الحساسة من السجلات
   */
  sanitizeParams(params) {
    if (!params) return {};
    const sanitized = { ...params };
    
    // إزالة كلمات المرور والمفاتيح الحساسة
    const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'key', 'auth'];
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  /**
   * تنظيف البيانات الحساسة من النتائج
   */
  sanitizeResult(result) {
    if (!result) return null;
    
    // تقليل حجم النتيجة إذا كانت كبيرة جداً
    if (typeof result === 'object' && Object.keys(result).length > 100) {
      return { ...result, _truncated: true, _itemCount: Object.keys(result).length };
    }

    return result;
  }

  /**
   * إعادة تعيين السجلات
   */
  resetLogs() {
    this.functionLogs = [];
    this.tableLogs = [];
    this.errors = [];
    this.warnings = [];
    this.healthScore = 100;
    console.log('🔄 تم إعادة تعيين السجلات');
  }

  /**
   * إيقاف المراقبة
   */
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('⛔ تم إيقاف مراقبة الدوال والجداول');
  }
}

// إنشاء مثيل عام من النظام
export const functionTableMonitor = new FunctionTableMonitor();

export default FunctionTableMonitor;
