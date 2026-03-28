// lib/routingManager.js - مدير التوجيه الديناميكي مع الأوزان والسعة
import { apiClient } from "@/lib/api/client";
import { getSystemConfig } from './settings.js';

/**
 * نوع بيانات نقاط العيادة
 * @typedef {Object} ClinicScore
 * @property {number} id - معرف العيادة
 * @property {string} name - اسم العيادة
 * @property {number} loadRatio - نسبة الحمل (0-1)
 * @property {number} distributedToday - عدد المراجعين الموزعين اليوم
 * @property {number} capacity - السعة القصوى
 * @property {number} currentLoad - الحمل الحالي
 * @property {number} score - النقاط الإجمالية للترتيب
 */

/**
 * اختيار أفضل عيادة للخطوة التالية بناءً على الحمل والتوزيع
 * @param {string} examType - نوع الفحص
 * @param {string} gender - جنس المراجع
 * @param {number} currentStep - رقم الخطوة الحالية
 * @returns {Promise<number|null>} معرف العيادة المختارة أو null
 */
export async function pickClinicForNextStep(examType, gender, currentStep = 1) {
  try {
    // جلب العيادات المتاحة عبر API
    const clinics = await apiClient.get('clinics');
    
    if (!clinics || clinics.length === 0) {
      return null;
    }

    // تصفية العيادات المتاحة
    const availableClinics = clinics.filter(c => c.status === 'open');

    if (availableClinics.length === 0) {
      return null;
    }

    // حساب النقاط لكل عيادة
    const scoredClinics = availableClinics.map(clinic => {
      const capacity = clinic.capacity || 6;
      const currentLoad = clinic.currentLoad || 0;
      const distributedToday = clinic.distributedToday || 0;
      const efficiencyScore = clinic.efficiencyScore || 1.0;

      const loadRatio = currentLoad / capacity;

      // حساب النقاط (أقل نقاط = أفضل اختيار)
      let score = 0;
      
      // وزن الحمل الحالي (70% من النقاط)
      score += loadRatio * 0.7;
      
      // وزن التوزيع اليومي (20% من النقاط)
      const maxDistributed = Math.max(...availableClinics.map(c => c.distributedToday || 0), 1);
      score += (distributedToday / maxDistributed) * 0.2;
      
      // وزن الكفاءة (10% من النقاط - كفاءة أقل = نقاط أكثر)
      score += (1 - efficiencyScore) * 0.1;

      return {
        id: clinic.id,
        name: clinic.name,
        loadRatio,
        distributedToday,
        capacity,
        currentLoad,
        efficiencyScore,
        score,
        estimatedDuration: clinic.estimatedDuration
      };
    });

    // ترتيب العيادات حسب النقاط (الأقل أولاً)
    scoredClinics.sort((a, b) => {
      // أولوية للعيادات التي لم تصل للسعة القصوى
      if (a.currentLoad >= a.capacity && b.currentLoad < b.capacity) return 1;
      if (b.currentLoad >= b.capacity && a.currentLoad < a.capacity) return -1;
      
      // ثم حسب النقاط
      return a.score - b.score;
    });

    const selectedClinic = scoredClinics[0];
    
    console.debug('[RoutingManager] Selected clinic:', {
      id: selectedClinic.id,
      loadRatio: selectedClinic.loadRatio.toFixed(2),
      distributedToday: selectedClinic.distributedToday,
      score: selectedClinic.score.toFixed(3)
    });

    return selectedClinic.id;

  } catch (error) {
    console.error('Error picking clinic for next step:', error);
    return null;
  }
}

/**
 * تسجيل توزيع مراجع جديد على عيادة
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<boolean>} نجح التسجيل أم لا
 */
