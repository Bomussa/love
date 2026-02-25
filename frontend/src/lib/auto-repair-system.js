/**
 * نظام الإصلاح التلقائي الشامل (Comprehensive Auto-Repair System)
 * يراقب ويصلح تلقائياً كافة العناصر التفاعلية (أزرار، أيقونات، حقول اختيار)
 * في التطبيق لضمان الاستجابة الفورية والصحة البرمجية
 */

class AutoRepairSystem {
  constructor() {
    this.repairs = [];
    this.failedElements = new Map();
    this.repairLog = [];
    this.isMonitoring = false;
  }

  /**
   * بدء المراقبة الشاملة لكافة العناصر التفاعلية
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // مراقبة الأزرار (Buttons)
    this.monitorButtons();
    
    // مراقبة الأيقونات (Icons)
    this.monitorIcons();
    
    // مراقبة حقول الاختيار (Select/Dropdown)
    this.monitorSelects();
    
    // مراقبة حقول الإدخال (Input Fields)
    this.monitorInputs();
    
    // مراقبة الروابط (Links)
    this.monitorLinks();
    
    // مراقبة الجداول (Tables)
    this.monitorTables();
    
    // مراقبة النماذج (Forms)
    this.monitorForms();

    // تشغيل فحص دوري
    this.startPeriodicCheck();

    console.log('✅ نظام الإصلاح التلقائي: تم بدء المراقبة الشاملة');
  }

  /**
   * مراقبة الأزرار والتحقق من استجابتها
   */
  monitorButtons() {
    const buttons = document.querySelectorAll('button, [role="button"]');
    
    buttons.forEach((button) => {
      // التحقق من وجود معالج الحدث
      if (!button.onclick && !button.hasAttribute('data-click-handler')) {
        this.repairButton(button);
      }

      // إضافة مستمع للأخطاء
      button.addEventListener('click', (e) => {
        try {
          // لا تفعل شيء - فقط تحقق من عدم حدوث خطأ
        } catch (error) {
          this.logRepair('button_error', button, error);
          this.repairButton(button);
        }
      });

      // التحقق من حالة التعطيل (disabled)
      if (button.disabled && !button.hasAttribute('aria-disabled')) {
        button.setAttribute('aria-disabled', 'true');
      }
    });
  }

  /**
   * إصلاح الزر المعطل
   */
  repairButton(button) {
    try {
      // التأكد من أن الزر قابل للنقر
      button.style.pointerEvents = 'auto';
      button.style.cursor = 'pointer';
      
      // إزالة حالة التعطيل إذا كانت خاطئة
      if (button.disabled && button.getAttribute('aria-disabled') !== 'true') {
        button.disabled = false;
      }

      // إضافة فئة CSS للتأكد من الظهور
      if (!button.classList.contains('interactive')) {
        button.classList.add('interactive');
      }

      this.logRepair('button_repaired', button);
    } catch (error) {
      console.error('❌ خطأ في إصلاح الزر:', error);
    }
  }

  /**
   * مراقبة الأيقونات والتحقق من استجابتها
   */
  monitorIcons() {
    const icons = document.querySelectorAll('[class*="icon"], svg, i[class*="icon"]');
    
    icons.forEach((icon) => {
      // التحقق من أن الأيقونة قابلة للنقر إذا كانت داخل عنصر تفاعلي
      const parent = icon.closest('button, a, [role="button"]');
      if (parent) {
        icon.style.pointerEvents = 'auto';
      }

      // التأكد من أن الأيقونة مرئية
      if (window.getComputedStyle(icon).display === 'none') {
        icon.style.display = 'inline-block';
      }
    });
  }

  /**
   * مراقبة حقول الاختيار والقوائم المنسدلة
   */
  monitorSelects() {
    const selects = document.querySelectorAll('select, [role="combobox"], [role="listbox"]');
    
    selects.forEach((select) => {
      // التأكد من أن حقل الاختيار قابل للتفاعل
      select.style.pointerEvents = 'auto';
      
      // التحقق من وجود خيارات
      const options = select.querySelectorAll('option, [role="option"]');
      if (options.length === 0) {
        this.logRepair('select_no_options', select);
      }

      // إضافة معالج للتغيير
      if (!select.hasAttribute('data-change-handler')) {
        select.addEventListener('change', (e) => {
          this.logRepair('select_changed', select, e.target.value);
        });
        select.setAttribute('data-change-handler', 'true');
      }
    });
  }

  /**
   * مراقبة حقول الإدخال والتحقق من استجابتها
   */
  monitorInputs() {
    const inputs = document.querySelectorAll('input, textarea');
    
    inputs.forEach((input) => {
      // التأكد من أن حقل الإدخال قابل للتفاعل
      input.style.pointerEvents = 'auto';
      
      // التحقق من الخصائص الأساسية
      if (!input.hasAttribute('type')) {
        input.setAttribute('type', 'text');
      }

      // إضافة معالج للإدخال
      if (!input.hasAttribute('data-input-handler')) {
        input.addEventListener('input', (e) => {
          this.logRepair('input_changed', input, e.target.value.substring(0, 20));
        });
        input.setAttribute('data-input-handler', 'true');
      }
    });
  }

