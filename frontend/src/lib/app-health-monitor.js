/**
 * AppHealthMonitor - نظام مراقبة صحة التطبيق الشامل
 * يرصد كل خطأ أو توقف، يُنبّه بصوت ونص، ويُصلح ويُعيد التشغيل فوراً
 */

class AppHealthMonitor {
  constructor() {
    this.issues = [];
    this.isMonitoring = false;
    this.supabaseClient = null;
    this.pollingWatchdogs = new Map();
    this.recoveryAttempts = new Map();
    this.MAX_RECOVERY_ATTEMPTS = 3;
    this.alertCallbacks = [];
    this.audioContext = null;
    this.lastSupabaseCheck = Date.now();
    this.isSilenced = false;
    this.silenceUntil = 0;
    this._lastHeartbeat = Date.now();
    this._supabaseCheckInterval = null;
    this._pollingWatchdogInterval = null;
    this._heartbeatInterval = null;
    // منع تكرار نفس النوع في وقت قصير
    this._recentAlertTypes = new Map();
  }

  // تهيئة النظام
  init(supabaseClient) {
    if (this.isMonitoring) return;
    this.supabaseClient = supabaseClient;
    this.isMonitoring = true;
    this._setupGlobalErrorHandlers();
    this._setupUnhandledRejectionHandler();
    this._setupSupabaseMonitor();
    this._setupPollingWatchdog();
    this._setupNetworkMonitor();
    this._setupConsoleErrorInterceptor();
    this._startHeartbeat();
    // تسجيل في window للوصول العالمي
    window.__healthMonitor = this;
    console.log('[HealthMonitor] ✅ نظام المراقبة الذاتية يعمل');
  }

  // تسجيل callback للتنبيهات
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  // إصدار تنبيه
  _alert(issue) {
    // منع التكرار - نفس النوع لا يُكرر خلال 15 ثانية
    const now = Date.now();
    const lastTime = this._recentAlertTypes.get(issue.type) || 0;
    if (now - lastTime < 15000) return null;
    this._recentAlertTypes.set(issue.type, now);

    const issueWithTime = {
      ...issue,
      id: now + Math.random(),
      timestamp: new Date().toISOString(),
      resolved: false
    };
    this.issues.unshift(issueWithTime);
    if (this.issues.length > 50) this.issues = this.issues.slice(0, 50);

    // تشغيل الصوت
    if (!this.isSilenced || Date.now() > this.silenceUntil) {
      this._playAlertSound(issue.severity);
    }

    // إرسال للـ callbacks
    this.alertCallbacks.forEach(cb => {
      try { cb(issueWithTime); } catch (e) {}
    });

    // محاولة الإصلاح التلقائي
    if (issue.autoFix) {
      setTimeout(() => this._attemptAutoFix(issueWithTime), 500);
    }

    return issueWithTime;
  }

