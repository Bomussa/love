/**
 * Notification Engine - مصدر واحد للإشعارات
 * بدون PIN - بدون أخطاء syntax
 */
import eventBus from './event-bus.js';

export const NOTIFICATION_TYPES = {
  START_HINT: 'START_HINT',
  NEAR_TURN: 'NEAR_TURN',
  YOUR_TURN: 'YOUR_TURN',
  STEP_DONE_NEXT: 'STEP_DONE_NEXT',
  RESET_DONE: 'RESET_DONE',
  CLINIC_OPENED: 'CLINIC_OPENED',
  CLINIC_CLOSED: 'CLINIC_CLOSED',
  QUEUE_UPDATE: 'QUEUE_UPDATE',
};

const UI_TYPE_ALIASES = {
  START_HINT: 'info',
  RESET_DONE: 'success',
  CLINIC_OPENED: 'success',
  CLINIC_CLOSED: 'warning',
  QUEUE_UPDATE: 'queue_update',
  NEAR_TURN: 'near_turn',
  YOUR_TURN: 'your_turn',
  STEP_DONE_NEXT: 'next_clinic',
};

function normalizeUiType(type) {
  const key = String(type || 'info').trim();
  return UI_TYPE_ALIASES[key] || UI_TYPE_ALIASES[key.toUpperCase()] || key.toLowerCase();
}

let _tplCache = null, _tplTime = 0;
const TPL_TTL = 5 * 60 * 1000;

export async function loadAllNotifications(supabase) {
  const now = Date.now();
  if (_tplCache && now - _tplTime < TPL_TTL) return _tplCache;
  try {
    const { data, error } = await (supabase || window._sb)
      .from('operational_notifications').select('*').eq('is_active', true);
    if (!error && data) {
      _tplCache = {};
      data.forEach(r => { _tplCache[r.notification_type] = r; });
      _tplTime = now;
    }
  } catch(e) { console.warn('[NotifEngine] template load failed', e); }
  return _tplCache || {};
}

export class NotificationEngine {
  constructor() {
    this.notifications = new Map();
    this.adminNotifications = [];
    this.subscribers = new Map();
    this.adminSubscribers = new Set();
    this._loadSaved();
    this._setupListeners();
    this._startSync();
  }

  _loadSaved() {
    try {
      const s = localStorage.getItem('patient_notifications');
      if (s) { const p = JSON.parse(s); Object.keys(p).forEach(k => this.notifications.set(k, p[k])); }
      const a = localStorage.getItem('admin_notifications');
      if (a) this.adminNotifications = JSON.parse(a);
    } catch(e) { console.warn('[NotifEngine] load failed', e); }
  }

