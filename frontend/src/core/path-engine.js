// محرك المسارات الديناميكية (Path Engine) - النظام الرسمي
import settings from '../../data/settings.json'

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

class PathEngine {
  constructor() {
    this.patientPaths = new Map() // patientId -> { examType, currentStep, path, history }
  }

  // توليد مسار ديناميكي عشوائي
  generateDynamicPath(examType) {
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
      
      // خلط العيادات بشكل عشوائي (Fisher-Yates shuffle)
      for (let i = middleClinics.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [middleClinics[i], middleClinics[j]] = [middleClinics[j], middleClinics[i]]
      }
      
      // إعادة بناء المسار
      const newPath = [
        ...path.slice(0, startIndex),
        ...middleClinics,
        ...path.slice(endIndex)
      ]
      
      return newPath
    }
    
    return path
  }

  getPathForExam(examType) {
    // توليد مسار ديناميكي جديد لكل مريض
    return this.generateDynamicPath(examType)
  }

  async initializePatientPath(patientId, examType) {
    const path = this.getPathForExam(examType)
    
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
    return patientPath
  }

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
      return null // انتهى المسار
    }

    const nextClinicId = patientPath.path[patientPath.currentStep]
    
    return {
      clinicId: nextClinicId,
      name: CLINIC_NAMES[nextClinicId],
      step: patientPath.currentStep + 1,
      totalSteps: patientPath.path.length,
      isLast: patientPath.currentStep === patientPath.path.length - 1
    }
  }

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
const pathEngine = new PathEngine()

export default pathEngine
export { PathEngine, CLINIC_NAMES, BASE_EXAM_PATHS as EXAM_PATHS }

