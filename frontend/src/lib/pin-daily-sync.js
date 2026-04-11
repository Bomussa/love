/**
 */

  constructor(supabase) {
    this.supabase = supabase;
    this.lastSyncTime = null;
    this.syncInterval = null;
    this.isSyncing = false;
    this.syncLog = [];
    this.healthStatus = {
      lastSync: null,
      nextSync: null,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      status: 'idle'
    };
  }

  /**
   * بدء نظام التزامن اليومي
   */
  startDailySync() {

    // فحص فوري عند البدء
    this.performDailySync();

    // جدولة التزامن اليومي في منتصف الليل
    this.scheduleDailySync();

    // فحص دوري كل ساعة للتأكد من التزامن
    this.syncInterval = setInterval(() => {
      this.performHourlyCheck();
    }, 3600000); // كل ساعة

    console.log('✅ نظام التزامن اليومي: تم التفعيل');
  }

  /**
   * جدولة التزامن اليومي في منتصف الليل
   */
  scheduleDailySync() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.performDailySync();
      // إعادة جدولة بعد اكتمال التزامن
      this.scheduleDailySync();
    }, timeUntilMidnight);

    console.log(`⏰ التزامن اليومي مجدول في: ${tomorrow.toLocaleString('ar-SA')}`);
  }

  /**
   * تنفيذ التزامن اليومي الشامل
   */
  async performDailySync() {
    if (this.isSyncing) {
      console.warn('⚠️ التزامن جاري بالفعل، سيتم تخطي هذا الطلب');
      return;
    }

    this.isSyncing = true;
    this.healthStatus.status = 'syncing';
    const syncStartTime = new Date();

    try {
      console.log('🔄 بدء التزامن اليومي الشامل...');



      // 3. التحقق من صحة البيانات

      // 4. إعادة تعيين عدادات الاستخدام إذا لزم الأمر
      await this.resetUsageCounters();


      // تسجيل النجاح
      this.healthStatus.lastSync = syncStartTime;
      this.healthStatus.successfulSyncs++;
      this.healthStatus.totalSyncs++;
      this.healthStatus.status = 'idle';

      const syncDuration = new Date() - syncStartTime;
      this.logSync('success', `تم التزامن بنجاح في ${syncDuration}ms`, syncDuration);

      console.log(`✅ التزامن اليومي اكتمل بنجاح (${syncDuration}ms)`);
    } catch (error) {
      this.healthStatus.failedSyncs++;
      this.healthStatus.totalSyncs++;
      this.healthStatus.status = 'error';

      this.logSync('error', `فشل التزامن: ${error.message}`);
      console.error('❌ خطأ في التزامن اليومي:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   */
    try {
      const now = new Date().toISOString();
      const { data, error, count } = await this.supabase
        .delete()
        .lt('expires_at', now);

      if (error) throw error;

      return count;
    } catch (error) {
      throw error;
    }
  }

  /**
   */
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const { data, error, count } = await this.supabase
        .update({
          expires_at: tomorrow.toISOString()
        })
        .eq('is_active', true)
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      return count;
    } catch (error) {
      throw error;
    }
  }

  /**
   */
    try {
        .select('*');

      if (error) throw error;

      let validationIssues = 0;

          validationIssues++;
          continue;
        }

        // التحقق من أن clinic_code موجود
          validationIssues++;
          continue;
        }

        // التحقق من أن is_active موجود
          await this.supabase
            .update({ is_active: true })
        }

        // التحقق من أن expires_at في المستقبل
          await this.supabase
            .update({
              expires_at: new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
            })
        }
      }

    } catch (error) {
      console.error('❌ خطأ في التحقق من صحة البيانات:', error);
      throw error;
    }
  }

  /**
   * إعادة تعيين عدادات الاستخدام
   */
  async resetUsageCounters() {
    try {
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      let resetCount = 0;

        // إعادة تعيين عداد الاستخدام إذا تجاوز الحد الأقصى
          await this.supabase
            .update({ used_count: 0 })
          resetCount++;
        }
      }

      console.log(`🔄 تم إعادة تعيين ${resetCount} عداد استخدام`);
      return resetCount;
    } catch (error) {
      console.error('❌ خطأ في إعادة تعيين عدادات الاستخدام:', error);
      throw error;
    }
  }

  /**
   */
    try {
      // الحصول على قائمة العيادات
      const { data: clinics, error: clinicsError } = await this.supabase
        .from('clinics')
        .select('id')
        .eq('is_active', true);

      if (clinicsError) throw clinicsError;

        .select('clinic_code')
        .eq('is_active', true);



        return 0;
      }

        clinic_code: clinic.id,
        is_active: true,
        generated_at: new Date().toISOString(),
        expires_at: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
        created_at: new Date().toISOString(),
        max_uses: 100,
        used_count: 0
      }));

      const { error: insertError } = await this.supabase

      if (insertError) throw insertError;

    } catch (error) {
      throw error;
    }
  }

  /**
   * فحص دوري كل ساعة
   */
  async performHourlyCheck() {
    try {
        .select('count(*)')
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

        // تشغيل تزامن فوري
        await this.performDailySync();
      }
    } catch (error) {
      console.error('❌ خطأ في الفحص الدوري:', error);
    }
  }

  /**
   */
    return Math.floor(10 + Math.random() * 90).toString();
  }

  /**
   * تسجيل عملية التزامن
   */
  logSync(status, message, duration = 0) {
    const syncLog = {
      timestamp: new Date(),
      status: status,
      message: message,
      duration: duration
    };

    this.syncLog.push(syncLog);

    // الاحتفاظ بآخر 100 سجل فقط
    if (this.syncLog.length > 100) {
      this.syncLog.shift();
    }
  }

  /**
   * الحصول على حالة الصحة
   */
  getHealthStatus() {
    return {
      ...this.healthStatus,
      nextSync: this.calculateNextSyncTime(),
      isSyncing: this.isSyncing,
      recentLogs: this.syncLog.slice(-10)
    };
  }

  /**
   * حساب وقت التزامن التالي
   */
  calculateNextSyncTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * إيقاف نظام التزامن
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    console.log('⛔ تم إيقاف نظام التزامن اليومي');
  }
}

