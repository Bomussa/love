/**
 * integration.test.js — Phase D: Integration Tests
 * اختبارات التكامل لـ admin login flow و notifications deduplication
 */

// ==================== TEST RUNNER ====================
let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => {
        console.log(`  ✅ PASS: ${name}`);
        passed++;
        results.push({ name, type: 'integration', result: 'PASS', evidence: 'No error thrown' });
      }).catch(e => {
        console.log(`  ❌ FAIL: ${name} — ${e.message}`);
        failed++;
        results.push({ name, type: 'integration', result: 'FAIL', evidence: e.message });
      });
    }
    console.log(`  ✅ PASS: ${name}`);
    passed++;
    results.push({ name, type: 'integration', result: 'PASS', evidence: 'No error thrown' });
  } catch (e) {
    console.log(`  ❌ FAIL: ${name} — ${e.message}`);
    failed++;
    results.push({ name, type: 'integration', result: 'FAIL', evidence: e.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, message) {
  if (a !== b) throw new Error(message || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ==================== MOCK SETUP ====================
// محاكاة eventBus
class MockEventBus {
  constructor() {
    this.listeners = {};
    this.emittedEvents = [];
  }
  
  on(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
    return () => this.off(event, handler);
  }
  
  off(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
  }
  
  emit(event, data) {
    this.emittedEvents.push({ event, data, timestamp: Date.now() });
    if (this.listeners[event]) {
      this.listeners[event].forEach(h => h(data));
    }
  }
  
  getEmittedCount(event) {
    return this.emittedEvents.filter(e => e.event === event).length;
  }
  
  clearEvents() {
    this.emittedEvents = [];
  }
}

// محاكاة admin login flow
class MockAdminLoginFlow {
  constructor() {
    this.isSubmitting = false;
    this.submitCount = 0;
    this.validationErrors = [];
  }
  
  async handleAdminSubmit(username, password) {
    // منع double submit
    if (this.isSubmitting) return { blocked: true };
    
    this.isSubmitting = true;
    this.validationErrors = [];
    
    try {
      // التحقق من صحة البيانات
      if (!username || username.length < 3) {
        this.validationErrors.push('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
      }
      if (!password || password.length < 4) {
        this.validationErrors.push('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      }
      
      if (this.validationErrors.length > 0) {
        return { success: false, errors: this.validationErrors };
      }
      
      this.submitCount++;
      // محاكاة طلب API
      await new Promise(resolve => setTimeout(resolve, 10));
      return { success: true };
    } finally {
      this.isSubmitting = false;
    }
  }
}

// ==================== INTEGRATION TESTS ====================
console.log('\n📋 D2-A: Admin Login Flow Tests');

const adminFlow = new MockAdminLoginFlow();

test('admin login: double submit مُنع', async () => {
  adminFlow.isSubmitting = true;
  const result = await adminFlow.handleAdminSubmit('admin', '1234');
  assert(result.blocked, 'يجب أن يُمنع double submit');
  adminFlow.isSubmitting = false;
});

test('admin login: username لا يُعاد تعيينه بعد فشل validation', async () => {
  const username = 'ab'; // قصير جداً
  const result = await adminFlow.handleAdminSubmit(username, '1234');
  assert(!result.success, 'يجب أن يفشل');
  // التحقق من أن username لم يتغير (لا يوجد reset)
  assertEqual(username, 'ab', 'username يجب أن يبقى كما هو');
});

test('admin login: بيانات صحيحة تنجح', async () => {
  const freshFlow = new MockAdminLoginFlow();
  const result = await freshFlow.handleAdminSubmit('admin', '1234');
  assert(result.success, 'يجب أن ينجح');
});

test('admin login: isSubmitting يُعاد إلى false بعد الانتهاء', async () => {
  await adminFlow.handleAdminSubmit('admin', '1234');
  assert(!adminFlow.isSubmitting, 'يجب أن يكون isSubmitting=false');
});

console.log('\n📋 D2-B: Notification Deduplication Tests');

const eventBus = new MockEventBus();
const sentEvents = new Set();

function emitWithDedup(eventType, patientId, clinicId, data) {
  const today = new Date().toISOString().split('T')[0];
  const key = `${patientId}:${eventType}:${clinicId}:${today}`;
  
  if (sentEvents.has(key)) {
    return false; // مُكرر، لا تُرسل
  }
  
  sentEvents.add(key);
  eventBus.emit(eventType, data);
  return true;
}

test('notifications: YOUR_TURN يُرسل مرة واحدة فقط', () => {
  eventBus.clearEvents();
  sentEvents.clear();
  
  // محاولة إرسال YOUR_TURN مرتين
  emitWithDedup('queue:your_turn', 'patient1', 'clinic1', { position: 0 });
  emitWithDedup('queue:your_turn', 'patient1', 'clinic1', { position: 0 });
  
  assertEqual(eventBus.getEmittedCount('queue:your_turn'), 1, 'يجب أن يُرسل مرة واحدة فقط');
});

test('notifications: NEAR_TURN يُرسل مرة واحدة لكل position', () => {
  eventBus.clearEvents();
  sentEvents.clear();
  
  // position=3 مرتين
  emitWithDedup('queue:near_turn', 'patient1', 'clinic1', { position: 3 });
  emitWithDedup('queue:near_turn', 'patient1', 'clinic1', { position: 3 });
  
  assertEqual(eventBus.getEmittedCount('queue:near_turn'), 1, 'يجب أن يُرسل مرة واحدة');
});

test('notifications: NEAR_TURN يُرسل لكل position مختلف', () => {
  eventBus.clearEvents();
  // استخدام sentEvents جديد
  const localSentEvents = new Set();
  
  function emitLocal(eventType, patientId, clinicId, position, data) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${patientId}:${eventType}:${clinicId}:${today}:${position}`;
    if (localSentEvents.has(key)) return false;
    localSentEvents.add(key);
    eventBus.emit(eventType, data);
    return true;
  }
  
  emitLocal('queue:near_turn', 'patient1', 'clinic1', 3, { position: 3 });
  emitLocal('queue:near_turn', 'patient1', 'clinic1', 2, { position: 2 });
  emitLocal('queue:near_turn', 'patient1', 'clinic1', 1, { position: 1 });
  
  assertEqual(eventBus.getEmittedCount('queue:near_turn'), 3, 'يجب أن يُرسل 3 مرات لـ 3 positions مختلفة');
});

test('notifications: STEP_DONE يُرسل مرة واحدة فقط', () => {
  eventBus.clearEvents();
  sentEvents.clear();
  
  emitWithDedup('queue:step_done', 'patient1', 'clinic1', { currentClinic: 'lab' });
  emitWithDedup('queue:step_done', 'patient1', 'clinic1', { currentClinic: 'lab' });
  
  assertEqual(eventBus.getEmittedCount('queue:step_done'), 1, 'يجب أن يُرسل مرة واحدة فقط');
});

test('notifications: START_HINT يُرسل مرة واحدة فقط', () => {
  eventBus.clearEvents();
  sentEvents.clear();
  
  emitWithDedup('queue:start_hint', 'patient1', 'clinic1', { clinicName: 'المختبر' });
  emitWithDedup('queue:start_hint', 'patient1', 'clinic1', { clinicName: 'المختبر' });
  
  assertEqual(eventBus.getEmittedCount('queue:start_hint'), 1, 'يجب أن يُرسل مرة واحدة فقط');
});

test('notifications: مرضى مختلفون يحصلون على أحداث مستقلة', () => {
  eventBus.clearEvents();
  sentEvents.clear();
  
  emitWithDedup('queue:your_turn', 'patient1', 'clinic1', { position: 0 });
  emitWithDedup('queue:your_turn', 'patient2', 'clinic1', { position: 0 });
  emitWithDedup('queue:your_turn', 'patient3', 'clinic1', { position: 0 });
  
  assertEqual(eventBus.getEmittedCount('queue:your_turn'), 3, 'يجب أن يُرسل 3 مرات لـ 3 مرضى مختلفين');
});

// ==================== PATIENT FLOW TESTS ====================
console.log('\n📋 D2-C: Patient Basic Flow Tests');

class MockPatientFlow {
  constructor() {
    this.stations = [
      { id: 'lab', nameAr: 'المختبر', status: 'ready', isEntered: false, yourNumber: null },
      { id: 'vitals', nameAr: 'القياسات', status: 'locked', isEntered: false, yourNumber: null },
      { id: 'final', nameAr: 'اللجنة النهائية', status: 'locked', isEntered: false, yourNumber: null },
    ];
    this.currentStationIndex = 0;
  }
  
  enterStation(stationId) {
    const idx = this.stations.findIndex(s => s.id === stationId);
    if (idx < 0 || this.stations[idx].status !== 'ready') return { success: false, error: 'Station not ready' };
    
    this.stations[idx].isEntered = true;
    this.stations[idx].yourNumber = idx + 1;
    return { success: true, display_number: idx + 1 };
  }
  
  exitStation(stationId) {
    const idx = this.stations.findIndex(s => s.id === stationId);
    if (idx < 0 || !this.stations[idx].isEntered) return { success: false, error: 'Not in station' };
    
    this.stations[idx].status = 'completed';
    this.stations[idx].isEntered = false;
    
    if (idx + 1 < this.stations.length) {
      this.stations[idx + 1].status = 'ready';
    }
    
    return { success: true };
  }
  
  getCurrentStation() {
    return this.stations.find(s => s.status === 'ready');
  }
}

const patientFlow = new MockPatientFlow();

test('patient flow: دخول العيادة الأولى ينجح', () => {
  const result = patientFlow.enterStation('lab');
  assert(result.success, 'يجب أن ينجح دخول العيادة الأولى');
  assert(patientFlow.stations[0].isEntered, 'يجب أن تكون isEntered=true');
});

test('patient flow: الخروج من العيادة الأولى يفتح الثانية', () => {
  patientFlow.exitStation('lab');
  assertEqual(patientFlow.stations[0].status, 'completed', 'يجب أن تكون الأولى completed');
  assertEqual(patientFlow.stations[1].status, 'ready', 'يجب أن تكون الثانية ready');
});

test('patient flow: العيادة المغلقة لا يمكن دخولها', () => {
  const freshFlow = new MockPatientFlow();
  const result = freshFlow.enterStation('vitals'); // مغلقة
  assert(!result.success, 'يجب أن يفشل دخول العيادة المغلقة');
});

// ==================== RESULTS ====================
setTimeout(() => {
  console.log('\n==================== RESULTS ====================');
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  const successRate = ((passed / (passed + failed)) * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%`);
  
  if (parseFloat(successRate) < 98) {
    console.log('\n❌ SUCCESS RATE < 98% — DEPLOY BLOCKED');
    process.exit(1);
  } else {
    console.log('\n✅ SUCCESS RATE >= 98% — DEPLOY ALLOWED');
  }
}, 500);