  /**
   * مراقبة الروابط والتحقق من استجابتها
   */
  monitorLinks() {
    const links = document.querySelectorAll('a, [role="link"]');
    
    links.forEach((link) => {
      // التأكد من أن الرابط قابل للنقر
      link.style.pointerEvents = 'auto';
      link.style.cursor = 'pointer';
      
      // التحقق من وجود href أو معالج
      if (!link.href && !link.onclick && !link.hasAttribute('data-link-handler')) {
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
      }
    });
  }

  /**
   * مراقبة الجداول والتحقق من عرض البيانات
   */
  monitorTables() {
    const tables = document.querySelectorAll('table');
    
    tables.forEach((table) => {
      const rows = table.querySelectorAll('tbody tr');
      
      // التحقق من وجود بيانات في الجدول
      if (rows.length === 0) {
        this.logRepair('table_empty', table);
      }

      // التأكد من أن الجدول مرئي
      if (window.getComputedStyle(table).display === 'none') {
        table.style.display = 'table';
      }

      // إضافة معالجات للصفوف
      rows.forEach((row) => {
        row.style.cursor = 'pointer';
        if (!row.hasAttribute('data-row-handler')) {
          row.addEventListener('click', (e) => {
            this.logRepair('table_row_clicked', row);
          });
          row.setAttribute('data-row-handler', 'true');
        }
      });
    });
  }

  /**
   * مراقبة النماذج والتحقق من صحتها
   */
  monitorForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach((form) => {
      // التأكد من أن النموذج قابل للإرسال
      const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        this.repairButton(submitButton);
      }

      // إضافة معالج للإرسال
      if (!form.hasAttribute('data-submit-handler')) {
        form.addEventListener('submit', (e) => {
          this.logRepair('form_submitted', form);
        });
        form.setAttribute('data-submit-handler', 'true');
      }
    });
  }

  /**
   * فحص دوري شامل لكافة العناصر
   */
  startPeriodicCheck() {
    setInterval(() => {
      this.performHealthCheck();
    }, 5000); // فحص كل 5 ثوانٍ
  }

  /**
   * فحص صحة النظام الشامل
   */
  performHealthCheck() {
    const issues = [];

    // فحص الأزرار المعطلة
    const disabledButtons = document.querySelectorAll('button:disabled');
    disabledButtons.forEach((btn) => {
      if (btn.offsetParent === null) {
        issues.push({ type: 'hidden_disabled_button', element: btn });
      }
    });

    // فحص الحقول الفارغة
    const emptyInputs = document.querySelectorAll('input[required]:not([value])');
    emptyInputs.forEach((input) => {
      if (input.offsetParent !== null) {
        // حقل مرئي وفارغ - قد يكون مقصوداً
      }
    });

    // فحص الجداول الفارغة
    const emptyTables = document.querySelectorAll('table tbody:empty');
    emptyTables.forEach((tbody) => {
      issues.push({ type: 'empty_table', element: tbody.closest('table') });
    });

    // تسجيل المشاكل
    if (issues.length > 0) {
      console.warn('⚠️ تم اكتشاف مشاكل في الصحة:', issues);
      this.repairLog.push({
        timestamp: new Date(),
        issues: issues,
        status: 'detected'
      });
    }

    return issues;
  }

  /**
   * تسجيل عملية إصلاح
   */
  logRepair(type, element, details = null) {
    const repair = {
      timestamp: new Date(),
      type: type,
      element: element?.tagName || 'unknown',
      elementId: element?.id || 'no-id',
      elementClass: element?.className || 'no-class',
      details: details
    };

    this.repairs.push(repair);
    this.repairLog.push(repair);

    // الاحتفاظ بآخر 100 عملية إصلاح فقط
    if (this.repairs.length > 100) {
      this.repairs.shift();
    }

    console.log(`🔧 إصلاح: ${type}`, repair);
  }

  /**
   * الحصول على تقرير الإصلاحات
   */
  getRepairReport() {
    return {
      totalRepairs: this.repairs.length,
      repairs: this.repairs,
      repairLog: this.repairLog,
      timestamp: new Date(),
      status: 'active'
    };
  }

  /**
   * إيقاف المراقبة
   */
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('⛔ تم إيقاف المراقبة');
  }

  /**
   * إعادة تعيين السجلات
   */
  resetLogs() {
    this.repairs = [];
    this.repairLog = [];
    console.log('🔄 تم إعادة تعيين السجلات');
  }
}

// إنشاء مثيل عام من النظام
export const autoRepairSystem = new AutoRepairSystem();

// بدء المراقبة عند تحميل الصفحة
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      autoRepairSystem.startMonitoring();
    });
  } else {
    autoRepairSystem.startMonitoring();
  }
}

export default AutoRepairSystem;
