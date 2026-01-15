// محرك المسارات الديناميكية (Path Engine) - النسخة المحدثة مع حساب الأوزان
import settings from '../../data/settings.json'
import supabaseApi from '../lib/supabase-api.js'

// المسارات الأساسية حسب النوع
const BASE_EXAM_PATHS = {
  'recruitment': ['lab', 'vitals', 'dental', 'eye', 'ent', 'surgery', 'internal', 'final'],
  'promotion': ['lab', 'vitals', 'internal', 'final'],
  'transfer': ['lab', 'vitals', 'surgery', 'final'],
  'referral': ['lab', 'vitals', 'specialist', 'final'],
  'contract': ['lab', 'vitals', 'internal', 'final'],
  'aviation': ['lab', 'vitals', 'eye', 'ent', 'internal', 'aviation', 'final'],
  'cooks': ['lab', 'vitals', 'dental', 'internal', 'final'],
  'courses': ['lab', 'vitals', 'internal', 'final']
}

// أسماء العيادات
const CLINIC_NAMES = {
  'lab': 'المختبر والأشعة',
  'vitals': 'القياسات الحيوية',
  'dental': 'الأسنان',
  'eye': 'العيون',
  'ent': 'الأنف والأذن والحنجرة',
  'surgery': 'الجراحة',
  'internal': 'الباطنية',
  'aviation': 'الطيران',
  'specialist': 'التخصصي',
  'final': 'اللجنة النهائية'
}

class PathEngineV2 {
  constructor() {
    this.patientPaths = new Map() // patientId -> { examType, currentStep, path, history }
    console.log('[PathEngineV2] Initialized with weight-based routing')
  }

  /**
   * Generate dynamic path with weight-based clinic ordering
   * @param {string} examType - Type of examination
   * @returns {Promise<Array<string>>} Ordered clinic path
   */
  async generateDynamicPath(examType) {
    const basePath = BASE_EXAM_PATHS[examType]
    if (!basePath) {
      throw new Error(`Unknown exam type: ${examType}`)
    }

    // نسخ المسار الأساسي
    const path = [...basePath]
    
    // العيادات الثابتة (لا يتم تبديلها)
    const fixedClinics = ['lab', 'vitals', 'final']
    
    // العيادات القابلة للتبديل (العيادات بين vitals و final)
    const startIndex = path.indexOf('vitals') + 1
    const endIndex = path.indexOf('final')
    
    if (startIndex < endIndex && settings.ALLOW_DYNAMIC_ROUTES) {
      // استخراج العيادات القابلة للتبديل
      const middleClinics = path.slice(startIndex, endIndex)
      
      try {
        // حساب الأوزان بناءً على الازدحام
        const weights = await supabaseApi.calculateClinicWeights(middleClinics)
        
        // إعادة ترتيب العيادات حسب الأوزان (الأقل ازدحاماً أولاً)
        const sortedClinics = weights.map(w => w.clinicId)
        
        console.log('[PathEngineV2] Clinic weights:', weights)
        console.log('[PathEngineV2] Sorted clinics:', sortedClinics)
        
        // إعادة بناء المسار
        const newPath = [
          ...path.slice(0, startIndex),
          ...sortedClinics,
          ...path.slice(endIndex)
        ]
        
        return newPath
      } catch (error) {
        console.error('[PathEngineV2] Error calculating weights, falling back to random:', error)
        
        // Fallback: خلط عشوائي في حالة الفشل
        for (let i = middleClinics.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [middleClinics[i], middleClinics[j]] = [middleClinics[j], middleClinics[i]]
        }
        
        const newPath = [
          ...path.slice(0, startIndex),
          ...middleClinics,
          ...path.slice(endIndex)
        ]
        
        return newPath
      }
    }
    
    return path
  }

  /**
   * Get path for exam type
   * @param {string} examType - Type of examination
   * @returns {Promise<Array<string>>} Clinic path
   */
  async getPathForExam(examType) {
    // توليد مسار ديناميكي جديد لكل مريض
    return await this.generateDynamicPath(examType)
  }

  /**
   * Initialize patient path
   * @param {string} patientId - Patient ID
   * @param {string} examType - Type of examination
   * @returns {Promise<Object>} Patient path object
   */
  async initializePatientPath(patientId, examType) {
    const path = await this.getPathForExam(examType)
    
    const patientPath = {
      patientId,
      examType,
      currentStep: 0,
      path,
      history: [],
      startedAt: new Date().toISOString(),
      status: 'active'
    }

    this.patientPaths.set(patientId, patientPath)
    
    console.log(`[PathEngineV2] Initialized path for patient ${patientId}:`, path)
    
    return patientPath
  }