  _save() {
    try {
      const obj = {};
      this.notifications.forEach((v,k) => { obj[k] = v; });
      localStorage.setItem('patient_notifications', JSON.stringify(obj));
      localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications));
    } catch(e) {}
  }

  _startSync() { setInterval(() => this._save(), 30000); }

  _setupListeners() {
    if (!eventBus) return;
    if (typeof eventBus.on === 'function') {
      eventBus.on('system:reset', () => this.sendResetDone());
      eventBus.on('clinic:opened', d => this.sendClinicOpened(d?.name));
      eventBus.on('clinic:closed', d => this.sendClinicClosed(d?.name));
    }
  }

  subscribe(patientId, cb) {
    if (!this.subscribers.has(patientId)) this.subscribers.set(patientId, new Set());
    this.subscribers.get(patientId).add(cb);
    return () => {
      const ss = this.subscribers.get(patientId);
      if (ss) { ss.delete(cb); if (!ss.size) this.subscribers.delete(patientId); }
    };
  }

  subscribeAdmin(cb) {
    this.adminSubscribers.add(cb);
    return () => this.adminSubscribers.delete(cb);
  }

  notifyPatient(patientId, notif) {
    const normalizedType = normalizeUiType(notif.type);
    const item = {
      id: Date.now()+'_'+Math.random().toString(36).substr(2,9),
      timestamp: new Date().toISOString(),
      read: false,
      type: normalizedType,
      ...notif,
      type: normalizedType,
    };
    if (!this.notifications.has(patientId)) this.notifications.set(patientId, []);
    const list = this.notifications.get(patientId);
    list.push(item);
    if (list.length > 100) list.shift();
    localStorage.setItem('notifications_'+patientId, JSON.stringify(list));
    this.subscribers.get(patientId)?.forEach(cb => { try { cb(item); } catch{} });
    if (typeof eventBus?.emit === 'function') eventBus.emit('notification', { patientId, ...item });
    this._triggerAlerts(item);
  }

  notifyAdmin(notif) {
    const item = {
      id: 'admin_'+Date.now()+'_'+Math.random().toString(36).substr(2,9),
      timestamp: new Date().toISOString(),
      read: false,
      ...notif
    };
    this.adminNotifications.push(item);
    if (this.adminNotifications.length > 200) this.adminNotifications.shift();
    localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications));
    this.adminSubscribers.forEach(cb => { try { cb(item); } catch{} });
    if (typeof eventBus?.emit === 'function') eventBus.emit('admin_notification', item);
  }

  async sendWelcome(patientId) {
    this.notifyPatient(patientId, { type: NOTIFICATION_TYPES.START_HINT, title: '👋 مرحباً بك', message: 'تم تسجيل دخولك في نظام اللجنة الطبية', priority: 'normal', sound: false });
  }

  async sendNearTurn(patientId, clinicName, position) {
    this.notifyPatient(patientId, { type: NOTIFICATION_TYPES.NEAR_TURN, title: '⏰ اقترب دورك', message: `اقترب دورك في ${clinicName}. موقعك: ${position}`, clinicName, position, priority: 'high', sound: true, vibrate: false });
  }

  async sendYourTurn(patientId, clinicName, number) {
    this.notifyPatient(patientId, { type: NOTIFICATION_TYPES.YOUR_TURN, title: '🔔 حان دورك الآن!', message: `حان دورك في ${clinicName}. رقمك: ${number}`, clinicName, number, priority: 'urgent', sound: true, vibrate: true });
  }

  async sendStepDone(patientId, currentClinic, nextClinic) {
    const msg = nextClinic ? `تم إنهاء ${currentClinic}. انتقل الآن إلى ${nextClinic}` : `تم إنهاء ${currentClinic}. انتظر التعليمات`;
    this.notifyPatient(patientId, { type: NOTIFICATION_TYPES.STEP_DONE_NEXT, title: '✅ تم إنهاء الفحص', message: msg, currentClinic, nextClinic, priority: 'high', sound: true, vibrate: false });
  }

  async sendQueueUpdate(patientId, clinicName, position, totalWaiting) {
    this.notifyPatient(patientId, { type: NOTIFICATION_TYPES.QUEUE_UPDATE, title: '📊 تحديث الطابور', message: `موقعك في ${clinicName}: ${position} من ${totalWaiting}`, clinicName, position, totalWaiting, priority: 'low', sound: false, vibrate: false });
  }

  sendResetDone() {
    this.notifyAdmin({ type: NOTIFICATION_TYPES.RESET_DONE, title: '🔄 إعادة تعيين النظام', message: 'تم إعادة تعيين النظام بنجاح', priority: 'normal' });
  }

  sendClinicOpened(clinicName) {
    this.notifyAdmin({ type: NOTIFICATION_TYPES.CLINIC_OPENED, title: '🟢 فتح عيادة', message: `تم فتح ${clinicName}`, clinicName, priority: 'normal' });
  }

  sendClinicClosed(clinicName) {
    this.notifyAdmin({ type: NOTIFICATION_TYPES.CLINIC_CLOSED, title: '🔴 إغلاق عيادة', message: `تم إغلاق ${clinicName}`, clinicName, priority: 'normal' });
  }

  _triggerAlerts(notif) {
    if (notif.sound) this._playSound(notif.priority)
    if (notif.vibrate && 'vibrate' in navigator) {
      switch(notif.priority) {
        case 'urgent': navigator.vibrate([200,100,200,100,200]); break;
        case 'high':   navigator.vibrate([200,100,200]); break;
        default:        navigator.vibrate(200);
      }
    }
    if (notif.priority==='urgent'||notif.priority==='high') this._showBrowserNotif(notif)
  }

  _playSound(priority='normal') {
    try {
      new Audio(priority==='urgent'?'/sounds/urgent.mp3':'/sounds/notify.mp3').play().catch(()=>{});
    } catch{}
  }

  _showBrowserNotif(notif) {
    if (!('Notification' in window)) return;
    if (Notification.permission==='granted') {
      new Notification(notif.title, { body: notif.message, icon: '/logo.png' });
    } else if (Notification.permission!=='denied') {
      Notification.requestPermission().then(p => {
        if (p==='granted') new Notification(notif.title, { body: notif.message, icon: '/logo.png' });
      });
    }
  }

  getNotifications(patientId) { return this.notifications.get(patientId) || []; }
  getAdminNotifications() { return this.adminNotifications; }

  markAsRead(patientId, id) {
    const list = this.notifications.get(patientId);
    if (list) { const n=list.find(x=>x.id===id); if(n){n.read=true; this._save();} }
  }

  markAdminAsRead(id) {
    const n = this.adminNotifications.find(x=>x.id===id);
    if (n) { n.read=true; this._save(); }
  }

  clearNotifications(patientId) {
    this.notifications.delete(patientId);
    localStorage.removeItem('notifications_'+patientId);
  }
}

export default new NotificationEngine();
