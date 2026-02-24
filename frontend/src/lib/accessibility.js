/**
 * Accessibility Utilities
 * أدوات إمكانية الوصول
 *
 * @module accessibility
 * @description مجموعة من الأدوات لتحسين إمكانية الوصول للتطبيق
 */

// ============================================================================
// ARIA Labels - تسميات ARIA
// ============================================================================

export const ariaLabels = {
  // Navigation
  mainNav: 'القائمة الرئيسية',
  sideNav: 'القائمة الجانبية',
  breadcrumb: 'مسار التنقل',

  // Forms
  loginForm: 'نموذج تسجيل الدخول',
  searchForm: 'نموذج البحث',
  filterForm: 'نموذج التصفية',

  // Buttons
  submitButton: 'إرسال',
  cancelButton: 'إلغاء',
  closeButton: 'إغلاق',
  menuButton: 'فتح القائمة',

  // Status
  loading: 'جارٍ التحميل',
  error: 'حدث خطأ',
  success: 'تمت العملية بنجاح',

  // Queue
  queueNumber: 'رقم الدور',
  currentServing: 'يتم خدمة الرقم',
  waitingCount: 'عدد المنتظرين',
  estimatedTime: 'الوقت المتوقع',

  // Clinics
  clinicName: 'اسم العيادة',
  clinicStatus: 'حالة العيادة',

  // Notifications
  notification: 'إشعار',
  alertMessage: 'رسالة تنبيه',
};

// ============================================================================
// Keyboard Navigation - التنقل بلوحة المفاتيح
// ============================================================================

/**
 * معالج التنقل بلوحة المفاتيح
 * @param {KeyboardEvent} event - حدث لوحة المفاتيح
 * @param {Object} handlers - معالجات المفاتيح
 */
export function handleKeyboardNavigation(event, handlers) {
  const keyHandlers = {
    Enter: handlers.onEnter,
    ' ': handlers.onSpace,
    Escape: handlers.onEscape,
    ArrowUp: handlers.onArrowUp,
    ArrowDown: handlers.onArrowDown,
    ArrowLeft: handlers.onArrowLeft,
    ArrowRight: handlers.onArrowRight,
    Tab: handlers.onTab,
    Home: handlers.onHome,
    End: handlers.onEnd,
  };

  const handler = keyHandlers[event.key];
  if (handler) {
    handler(event);
  }
}

/**
 * إضافة دعم التنقل بلوحة المفاتيح لقائمة
 * @param {HTMLElement} container - العنصر الحاوي
 * @param {string} itemSelector - محدد العناصر
 */
export function enableListKeyboardNavigation(container, itemSelector) {
  if (!container) return;

  const items = container.querySelectorAll(itemSelector);
  let currentIndex = 0;

  container.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        currentIndex = Math.min(currentIndex + 1, items.length - 1);
        items[currentIndex]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
        items[currentIndex]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        currentIndex = 0;
        items[currentIndex]?.focus();
        break;
      case 'End':
        event.preventDefault();
        currentIndex = items.length - 1;
        items[currentIndex]?.focus();
        break;
    }
  });
}

// ============================================================================
// Focus Management - إدارة التركيز
// ============================================================================

/**
 * حصر التركيز داخل عنصر (للـ modals)
 * @param {HTMLElement} element - العنصر
 */
export function trapFocus(element) {
  if (!element) return;

  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  });

  // التركيز على العنصر الأول
  firstElement?.focus();
}

/**
 * إعادة التركيز للعنصر السابق
 * @param {HTMLElement} previousElement - العنصر السابق
 */
export function restoreFocus(previousElement) {
  if (previousElement && typeof previousElement.focus === 'function') {
    previousElement.focus();
  }
}

// ============================================================================
// Screen Reader Announcements - إعلانات قارئ الشاشة
// ============================================================================

let announcer = null;

/**
 * إنشاء عنصر الإعلان لقارئ الشاشة
 */
function createAnnouncer() {
  if (announcer) return announcer;

  announcer = document.createElement('div');
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  announcer.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  document.body.appendChild(announcer);

  return announcer;
}

/**
 * إعلان رسالة لقارئ الشاشة
 * @param {string} message - الرسالة
 * @param {string} priority - الأولوية ('polite' | 'assertive')
 */
export function announce(message, priority = 'polite') {
  const el = createAnnouncer();
  el.setAttribute('aria-live', priority);

  // مسح المحتوى السابق ثم إضافة الجديد
  el.textContent = '';
  setTimeout(() => {
    el.textContent = message;
  }, 100);
}

/**
 * إعلان تغيير في الطابور
 * @param {number} queueNumber - رقم الدور
 * @param {number} currentServing - الرقم الحالي
 */
export function announceQueueUpdate(queueNumber, currentServing) {
  const message = `رقم دورك ${queueNumber}. يتم الآن خدمة الرقم ${currentServing}.`;
  announce(message, 'polite');
}

/**
 * إعلان استدعاء المراجع
 * @param {number} ticketNumber - رقم التذكرة
 * @param {string} clinicName - اسم العيادة
 */
export function announcePatientCall(ticketNumber, clinicName) {
  const message = `تنبيه! الرقم ${ticketNumber} مطلوب في ${clinicName}`;
  announce(message, 'assertive');
}

// ============================================================================
// Color Contrast - تباين الألوان
// ============================================================================

/**
 * التحقق من نسبة التباين
 * @param {string} foreground - لون النص
 * @param {string} background - لون الخلفية
 * @returns {number} نسبة التباين
 */
export function getContrastRatio(foreground, background) {
  const getLuminance = (color) => {
    const rgb = color.match(/\d+/g).map(Number);
    const [r, g, b] = rgb.map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * التحقق من أن التباين يلبي معايير WCAG
 * @param {string} foreground - لون النص
 * @param {string} background - لون الخلفية
 * @param {string} level - المستوى ('AA' | 'AAA')
 * @returns {boolean}
 */
export function meetsContrastRequirements(foreground, background, level = 'AA') {
  const ratio = getContrastRatio(foreground, background);
  return level === 'AAA' ? ratio >= 7 : ratio >= 4.5;
}

export default {
  ariaLabels,
  handleKeyboardNavigation,
  enableListKeyboardNavigation,
  trapFocus,
  restoreFocus,
  announce,
  announceQueueUpdate,
  announcePatientCall,
  getContrastRatio,
  meetsContrastRequirements,
};
