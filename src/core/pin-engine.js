// محرك البنكود (PIN Engine) - النظام الرسمي
import settings from '../../data/settings.json'

class PinEngine {
  constructor() {
    this.dailyPins = [] // قائمة البينات اليومية العشوائية (20 بين)
    this.usedPinsIndex = 0 // مؤشر البين الحالي
    this.lastReset = null
    this.init()
  }

  init() {
    this.checkDailyReset()
    // جدولة الفحص كل دقيقة
    setInterval(() => this.checkDailyReset(), 60000)
  }

  checkDailyReset() {
    const now = new Date()
    const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: settings.REGION }))
    const resetTime = settings.PIN_RESET_TIME.split(':')
    const resetHour = parseInt(resetTime[0])
    const resetMinute = parseInt(resetTime[1])

    const lastResetDate = this.lastReset ? new Date(this.lastReset) : null
    const todayReset = new Date(qatarTime)
    todayReset.setHours(resetHour, resetMinute, 0, 0)

    // إذا تجاوزنا وقت الإعادة ولم نقم بالإعادة اليوم
    if (qatarTime >= todayReset && (!lastResetDate || lastResetDate < todayReset)) {
      this.resetAll()
      this.lastReset = qatarTime.toISOString()
    }
  }

  // توليد 20 بين عشوائي
  generateRandomPins() {
    const pins = []
    // إنشاء مصفوفة من 01 إلى 20
    for (let i = settings.PIN_START; i <= settings.PIN_END; i++) {
      pins.push(i.toString().padStart(2, '0'))
    }
    
    // خلط المصفوفة بشكل عشوائي (Fisher-Yates shuffle)
    for (let i = pins.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pins[i], pins[j]] = [pins[j], pins[i]]
    }
    
    return pins
  }

  resetAll() {
    // توليد 20 بين عشوائي جديد
    this.dailyPins = this.generateRandomPins()
    this.usedPinsIndex = 0
    
  }

  async assignNextPin(clinicId) {
    this.checkDailyReset()

    // إذا لم يتم توليد البينات بعد، قم بتوليدها
    if (this.dailyPins.length === 0) {
      this.resetAll()
    }

    // إذا استخدمنا كل البينات، ابدأ من جديد
    if (this.usedPinsIndex >= this.dailyPins.length) {

      this.usedPinsIndex = 0
    }

    const pin = this.dailyPins[this.usedPinsIndex]
    this.usedPinsIndex++

    return {
      pin: pin,
      clinicId,
      issuedAt: new Date().toISOString(),
      expiresAt: this.getNextResetTime()
    }
  }

  async verifyPin(clinicId, pin) {
    // التحقق من أن البين موجود في قائمة البينات اليومية
    return this.dailyPins.includes(pin)
  }

  getNextResetTime() {
    const now = new Date()
    const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: settings.REGION }))
    const resetTime = settings.PIN_RESET_TIME.split(':')
    const resetHour = parseInt(resetTime[0])
    const resetMinute = parseInt(resetTime[1])

    const nextReset = new Date(qatarTime)
    nextReset.setHours(resetHour, resetMinute, 0, 0)

    // إذا كان وقت الإعادة قد مضى اليوم، اجعله غداً
    if (qatarTime >= nextReset) {
      nextReset.setDate(nextReset.getDate() + 1)
    }

    return nextReset.toISOString()
  }

  // الحصول على جميع البينات النشطة (لعرضها في لوحة الإدارة)
  getActivePins() {
    if (this.dailyPins.length === 0) {
      this.resetAll()
    }

    return this.dailyPins.map((pin, index) => ({
      pin,
      active: index < this.usedPinsIndex, // البينات المستخدمة
      available: index >= this.usedPinsIndex, // البينات المتاحة
      expiresAt: this.getNextResetTime()
    }))
  }

  // الحصول على البينات المتاحة فقط
  getAvailablePins() {
    if (this.dailyPins.length === 0) {
      this.resetAll()
    }

    return this.dailyPins.slice(this.usedPinsIndex).map(pin => ({
      pin,
      available: true,
      expiresAt: this.getNextResetTime()
    }))
  }

  deactivatePin(pin) {
    // لا حاجة لإلغاء تنشيط البين في النظام العشوائي
    // البينات تُستخدم بالترتيب العشوائي المحدد مسبقاً
    return true
  }
}

// Singleton instance
const pinEngine = new PinEngine()

export default pinEngine
export { PinEngine }