export async function markDistributed(clinicId) {
  try {
    // This would be called via API in production
    // For now, we track locally
    const distributed = JSON.parse(localStorage.getItem('clinic_distributed') || '{}');
    distributed[clinicId] = (distributed[clinicId] || 0) + 1;
    localStorage.setItem('clinic_distributed', JSON.stringify(distributed));
    
    return true;
  } catch (error) {
    console.error(`Error marking distributed for clinic ${clinicId}:`, error);
    return false;
  }
}

/**
 * جلب المسار الكامل لنوع فحص وجنس معين
 * @param {string} examType - نوع الفحص
 * @param {string} gender - جنس المراجع
 * @returns {Promise<Array>} مصفوفة خطوات المسار
 */
export async function getExamRoute(examType, gender) {
  try {
    // This would be fetched from API in production
    // For now, return empty array
    return [];
  } catch (error) {
    console.error(`Error getting exam route for ${examType}/${gender}:`, error);
    return [];
  }
}

/**
 * إنشاء مسار جديد لمراجع
 * @param {string} patientId - معرف المراجع
 * @param {string} examType - نوع الفحص
 * @param {string} gender - جنس المراجع
 * @returns {Promise<boolean>} نجح الإنشاء أم لا
 */
export async function createPatientRoute(patientId, examType, gender) {
  try {
    // جلب قالب المسار
    const routeTemplate = await getExamRoute(examType, gender);
    
    if (routeTemplate.length === 0) {
      throw new Error(`No route template found for ${examType}/${gender}`);
    }

    // Store route locally
    const routes = JSON.parse(localStorage.getItem('patient_routes') || '{}');
    routes[patientId] = {
      examType,
      gender,
      steps: routeTemplate,
      currentStep: 0,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('patient_routes', JSON.stringify(routes));

    return true;

  } catch (error) {
    console.error(`Error creating patient route for ${patientId}:`, error);
    return false;
  }
}

/**
 * الانتقال للخطوة التالية في المسار
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Object|null>} معلومات الخطوة التالية أو null
 */
export async function moveToNextStep(patientId) {
  try {
    const routes = JSON.parse(localStorage.getItem('patient_routes') || '{}');
    const route = routes[patientId];

    if (!route) {
      return null;
    }

    const currentStep = route.currentStep || 0;
    const nextStepIndex = currentStep + 1;

    if (nextStepIndex >= route.steps.length) {
      // انتهى المسار
      return { 
        completed: true, 
        message: 'تم إنهاء جميع الفحوصات المطلوبة' 
      };
    }

    const nextStep = route.steps[nextStepIndex];
    route.currentStep = nextStepIndex;
    routes[patientId] = route;
    localStorage.setItem('patient_routes', JSON.stringify(routes));

    return {
      completed: false,
      nextStep: {
        stepOrder: nextStep.stepOrder,
        clinicId: nextStep.clinicId,
        clinicName: nextStep.clinicName,
        floor: nextStep.floor
      }
    };

  } catch (error) {
    console.error(`Error moving to next step for patient ${patientId}:`, error);
    return null;
  }
}

/**
 * جلب حالة المسار الحالية للمراجع
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Object>} حالة المسار
 */
export async function getPatientRouteStatus(patientId) {
  try {
    const routes = JSON.parse(localStorage.getItem('patient_routes') || '{}');
    const route = routes[patientId];

    if (!route) {
      return null;
    }

    const currentStep = route.currentStep || 0;
    const steps = route.steps || [];

    return {
      examType: route.examType,
      gender: route.gender,
      currentStep: currentStep + 1,
      totalSteps: steps.length,
      steps: steps.map((step, idx) => ({
        ...step,
        status: idx < currentStep ? 'done' : idx === currentStep ? 'active' : 'pending'
      }))
    };

  } catch (error) {
    console.error(`Error getting patient route status for ${patientId}:`, error);
    return null;
  }
}

export default {
  pickClinicForNextStep,
  markDistributed,
  getExamRoute,
  createPatientRoute,
  moveToNextStep,
  getPatientRouteStatus
};
