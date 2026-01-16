/**
 * حساب نسبة الإنجاز بالأوزان
 * Weight-based Completion Calculator
 * 
 * هذا الملف يحتوي على دوال حساب نسبة الإنجاز بناءً على أوزان العيادات
 * بدلاً من عدد العيادات الثابت
 */

/**
 * حساب الوزن الإجمالي لجميع العيادات
 * @param {Array} stations - قائمة العيادات مع أوزانها
 * @returns {number} - الوزن الإجمالي
 */
export function calculateTotalWeight(stations) {
  if (!stations || !Array.isArray(stations) || stations.length === 0) {
    return 0;
  }
  
  return stations.reduce((total, station) => {
    const weight = parseFloat(station.weight) || 1; // الوزن الافتراضي = 1
    return total + weight;
  }, 0);
}

/**
 * حساب الوزن المكتمل (العيادات التي أكملها المريض)
 * @param {Array} stations - قائمة العيادات مع أوزانها
 * @param {number} currentStationIndex - فهرس العيادة الحالية
 * @returns {number} - الوزن المكتمل
 */
export function calculateCompletedWeight(stations, currentStationIndex) {
  if (!stations || !Array.isArray(stations) || stations.length === 0) {
    return 0;
  }
  
  // العيادات المكتملة هي من 0 إلى (currentStationIndex - 1)
  const completedStations = stations.slice(0, currentStationIndex);
  
  return completedStations.reduce((total, station) => {
    const weight = parseFloat(station.weight) || 1;
    return total + weight;
  }, 0);
}

/**
 * حساب نسبة الإنجاز بالأوزان
 * @param {Array} stations - قائمة العيادات مع أوزانها
 * @param {number} currentStationIndex - فهرس العيادة الحالية
 * @returns {number} - نسبة الإنجاز (0-100)
 */
export function calculateWeightedCompletionRate(stations, currentStationIndex) {
  const totalWeight = calculateTotalWeight(stations);
  
  if (totalWeight === 0) {
    return 0;
  }
  
  const completedWeight = calculateCompletedWeight(stations, currentStationIndex);
  const rate = (completedWeight / totalWeight) * 100;
  
  return Math.round(rate * 100) / 100; // تقريب إلى منزلتين عشريتين
}

/**
 * حساب نسبة الإنجاز بناءً على حالة العيادات (completed/in-progress/locked)
 * @param {Array} stations - قائمة العيادات مع حالاتها وأوزانها
 * @returns {number} - نسبة الإنجاز (0-100)
 */
export function calculateCompletionByStatus(stations) {
  if (!stations || !Array.isArray(stations) || stations.length === 0) {
    return 0;
  }
  
  const totalWeight = calculateTotalWeight(stations);
  
  if (totalWeight === 0) {
    return 0;
  }
  
  const completedWeight = stations.reduce((total, station) => {
    // العيادة مكتملة إذا كانت حالتها completed أو done
    if (station.status === 'completed' || station.status === 'done' || station.completed === true) {
      const weight = parseFloat(station.weight) || 1;
      return total + weight;
    }
    return total;
  }, 0);
  
  const rate = (completedWeight / totalWeight) * 100;
  return Math.round(rate * 100) / 100;
}

/**
 * حساب نسبة الإنجاز لمريض واحد من بيانات patient_routes
 * @param {Object} patientRoute - بيانات مسار المريض من قاعدة البيانات
 * @returns {number} - نسبة الإنجاز (0-100)
 */
export function calculatePatientCompletionRate(patientRoute) {
  if (!patientRoute || !patientRoute.stations) {
    return 0;
  }
  
  const stations = typeof patientRoute.stations === 'string' 
    ? JSON.parse(patientRoute.stations) 
    : patientRoute.stations;
  
  const currentIndex = patientRoute.current_station_index || 0;
  
  return calculateWeightedCompletionRate(stations, currentIndex);
}

/**
 * حساب متوسط نسبة الإنجاز لمجموعة من المرضى
 * @param {Array} patientRoutes - قائمة مسارات المرضى
 * @returns {number} - متوسط نسبة الإنجاز (0-100)
 */
export function calculateAverageCompletionRate(patientRoutes) {
  if (!patientRoutes || !Array.isArray(patientRoutes) || patientRoutes.length === 0) {
    return 0;
  }
  
  const totalRate = patientRoutes.reduce((sum, route) => {
    return sum + calculatePatientCompletionRate(route);
  }, 0);
  
  return Math.round((totalRate / patientRoutes.length) * 100) / 100;
}

/**
 * الحصول على معلومات تفصيلية عن تقدم المريض
 * @param {Array} stations - قائمة العيادات
 * @param {number} currentStationIndex - فهرس العيادة الحالية
 * @returns {Object} - معلومات تفصيلية
 */
export function getProgressDetails(stations, currentStationIndex) {
  if (!stations || !Array.isArray(stations)) {
    return {
      totalStations: 0,
      completedStations: 0,
      remainingStations: 0,
      totalWeight: 0,
      completedWeight: 0,
      remainingWeight: 0,
      completionRate: 0
    };
  }
  
  const totalWeight = calculateTotalWeight(stations);
  const completedWeight = calculateCompletedWeight(stations, currentStationIndex);
  const remainingWeight = totalWeight - completedWeight;
  
  return {
    totalStations: stations.length,
    completedStations: currentStationIndex,
    remainingStations: stations.length - currentStationIndex,
    totalWeight,
    completedWeight,
    remainingWeight,
    completionRate: calculateWeightedCompletionRate(stations, currentStationIndex)
  };
}

export default {
  calculateTotalWeight,
  calculateCompletedWeight,
  calculateWeightedCompletionRate,
  calculateCompletionByStatus,
  calculatePatientCompletionRate,
  calculateAverageCompletionRate,
  getProgressDetails
};
