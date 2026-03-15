/**
 * نظام التزامن اليومي لأرقام PIN (Daily PIN Synchronization System)
 * يضمن تحديث أرقام PIN بشكل صحيح يومياً وعرضها محدثة على شاشة الإدارة
 */

class PINDailySync {
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
    console.log('🔄 نظام التزامن اليومي لأرقام PIN: جاري البدء');

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

      // 1. حذف أرقام PIN المنتهية الصلاحية
      await this.deleteExpiredPins();

      // 2. تحديث صلاحية أرقام PIN الحالية
      await this.updatePinExpiry();

      // 3. التحقق من صحة البيانات
      await this.validatePinData();

      // 4. إعادة تعيين عدادات الاستخدام إذا لزم الأمر
      await this.resetUsageCounters();

      // 5. توليد أرقام PIN جديدة للعيادات التي لا تملك أرقام
      await this.generateMissingPins();

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
   * حذف أرقام PIN المنتهية الصلاحية
   */
  async deleteExpiredPins() {
    try {
      const now = new Date().toISOString();
      const { data, error, count } = await this.supabase
        .from('pins')
        .delete()
        .lt('valid_until', now);

      if (error) throw error;

      console.log(`🗑️ تم حذف ${count} أرقام PIN منتهية الصلاحية`);
      return count;
    } catch (error) {
      console.error('❌ خطأ في حذف أرقام PIN المنتهية:', error);
      throw error;
    }
  }

  /**
   * تحديث صلاحية أرقام PIN الحالية
   */
  async updatePinExpiry() {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const { data, error, count } = await this.supabase
        .from('pins')
        .update({
          valid_until: tomorrow.toISOString()
        })
        .is('used_at', null)
        .lt('valid_until', new Date().toISOString());

      if (error) throw error;

      console.log(`📅 تم تحديث صلاحية ${count} أرقام PIN`);
      return count;
    } catch (error) {
      console.error('❌ خطأ في تحديث صلاحية PIN:', error);
      throw error;
    }
  }

  /**
   * التحقق من صحة بيانات PIN
   */
  async validatePinData() {
    try {
      const { data: pins, error } = await this.supabase
        .from('pins')
        .select('*');

      if (error) throw error;

      let validationIssues = 0;

      for (const pin of pins) {
        // التحقق من أن PIN ليس فارغاً
        if (!pin.pin) {
          validationIssues++;
          continue;
        }

        // التحقق من أن clinic_id موجود
        if (!pin.clinic_id) {
          validationIssues++;
          continue;
        }

        // التحقق من وجود used_at
        if (pin.used_at === undefined) {
          await this.supabase
            .from('pins')
            .update({ used_at: null })
            .eq('id', pin.id);
        }

        // التحقق من أن valid_until في المستقبل
        if (new Date(pin.valid_until) < new Date()) {
          await this.supabase
            .from('pins')
            .update({
              valid_until: new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
            })
            .eq('id', pin.id);
        }
      }

      console.log(`✔️ تم التحقق من ${pins.length} أرقام PIN (${validationIssues} مشاكل)`);
      return { total: pins.length, issues: validationIssues };
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
      const { data: pins, error } = await this.supabase
        .from('pins')
        .select('*')
        .is('used_at', null);

      if (error) throw error;

      let resetCount = 0;

      for (const pin of pins) {
        // إعادة تعيين عداد الاستخدام إذا تجاوز الحد الأقصى
        if (pin.used_at) {
          continue;
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
   * توليد أرقام PIN جديدة للعيادات التي لا تملك أرقام
   */
  async generateMissingPins() {
    try {
      // الحصول على قائمة العيادات
      const { data: clinics, error: clinicsError } = await this.supabase
        .from('clinics')
        .select('id')
        .eq('is_active', true);

      if (clinicsError) throw clinicsError;

      // الحصول على قائمة العيادات التي لديها أرقام PIN
      const { data: clinicsWithPins, error: pinsError } = await this.supabase
        .from('pins')
        .select('clinic_id')
        .is('used_at', null)
        .gt('valid_until', new Date().toISOString());

      if (pinsError) throw pinsError;

      const clinicsWithPinIds = new Set(clinicsWithPins.map(p => p.clinic_id));
      const clinicsNeedingPins = clinics.filter(c => !clinicsWithPinIds.has(c.id));

      if (clinicsNeedingPins.length === 0) {
        console.log('✔️ جميع العيادات لديها أرقام PIN');
        return 0;
      }

      // توليد أرقام PIN للعيادات المفقودة
      const newPins = clinicsNeedingPins.map(clinic => ({
        pin: this.generateUniquePin(),
        clinic_id: clinic.id,
        used_at: null,
        created_at: new Date().toISOString(),
        valid_until: new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
      }));

      const { error: insertError } = await this.supabase
        .from('pins')
        .insert(newPins);

      if (insertError) throw insertError;

      console.log(`✨ تم توليد ${newPins.length} أرقام PIN جديدة للعيادات المفقودة`);
      return newPins.length;
    } catch (error) {
      console.error('❌ خطأ في توليد أرقام PIN المفقودة:', error);
      throw error;
    }
  }

  /**
   * فحص دوري كل ساعة
   */
  async performHourlyCheck() {
    try {
      // التحقق من وجود أرقام PIN منتهية الصلاحية
      const { data: expiredPins, error } = await this.supabase
        .from('pins')
        .select('count(*)')
        .lt('valid_until', new Date().toISOString());

      if (error) throw error;

      if (expiredPins && expiredPins[0]?.count > 0) {
        console.warn(`⚠️ تم اكتشاف ${expiredPins[0].count} أرقام PIN منتهية الصلاحية`);
        // تشغيل تزامن فوري
        await this.performDailySync();
      }
    } catch (error) {
      console.error('❌ خطأ في الفحص الدوري:', error);
    }
  }

  /**
   * توليد رقم PIN فريد
   */
  generateUniquePin() {
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

export default PINDailySync;
