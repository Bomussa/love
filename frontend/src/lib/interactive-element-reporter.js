/**
 * نظام تقارير العناصر التفاعلية (Interactive Element Reporter)
 * يكتب تقرير مفصل عن حالة كل عنصر تفاعلي (يعمل أم لا)
 */

class InteractiveElementReporter {
  constructor() {
    this.elements = new Map();
    this.report = {
      timestamp: new Date(),
      totalElements: 0,
      workingElements: 0,
      brokenElements: 0,
      elements: [],
      summary: {}
    };
    this.testResults = [];
  }

  /**
   * بدء المراقبة والتقارير
   */
  startReporting() {
    console.log('📋 نظام التقارير: جاري البدء');

    // مراقبة جميع العناصر التفاعلية
    this.monitorAllInteractiveElements();

    // اختبار العناصر دورياً
    setInterval(() => this.testAllElements(), 60000); // كل دقيقة

    // إنشاء تقرير أولي
    this.generateReport();

    console.log('✅ نظام التقارير: تم التفعيل');
  }

  /**
   * مراقبة جميع العناصر التفاعلية
   */
  monitorAllInteractiveElements() {
    const interactiveSelectors = [
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[onclick]',
      '.btn',
      '.button',
      '[data-testid*="button"]',
      '[data-testid*="link"]',
      'form',
      '[contenteditable="true"]'
    ];

    interactiveSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element, index) => {
          const elementId = `${selector}_${index}_${Date.now()}`;
          this.registerElement(elementId, element, selector);
        });
      } catch (error) {
        console.warn(`⚠️ خطأ في مراقبة ${selector}:`, error);
      }
    });

    console.log(`📊 تم تسجيل ${this.elements.size} عنصر تفاعلي`);
  }

  /**
   * تسجيل عنصر تفاعلي
   */
  registerElement(id, element, selector) {
    const elementData = {
      id: id,
      selector: selector,
      type: element.tagName.toLowerCase(),
      text: element.textContent?.substring(0, 50) || '',
      classes: element.className || '',
      id_attr: element.id || '',
      status: 'unknown',
      lastTested: null,
      testResults: [],
      errors: [],
      clickable: this.isClickable(element),
      visible: this.isVisible(element),
      enabled: !element.disabled
    };

    this.elements.set(id, elementData);

    // إضافة مستمع الأحداث
    this.attachEventListeners(element, id);
  }

  /**
   * إضافة مستمعي الأحداث
   */
  attachEventListeners(element, elementId) {
    const events = ['click', 'change', 'input', 'focus', 'blur', 'submit'];

    events.forEach(event => {
      element.addEventListener(event, (e) => {
        this.recordElementEvent(elementId, event, e);
      }, true);
    });
  }

  /**
   * تسجيل حدث عنصر
   */
  recordElementEvent(elementId, eventType, event) {
    const elementData = this.elements.get(elementId);
    if (!elementData) return;

    const eventRecord = {
      timestamp: new Date(),
      type: eventType,
      success: true,
      error: null
    };

    try {
      // اختبار أن الحدث يعمل بشكل صحيح
      if (eventType === 'click') {
        this.testClickEvent(event.target);
      } else if (eventType === 'change') {
        this.testChangeEvent(event.target);
      } else if (eventType === 'submit') {
        this.testSubmitEvent(event.target);
      }

      elementData.status = 'working';
    } catch (error) {
      eventRecord.success = false;
      eventRecord.error = error.message;
      elementData.status = 'broken';
      elementData.errors.push(error.message);
    }

    elementData.testResults.push(eventRecord);
    elementData.lastTested = new Date();
  }

  /**
   * اختبار حدث النقر
   */
  testClickEvent(element) {
    if (!element) throw new Error('Element is null');
    if (!this.isClickable(element)) throw new Error('Element is not clickable');
    if (!this.isVisible(element)) throw new Error('Element is not visible');
  }

  /**
   * اختبار حدث التغيير
   */
  testChangeEvent(element) {
    if (!element) throw new Error('Element is null');
    if (element.disabled) throw new Error('Element is disabled');
    if (!this.isVisible(element)) throw new Error('Element is not visible');
  }

  /**
   * اختبار حدث الإرسال
   */
  testSubmitEvent(element) {
    if (!element) throw new Error('Element is null');
    if (element.tagName !== 'FORM') throw new Error('Element is not a form');
  }

  /**
   * اختبار جميع العناصر
   */
  async testAllElements() {
    console.log('🧪 اختبار جميع العناصر التفاعلية...');

    for (const [elementId, elementData] of this.elements) {
      await this.testElement(elementId, elementData);
    }

    this.generateReport();
  }

  /**
   * اختبار عنصر واحد
   */
  async testElement(elementId, elementData) {
    const testResult = {
      timestamp: new Date(),
      elementId: elementId,
      tests: {
        exists: false,
        visible: false,
        clickable: false,
        enabled: false,
        responsive: false
      },
      issues: [],
      status: 'unknown'
    };

    try {
      // اختبار الوجود
      const element = document.querySelector(`[data-element-id="${elementId}"]`) || 
                      document.querySelector(elementData.selector);
      
      if (!element) {
        testResult.issues.push('العنصر غير موجود في الصفحة');
        testResult.status = 'missing';
        this.testResults.push(testResult);
        return;
      }

      testResult.tests.exists = true;

      // اختبار الرؤية
      if (this.isVisible(element)) {
        testResult.tests.visible = true;
      } else {
        testResult.issues.push('العنصر غير مرئي');
      }

      // اختبار القابلية للنقر
      if (this.isClickable(element)) {
        testResult.tests.clickable = true;
      } else {
        testResult.issues.push('العنصر غير قابل للنقر');
      }

      // اختبار التفعيل
      if (!element.disabled) {
        testResult.tests.enabled = true;
      } else {
        testResult.issues.push('العنصر معطل');
      }

      // اختبار الاستجابة
      if (await this.testResponsiveness(element)) {
        testResult.tests.responsive = true;
      } else {
        testResult.issues.push('العنصر لا يستجيب');
      }

      // تحديد الحالة
      if (testResult.issues.length === 0) {
        testResult.status = 'working';
        elementData.status = 'working';
      } else {
        testResult.status = 'broken';
        elementData.status = 'broken';
      }

    } catch (error) {
      testResult.issues.push(`خطأ في الاختبار: ${error.message}`);
      testResult.status = 'error';
      elementData.status = 'error';
    }

    this.testResults.push(testResult);
  }

  /**
   * اختبار استجابة العنصر
   */
  async testResponsiveness(element) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 1000);

      try {
        // محاولة تشغيل حدث
        const event = new Event('test', { bubbles: true });
        element.dispatchEvent(event);
        clearTimeout(timeout);
        resolve(true);
      } catch (error) {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  /**
   * التحقق من قابلية النقر
   */
  isClickable(element) {
    if (!element) return false;
    if (element.disabled) return false;
    if (element.tagName === 'BUTTON' || element.tagName === 'A') return true;
    if (element.getAttribute('role') === 'button') return true;
    if (element.onclick) return true;
    if (element.className?.includes('btn') || element.className?.includes('button')) return true;
    return false;
  }

  /**
   * التحقق من الرؤية
   */
  isVisible(element) {
    if (!element) return false;
    if (element.offsetParent === null) return false;
    if (getComputedStyle(element).display === 'none') return false;
    if (getComputedStyle(element).visibility === 'hidden') return false;
    if (getComputedStyle(element).opacity === '0') return false;
    return true;
  }

  /**
   * إنشاء تقرير شامل
   */
  generateReport() {
    console.log('📝 إنشاء التقرير الشامل...');

    this.report = {
      timestamp: new Date(),
      totalElements: this.elements.size,
      workingElements: 0,
      brokenElements: 0,
      missingElements: 0,
      errorElements: 0,
      elements: [],
      summary: {
        successRate: 0,
        issues: [],
        recommendations: []
      }
    };

    // تجميع البيانات
    for (const [elementId, elementData] of this.elements) {
      const elementReport = {
        id: elementId,
        selector: elementData.selector,
        type: elementData.type,
        text: elementData.text,
        status: elementData.status,
        visible: elementData.visible,
        enabled: elementData.enabled,
        clickable: elementData.clickable,
        errors: elementData.errors,
        lastTested: elementData.lastTested,
        testCount: elementData.testResults.length
      };

      this.report.elements.push(elementReport);

      // حساب الإحصائيات
      if (elementData.status === 'working') {
        this.report.workingElements++;
      } else if (elementData.status === 'broken') {
        this.report.brokenElements++;
      } else if (elementData.status === 'missing') {
        this.report.missingElements++;
      } else if (elementData.status === 'error') {
        this.report.errorElements++;
      }
    }

    // حساب معدل النجاح
    if (this.report.totalElements > 0) {
      this.report.summary.successRate = 
        ((this.report.workingElements / this.report.totalElements) * 100).toFixed(2) + '%';
    }

    // إضافة التوصيات
    if (this.report.brokenElements > 0) {
      this.report.summary.recommendations.push(
        `⚠️ هناك ${this.report.brokenElements} عنصر معطل يحتاج إلى إصلاح`
      );
    }

    if (this.report.missingElements > 0) {
      this.report.summary.recommendations.push(
        `⚠️ هناك ${this.report.missingElements} عنصر مفقود من الصفحة`
      );
    }

    // طباعة التقرير
    this.printReport();

    return this.report;
  }

  /**
   * طباعة التقرير
   */
  printReport() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 تقرير العناصر التفاعلية');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`⏰ الوقت: ${this.report.timestamp.toLocaleString('ar-SA')}`);
    console.log(`📊 إجمالي العناصر: ${this.report.totalElements}`);
    console.log(`✅ عناصر تعمل: ${this.report.workingElements}`);
    console.log(`❌ عناصر معطلة: ${this.report.brokenElements}`);
    console.log(`⚠️ عناصر مفقودة: ${this.report.missingElements}`);
    console.log(`🔴 عناصر بها أخطاء: ${this.report.errorElements}`);
    console.log(`📈 معدل النجاح: ${this.report.summary.successRate}`);
    console.log('───────────────────────────────────────────────────────────');

    // طباعة العناصر المعطلة
    const brokenElements = this.report.elements.filter(e => e.status === 'broken');
    if (brokenElements.length > 0) {
      console.log('❌ العناصر المعطلة:');
      brokenElements.forEach(element => {
        console.log(`  • ${element.type} (${element.selector})`);
        console.log(`    النص: ${element.text}`);
        console.log(`    الأخطاء: ${element.errors.join(', ')}`);
      });
    }

    // طباعة التوصيات
    if (this.report.summary.recommendations.length > 0) {
      console.log('───────────────────────────────────────────────────────────');
      console.log('💡 التوصيات:');
      this.report.summary.recommendations.forEach(rec => {
        console.log(`  ${rec}`);
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
  }

  /**
   * تصدير التقرير كـ JSON
   */
  exportReportAsJSON() {
    const reportJSON = JSON.stringify(this.report, null, 2);
    console.log('📄 تقرير JSON:');
    console.log(reportJSON);
    return reportJSON;
  }

  /**
   * تصدير التقرير كـ CSV
   */
  exportReportAsCSV() {
    let csv = 'النوع,المحدد,النص,الحالة,مرئي,مفعل,قابل للنقر,عدد الاختبارات\n';

    this.report.elements.forEach(element => {
      csv += `${element.type},"${element.selector}","${element.text}",${element.status},${element.visible},${element.enabled},${element.clickable},${element.testCount}\n`;
    });

    console.log('📊 تقرير CSV:');
    console.log(csv);
    return csv;
  }

  /**
   * الحصول على التقرير
   */
  getReport() {
    return this.report;
  }

  /**
   * الحصول على نتائج الاختبار
   */
  getTestResults() {
    return this.testResults;
  }
}

export default InteractiveElementReporter;
