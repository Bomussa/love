export const FORBIDDEN_MESSAGES = {
  ar: '403 - غير مصرح لك بتنفيذ هذا الإجراء',
  en: '403 - You are not authorized to perform this action'
};

export const getForbiddenMessage = (language = 'ar') => (
  language === 'ar' ? FORBIDDEN_MESSAGES.ar : FORBIDDEN_MESSAGES.en
);

export const resolveAdminAccessScope = ({ session, canAccessClinicOnly = false } = {}) => {
  const assignedClinic = session?.assigned_clinic || null;
  const isClinicScoped = Boolean(canAccessClinicOnly && assignedClinic);

  return {
    isClinicScoped,
    assignedClinic,
    allowedClinicIds: isClinicScoped ? [assignedClinic] : [],
    canManageAllClinics: !isClinicScoped,
  };
};

export const filterClinicsByScope = (clinics = [], scope) => {
  if (!scope?.isClinicScoped) return clinics;
  return clinics.filter((clinic) => scope.allowedClinicIds.includes(clinic.id));
};

export const createSensitiveActionGuard = ({ scope, onDenied } = {}) => {
  return ({ requiresGlobalScope = false, clinicId } = {}) => {
    if (!scope) return false;

    if (requiresGlobalScope && !scope.canManageAllClinics) {
      onDenied?.();
      return false;
    }

    if (scope.isClinicScoped && clinicId && !scope.allowedClinicIds.includes(clinicId)) {
      onDenied?.();
      return false;
    }

    return true;
  };
};
