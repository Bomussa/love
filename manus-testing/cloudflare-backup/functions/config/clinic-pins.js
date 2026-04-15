// Clinic PIN Configuration - Static PINs for each clinic
// Each clinic has a fixed PIN that doesn't change during the day

export const CLINIC_PINS = {
  // Main pathway clinics
  lab: "01",
  vitals: "02",
  xray: "03",
  eyes: "04",
  internal: "05",
  surgery: "06",
  bones: "07",
  ent: "08",
  
  // Special clinics
  women: "10",  // Third floor - women only
  psychiatry: "11",
  derma: "12",
  
  // Additional clinics
  dental: "13",
  cardiology: "14",
  neurology: "15"
};

// Clinic display names in Arabic
export const CLINIC_NAMES = {
  lab: "المختبر",
  vitals: "القياسات الحيوية",
  xray: "الأشعة",
  eyes: "عيادة العيون",
  internal: "عيادة الباطنية",
  surgery: "عيادة الجراحة العامة",
  bones: "عيادة العظام والمفاصل",
  ent: "عيادة أنف وأذن وحنجرة",
  women: "عيادة النساء",
  psychiatry: "عيادة النفسية",
  derma: "عيادة الجلدية",
  dental: "عيادة الأسنان",
  cardiology: "عيادة القلب",
  neurology: "عيادة الأعصاب"
};

// Get PIN for a clinic
export function getClinicPin(clinicId) {
  return CLINIC_PINS[clinicId] || null;
}

// Get clinic name
export function getClinicName(clinicId) {
  return CLINIC_NAMES[clinicId] || clinicId;
}

// Validate PIN
export function isValidPin(pin) {
  return Object.values(CLINIC_PINS).includes(pin);
}

// Get clinic ID from PIN
export function getClinicFromPin(pin) {
  return Object.keys(CLINIC_PINS).find(key => CLINIC_PINS[key] === pin) || null;
}