  // تشغيل صوت التنبيه باستخدام Web Audio API
  _playAlertSound(severity = 'warning') {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';

      if (severity === 'critical') {
        // صوت حاد متكرر للأخطاء الحرجة
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.12);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
        gainNode.gain.setValueAtTime(0.35, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.45);
      } else if (severity === 'error') {
        // صوت منخفض للأخطاء العادية
        oscillator.frequency.setValueAtTime(440, ctx.currentTime);
        oscillator.frequency.setValueAtTime(330, ctx.currentTime + 0.18);
        gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.35);
      } else if (severity === 'warning') {
        // صوت خفيف للتحذيرات
        oscillator.frequency.setValueAtTime(660, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.25);
      } else {
        // صوت إيجابي للمعلومات (إصلاح ناجح)
        oscillator.frequency.setValueAtTime(523, ctx.currentTime);
        oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      // AudioContext غير متاح - تجاهل
    }
  }

  // معالج الأخطاء العامة
  _setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      const msg = event.message || '';
      // تجاهل أخطاء الشبكة البسيطة وResizeObserver
      if (
        msg.includes('ResizeObserver') ||
        msg.includes('Script error') ||
        msg.includes('Non-Error') ||
        event.filename?.includes('extension')
      ) return;

      this._alert({
        type: 'js_error',
        severity: 'error',
        title: 'خطأ في التطبيق',
        message: msg.substring(0, 200),
        source: event.filename ? event.filename.split('/').pop() : 'unknown',
        autoFix: true,
        fixAction: 'reload_component'
      });
    }, true);
  }

  // معالج Promise المرفوضة
  _setupUnhandledRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason) || 'Unknown rejection';

      // تجاهل الإلغاءات المتعمدة
      if (
        msg.includes('AbortError') ||
        msg.includes('cancelled') ||
        msg.includes('The user aborted')
      ) return;

      const isSupabaseError =
        msg.includes('supabase') ||
        msg.includes('PostgreSQL') ||
        msg.includes('JWT') ||
        msg.includes('PGRST');

      const isNetworkError =
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('net::ERR');

      this._alert({
        type: isSupabaseError ? 'supabase_rejection' : isNetworkError ? 'network_error' : 'promise_rejection',
        severity: isSupabaseError ? 'critical' : 'error',
        title: isSupabaseError
          ? 'خطأ في قاعدة البيانات'
          : isNetworkError
          ? 'خطأ في الاتصال'
          : 'خطأ غير معالج',
        message: msg.substring(0, 200),
        autoFix: true,
        fixAction: isSupabaseError ? 'reconnect_supabase' : 'trigger_refresh'
      });

      event.preventDefault();
    });
  }

  // مراقبة Supabase كل 30 ثانية
  _setupSupabaseMonitor() {
    if (!this.supabaseClient) return;

    this._supabaseCheckInterval = setInterval(async () => {
      try {
        const start = Date.now();
        const { error } = await this.supabaseClient
          .from('settings')
          .select('key')
          .limit(1);

        const latency = Date.now() - start;
        this.lastSupabaseCheck = Date.now();

        if (error && !error.message?.includes('No rows') && !error.message?.includes('JSON')) {
          this._alert({
            type: 'supabase_query_error',
            severity: 'critical',
            title: 'مشكلة في قاعدة البيانات',
            message: error.message?.substring(0, 150),
            autoFix: true,
            fixAction: 'reconnect_supabase'
          });
        } else if (latency > 8000) {
          this._alert({
            type: 'supabase_slow',
            severity: 'warning',
            title: 'بطء في قاعدة البيانات',
            message: `زمن الاستجابة: ${latency}ms`,
            autoFix: false
          });
        }
      } catch (e) {
        this._alert({
          type: 'supabase_offline',
          severity: 'critical',
          title: 'انقطع الاتصال بقاعدة البيانات',
          message: 'جاري إعادة الاتصال...',
          autoFix: true,
          fixAction: 'reconnect_supabase'
        });
      }
    }, 30000);
  }

  // مراقبة توقف الـ polling
  _setupPollingWatchdog() {
    this._pollingWatchdogInterval = setInterval(() => {
      const now = Date.now();
      this.pollingWatchdogs.forEach((lastActivity, key) => {
        const elapsed = now - lastActivity;
        if (elapsed > 120000) { // 2 دقيقة بدون نشاط
          this._alert({
            type: `polling_stopped_${key}`,
            severity: 'error',
            title: 'توقف التحديث التلقائي',
            message: `${key} لم يتحدث منذ ${Math.round(elapsed / 1000)} ثانية`,
            autoFix: true,
            fixAction: 'trigger_refresh',
            context: { key }
          });
        }
      });
    }, 60000);
  }

  // تسجيل نشاط polling
  recordPollingActivity(key) {
    this.pollingWatchdogs.set(key, Date.now());
  }

  // مراقبة الشبكة
  _setupNetworkMonitor() {
    window.addEventListener('offline', () => {
      this._alert({
        type: 'network_offline',
        severity: 'critical',
        title: 'انقطع الاتصال بالإنترنت',
        message: 'التطبيق يعمل في وضع أوفلاين',
        autoFix: true,
        fixAction: 'wait_for_network'
      });
    });

    window.addEventListener('online', () => {
      this._alert({
        type: 'network_restored',
        severity: 'info',
        title: 'عاد الاتصال بالإنترنت ✓',
        message: 'جاري مزامنة البيانات...',
        autoFix: true,
        fixAction: 'sync_data'
      });
    });
  }

  // اعتراض console.error للأخطاء المهمة
  _setupConsoleErrorInterceptor() {
    const originalError = console.error.bind(console);
    const self = this;
    console.error = (...args) => {
      originalError(...args);
      const msg = args
        .map(a => (typeof a === 'string' ? a : a?.message || JSON.stringify(a)))
        .join(' ');

      // فقط الأخطاء المهمة المتعلقة بالبنية التحتية
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        (msg.includes('supabase') && msg.includes('error')) ||
        msg.includes('401') ||
        msg.includes('500') ||
        msg.includes('503')
      ) {
        self._alert({
          type: 'infrastructure_error',
          severity: 'warning',
          title: 'خطأ في الاتصال',
          message: msg.substring(0, 150),
          autoFix: true,
          fixAction: 'reconnect_supabase'
        });
      }
    };
  }

  // نبضة القلب - فحص كل 10 ثوانٍ
  _startHeartbeat() {
    this._heartbeatInterval = setInterval(() => {
      const now = Date.now();
      // إذا مرت أكثر من 30 ثانية بين نبضتين = الصفحة كانت مجمدة
      if (this._lastHeartbeat && now - this._lastHeartbeat > 35000) {
        this._alert({
          type: 'page_recovered_from_freeze',
          severity: 'info',
          title: 'تم استعادة التطبيق ✓',
          message: 'كانت الصفحة مجمدة، جاري تحديث البيانات...',
          autoFix: true,
          fixAction: 'trigger_refresh'
        });
      }
      this._lastHeartbeat = now;
    }, 10000);
  }

  // محاولة الإصلاح التلقائي
  async _attemptAutoFix(issue) {
    const key = issue.type;
    const attempts = this.recoveryAttempts.get(key) || 0;

    if (attempts >= this.MAX_RECOVERY_ATTEMPTS) {
      // بعد 3 محاولات فاشلة - إعادة تحميل الصفحة
      this._alert({
        type: 'force_reload_needed',
        severity: 'critical',
        title: 'إعادة تشغيل التطبيق',
        message: 'فشلت محاولات الإصلاح، جاري إعادة التشغيل...',
        autoFix: false
      });
      setTimeout(() => window.location.reload(), 3000);
      return;
    }

    this.recoveryAttempts.set(key, attempts + 1);

    try {
      switch (issue.fixAction) {
        case 'reconnect_supabase':
          // إعادة تهيئة اتصال Supabase
          if (this.supabaseClient) {
            try {
              await this.supabaseClient.removeAllChannels();
            } catch (e) {}
          }
          window.dispatchEvent(new CustomEvent('supabase_reconnect'));
          window.dispatchEvent(new CustomEvent('force_data_refresh'));
          break;

        case 'trigger_refresh':
          window.dispatchEvent(new CustomEvent('force_data_refresh'));
          break;

        case 'sync_data':
          // انتظر ثانية ثم أعد التحديث
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('force_data_refresh'));
          }, 1000);
          break;

        case 'force_reload':
          window.location.reload();
          break;

        case 'reload_component':
          window.dispatchEvent(new CustomEvent('component_reload'));
          break;

        case 'wait_for_network':
          // لا شيء - ننتظر حدث 'online'
          break;
      }

      // تعليم المشكلة كمحلولة بعد 5 ثوانٍ
      setTimeout(() => {
        issue.resolved = true;
        this.recoveryAttempts.delete(key);
        // إشعار بالإصلاح
        this.alertCallbacks.forEach(cb => {
          try { cb({ ...issue, resolved: true }); } catch (e) {}
        });
      }, 5000);
    } catch (e) {
      // فشل الإصلاح
    }
  }

  // كتم الصوت مؤقتاً
  silenceFor(minutes = 10) {
    this.isSilenced = true;
    this.silenceUntil = Date.now() + minutes * 60 * 1000;
    setTimeout(() => {
      this.isSilenced = false;
    }, minutes * 60 * 1000);
  }

  // ملخص الصحة
  getHealthSummary() {
    const recent = this.issues.filter(
      i => Date.now() - new Date(i.timestamp).getTime() < 3600000
    );
    return {
      totalIssues: recent.length,
      unresolved: recent.filter(i => !i.resolved).length,
      critical: recent.filter(i => i.severity === 'critical').length,
      isHealthy: recent.filter(i => !i.resolved && i.severity !== 'info').length === 0
    };
  }

  // إيقاف المراقبة
  stop() {
    this.isMonitoring = false;
    if (this._supabaseCheckInterval) clearInterval(this._supabaseCheckInterval);
    if (this._pollingWatchdogInterval) clearInterval(this._pollingWatchdogInterval);
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
  }
}

// Singleton - نسخة واحدة فقط في التطبيق
const healthMonitor = new AppHealthMonitor();
export default healthMonitor;
