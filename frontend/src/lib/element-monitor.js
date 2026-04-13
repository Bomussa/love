/**
 * نظام مراقبة العناصر التفاعلية المتقدم (Advanced Element Monitoring System)
 * يراقب كل عنصر تفاعلي على حدة مع تتبع تفصيلي لحالته وأدائه
 */

class ElementMonitor {
  constructor() {
    this.elements = new Map(); // خريطة العناصر المراقبة
    this.elementLogs = [];
    this.elementErrors = [];
    this.elementStats = new Map();
    this.isMonitoring = false;
    this.mutationObserver = null;
  }

  /**
   * بدء المراقبة الشاملة لكل العناصر التفاعلية
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // مراقبة التغييرات في DOM
    this.setupMutationObserver();
    
    // مراقبة العناصر الموجودة حالياً
    this.monitorAllElements();

    // فحص دوري
    this.startPeriodicCheck();

    console.log('✅ نظام مراقبة العناصر: تم البدء');
  }

  /**
   * إعداد مراقب التغييرات في DOM
   */
  setupMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // عناصر جديدة تمت إضافتها
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // عنصر DOM
              this.registerElement(node);
              // مراقبة العناصر الفرعية
              const children = node.querySelectorAll('[role], button, a, input, select, textarea, [class*="btn"], [class*="icon"]');
              children.forEach(child => this.registerElement(child));
            }
          });
        }
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * مراقبة جميع العناصر التفاعلية الموجودة
   */
  monitorAllElements() {
    const interactiveSelectors = [
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="option"]',
      '[class*="btn"]',
      '[class*="button"]',
      '[class*="icon"]',
      '[class*="clickable"]',
      'form'
    ];

    const elements = document.querySelectorAll(interactiveSelectors.join(','));
    elements.forEach(element => this.registerElement(element));

    console.log(`📊 تم تسجيل ${elements.length} عنصر تفاعلي`);
  }

  /**
   * تسجيل عنصر للمراقبة
   */
  registerElement(element) {
    if (!element || !element.offsetParent) return; // تجاهل العناصر المخفية

    // إنشاء معرف فريد للعنصر
    const elementId = this.generateElementId(element);
    
    if (this.elements.has(elementId)) {
      return; // العنصر مسجل بالفعل
    }

    // إنشاء سجل للعنصر
    const elementRecord = {
      id: elementId,
      element: element,
      tag: element.tagName.toLowerCase(),
      type: element.type || element.getAttribute('role') || 'unknown',
      text: this.getElementText(element),
      classes: element.className,
      attributes: this.getElementAttributes(element),
      state: {
        visible: element.offsetParent !== null,
        enabled: !element.disabled,
        focused: document.activeElement === element,
        hovered: false
      },
      events: {
        clicks: 0,
        changes: 0,
        inputs: 0,
        focuses: 0,
        blurs: 0,
        hovers: 0,
        errors: 0
      },
      lastInteraction: null,
      errors: [],
      performance: {
        clickDuration: 0,
        avgClickDuration: 0,
        totalInteractions: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.elements.set(elementId, elementRecord);
    this.attachElementListeners(element, elementId);

    console.log(`🔍 تم تسجيل عنصر: ${elementId}`, elementRecord);
  }

  /**
   * إرفاق مستمعي الأحداث بالعنصر
   */
  attachElementListeners(element, elementId) {
    const record = this.elements.get(elementId);

    // مستمع النقر
    element.addEventListener('click', (e) => {
      this.logElementInteraction(elementId, 'click', e);
    });

    // مستمع التغيير
    if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.addEventListener('change', (e) => {
        this.logElementInteraction(elementId, 'change', e);
      });

      element.addEventListener('input', (e) => {
        this.logElementInteraction(elementId, 'input', e);
      });
    }

    // مستمع التركيز
    element.addEventListener('focus', (e) => {
      this.logElementInteraction(elementId, 'focus', e);
      record.state.focused = true;
    });

    element.addEventListener('blur', (e) => {
      this.logElementInteraction(elementId, 'blur', e);
      record.state.focused = false;
    });

    // مستمع الحوم (Hover)
    element.addEventListener('mouseenter', (e) => {
      this.logElementInteraction(elementId, 'hover', e);
      record.state.hovered = true;
    });

    element.addEventListener('mouseleave', (e) => {
      record.state.hovered = false;
    });

    // مستمع الأخطاء
    element.addEventListener('error', (e) => {
      this.logElementError(elementId, 'error', e);
    });

    // مستمع الإرسال للنماذج
    if (element.tagName === 'FORM') {
      element.addEventListener('submit', (e) => {
        this.logElementInteraction(elementId, 'submit', e);
      });
    }

    // مراقبة التغييرات في الخصائص
    this.observeElementProperties(element, elementId);
  }

  /**
   * مراقبة التغييرات في خصائص العنصر
   */
  observeElementProperties(element, elementId) {
    const record = this.elements.get(elementId);
    
    // استخدام MutationObserver لمراقبة التغييرات في الخصائص
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const attrName = mutation.attributeName;
          
          if (attrName === 'disabled') {
            record.state.enabled = !element.disabled;
            this.logElementStateChange(elementId, 'disabled', !element.disabled);
          } else if (attrName === 'class') {
            record.classes = element.className;
            this.logElementStateChange(elementId, 'class', element.className);
          } else if (attrName === 'aria-disabled') {
            record.state.enabled = element.getAttribute('aria-disabled') !== 'true';
            this.logElementStateChange(elementId, 'aria-disabled', record.state.enabled);
          }
        }
      });
    });

    observer.observe(element, {
      attributes: true,
      attributeFilter: ['disabled', 'class', 'aria-disabled', 'aria-hidden', 'style']
    });
  }

  /**
   * تسجيل تفاعل العنصر
   */
  logElementInteraction(elementId, eventType, event) {
    const record = this.elements.get(elementId);
    if (!record) return;

    const timestamp = new Date();
    
    // تحديث إحصائيات الأحداث
    switch (eventType) {
      case 'click':
        record.events.clicks++;
        break;
      case 'change':
        record.events.changes++;
        break;
      case 'input':
        record.events.inputs++;
        break;
      case 'focus':
        record.events.focuses++;
        break;
      case 'blur':
        record.events.blurs++;
        break;
      case 'hover':
        record.events.hovers++;
        break;
    }

    record.lastInteraction = timestamp;
    record.performance.totalInteractions++;

    const interaction = {
      elementId: elementId,
      eventType: eventType,
      timestamp: timestamp,
      target: record.element.tagName,
      text: this.getElementText(record.element),
      value: event.target?.value || null,
      checked: event.target?.checked || null,
      details: {
        x: event.clientX || null,
        y: event.clientY || null,
        key: event.key || null
      }
    };

    this.elementLogs.push(interaction);

    // الاحتفاظ بآخر 5000 سجل فقط
    if (this.elementLogs.length > 5000) {
      this.elementLogs.shift();
    }

    console.log(`✅ تفاعل: ${eventType} على ${record.tag}#${record.id}`, interaction);
  }

  /**
   * تسجيل تغيير حالة العنصر
   */
  logElementStateChange(elementId, property, newValue) {
    const record = this.elements.get(elementId);
    if (!record) return;

    const stateChange = {
      elementId: elementId,
      property: property,
      newValue: newValue,
      timestamp: new Date(),
      element: record.element.tagName
    };

    this.elementLogs.push(stateChange);

    console.log(`🔄 تغيير حالة: ${property} = ${newValue}`, stateChange);
  }

  /**
   * تسجيل خطأ في العنصر
   */
  logElementError(elementId, errorType, error) {
    const record = this.elements.get(elementId);
    if (!record) return;

    record.events.errors++;

    const errorLog = {
      elementId: elementId,
      errorType: errorType,
      message: error.message || 'Unknown error',
      timestamp: new Date(),
      element: record.element.tagName,
      stack: error.stack || null
    };

    record.errors.push(errorLog);
    this.elementErrors.push(errorLog);

    console.error(`❌ خطأ في العنصر: ${elementId}`, errorLog);
  }

  /**
   * فحص دوري لحالة جميع العناصر
   */
  startPeriodicCheck() {
    setInterval(() => {
      this.performElementsHealthCheck();
    }, 5000); // فحص كل 5 ثوانٍ
  }

  /**
   * فحص صحة جميع العناصر
   */
  performElementsHealthCheck() {
    const issues = [];

    this.elements.forEach((record, elementId) => {
      // فحص الرؤية
      const isVisible = record.element.offsetParent !== null;
      if (!isVisible && record.state.visible) {
        issues.push({
          type: 'element_hidden',
          elementId: elementId,
          element: record.tag
        });
        record.state.visible = false;
      }

      // فحص التفعيل
      const isEnabled = !record.element.disabled;
      if (!isEnabled && record.state.enabled) {
        issues.push({
          type: 'element_disabled',
          elementId: elementId,
          element: record.tag
        });
        record.state.enabled = false;
      }

      // فحص الأخطاء المتكررة
      if (record.errors.length > 5) {
        issues.push({
          type: 'element_repeated_errors',
          elementId: elementId,
          element: record.tag,
          errorCount: record.errors.length
        });
      }

      // تحديث آخر تحديث
      record.updatedAt = new Date();
    });

    if (issues.length > 0) {
      console.warn('⚠️ مشاكل في العناصر:', issues);
    }

    return issues;
  }

  /**
   * الحصول على تقرير شامل لعنصر معين
   */
  getElementReport(elementId) {
    const record = this.elements.get(elementId);
    if (!record) return null;

    return {
      id: elementId,
      tag: record.tag,
      type: record.type,
      text: record.text,
      state: record.state,
      events: record.events,
      performance: record.performance,
      errors: record.errors,
      lastInteraction: record.lastInteraction,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  /**
   * الحصول على تقرير شامل لجميع العناصر
   */
  getAllElementsReport() {
    const elements = [];
    
    this.elements.forEach((record, elementId) => {
      elements.push({
        id: elementId,
        tag: record.tag,
        type: record.type,
        text: record.text,
        state: record.state,
        events: record.events,
        performance: record.performance,
        errorCount: record.errors.length,
        lastInteraction: record.lastInteraction
      });
    });

    return {
      timestamp: new Date(),
      totalElements: elements.length,
      elements: elements,
      totalInteractions: this.elementLogs.length,
      totalErrors: this.elementErrors.length,
      recentErrors: this.elementErrors.slice(-20)
    };
  }

  /**
   * الحصول على إحصائيات العناصر حسب النوع
   */
  getElementStatsByType() {
    const stats = {};

    this.elements.forEach((record) => {
      const type = record.type;
      if (!stats[type]) {
        stats[type] = {
          count: 0,
          totalClicks: 0,
          totalChanges: 0,
          totalErrors: 0,
          healthyCount: 0,
          errorCount: 0
        };
      }

      stats[type].count++;
      stats[type].totalClicks += record.events.clicks;
      stats[type].totalChanges += record.events.changes;
      stats[type].totalErrors += record.events.errors;

      if (record.errors.length === 0) {
        stats[type].healthyCount++;
      } else {
        stats[type].errorCount++;
      }
    });

    return stats;
  }

  /**
   * البحث عن عناصر بمعايير معينة
   */
  findElements(criteria) {
    const results = [];

    this.elements.forEach((record, elementId) => {
      let matches = true;

      if (criteria.tag && record.tag !== criteria.tag) matches = false;
      if (criteria.type && record.type !== criteria.type) matches = false;
      if (criteria.hasErrors && record.errors.length === 0) matches = false;
      if (criteria.disabled && record.state.enabled) matches = false;
      if (criteria.text && !record.text.includes(criteria.text)) matches = false;

      if (matches) {
        results.push({
          id: elementId,
          ...record
        });
      }
    });

    return results;
  }

  /**
   * تنظيف السجلات
   */
  clearLogs() {
    this.elementLogs = [];
    this.elementErrors = [];
    console.log('🔄 تم تنظيف السجلات');
  }

  /**
   * إيقاف المراقبة
   */
  stopMonitoring() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    this.isMonitoring = false;
    console.log('⛔ تم إيقاف مراقبة العناصر');
  }

  /**
   * مساعد: إنشاء معرف فريد للعنصر
   */
  generateElementId(element) {
    if (element.id) {
      return element.id;
    }

    const tag = element.tagName.toLowerCase();
    const classes = element.className.split(' ').filter(c => c).join('.');
    const text = this.getElementText(element).substring(0, 20).replace(/\s+/g, '_');
    
    return `${tag}${classes ? '.' + classes : ''}${text ? '_' + text : ''}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * مساعد: الحصول على نص العنصر
   */
  getElementText(element) {
    return element.textContent?.trim().substring(0, 50) || element.value || element.placeholder || '';
  }

  /**
   * مساعد: الحصول على خصائص العنصر
   */
  getElementAttributes(element) {
    const attrs = {};
    Array.from(element.attributes).forEach(attr => {
      if (!['class', 'style', 'id'].includes(attr.name)) {
        attrs[attr.name] = attr.value;
      }
    });
    return attrs;
  }
}

// إنشاء مثيل عام من النظام
export const elementMonitor = new ElementMonitor();

export default ElementMonitor;