  /**
   * Advance to next clinic
   * @param {string} patientId - Patient ID
   * @param {string} currentClinicId - Current clinic ID
   * @param {string} status - Completion status
   * @returns {Promise<Object|null>} Next clinic info or null if completed
   */
  async advanceToNextClinic(patientId, currentClinicId, status = 'completed') {
    const patientPath = this.patientPaths.get(patientId)
    
    if (!patientPath) {
      throw new Error('Patient path not found')
    }

    // تسجيل العيادة الحالية في التاريخ
    patientPath.history.push({
      clinicId: currentClinicId,
      status,
      completedAt: new Date().toISOString()
    })

    // الانتقال للخطوة التالية
    patientPath.currentStep++

    // التحقق من الانتهاء
    if (patientPath.currentStep >= patientPath.path.length) {
      patientPath.status = 'completed'
      patientPath.completedAt = new Date().toISOString()
      console.log(`[PathEngineV2] Patient ${patientId} completed all clinics`)
      return null // انتهى المسار
    }

    const nextClinicId = patientPath.path[patientPath.currentStep]
    
    const nextClinic = {
      clinicId: nextClinicId,
      name: CLINIC_NAMES[nextClinicId],
      step: patientPath.currentStep + 1,
      totalSteps: patientPath.path.length,
      isLast: patientPath.currentStep === patientPath.path.length - 1
    }
    
    console.log(`[PathEngineV2] Patient ${patientId} advancing to ${nextClinicId}`)
    
    return nextClinic
  }

  /**
   * Get current clinic
   * @param {string} patientId - Patient ID
   * @returns {Object|null} Current clinic info or null
   */
  getCurrentClinic(patientId) {
    const patientPath = this.patientPaths.get(patientId)
    
    if (!patientPath || patientPath.status === 'completed') {
      return null
    }

    const clinicId = patientPath.path[patientPath.currentStep]
    
    return {
      clinicId,
      name: CLINIC_NAMES[clinicId],
      step: patientPath.currentStep + 1,
      totalSteps: patientPath.path.length
    }
  }

  /**
   * Get full path
   * @param {string} patientId - Patient ID
   * @returns {Object|null} Full path info or null
   */
  getFullPath(patientId) {
    const patientPath = this.patientPaths.get(patientId)
    
    if (!patientPath) {
      return null
    }

    return {
      examType: patientPath.examType,
      currentStep: patientPath.currentStep,
      path: patientPath.path.map((clinicId, index) => ({
        clinicId,
        name: CLINIC_NAMES[clinicId],
        step: index + 1,
        status: index < patientPath.currentStep ? 'completed' : 
                index === patientPath.currentStep ? 'current' : 'pending',
        completed: patientPath.history.find(h => h.clinicId === clinicId)
      })),
      status: patientPath.status,
      startedAt: patientPath.startedAt,
      completedAt: patientPath.completedAt
    }
  }

  /**
   * Get next clinics
   * @param {string} patientId - Patient ID
   * @param {number} count - Number of next clinics to return
   * @returns {Array} Next clinics
   */
  getNextClinics(patientId, count = 3) {
    const patientPath = this.patientPaths.get(patientId)
    
    if (!patientPath || patientPath.status === 'completed') {
      return []
    }

    const nextClinics = []
    for (let i = patientPath.currentStep; i < Math.min(patientPath.currentStep + count, patientPath.path.length); i++) {
      const clinicId = patientPath.path[i]
      nextClinics.push({
        clinicId,
        name: CLINIC_NAMES[clinicId],
        step: i + 1,
        isCurrent: i === patientPath.currentStep
      })
    }

    return nextClinics
  }

  /**
   * Check if clinic is accessible
   * @param {string} patientId - Patient ID
   * @param {string} clinicId - Clinic ID to check
   * @returns {boolean} True if accessible
   */
  isClinicAccessible(patientId, clinicId) {
    const patientPath = this.patientPaths.get(patientId)
    
    if (!patientPath) {
      return false
    }

    const currentClinic = patientPath.path[patientPath.currentStep]
    return currentClinic === clinicId
  }
}

// Singleton instance
const pathEngineV2 = new PathEngineV2()

export default pathEngineV2
export { PathEngineV2, CLINIC_NAMES, BASE_EXAM_PATHS as EXAM_PATHS }
