/**
 * Data validators and sanitizers
 * Ensures data integrity and prevents invalid states
 */

/**
 * Validate queue data structure
 */
export function validateQueue(queue) {
  if (!queue || typeof queue !== 'object') {
    console.warn('[Validators] Invalid queue object');
    return false;
  }

  // Check required fields
  const requiredFields = ['waiting', 'called', 'in', 'done'];
  const hasRequired = requiredFields.every(field => 
    typeof queue[field] === 'number' && queue[field] >= 0
  );

  if (!hasRequired) {
    console.warn('[Validators] Queue missing required numeric fields');
    return false;
  }

  return true;
}

/**
 * Validate patient data
 */
export function validatePatient(patient) {
  if (!patient || typeof patient !== 'object') {
    return false;
  }

  // Check required fields
  if (!patient.id && !patient.patientId) {
    console.warn('[Validators] Patient missing ID');
    return false;
  }

  return true;
}

/**
 * Validate clinic data
 */
export function validateClinic(clinic) {
  if (!clinic || typeof clinic !== 'object') {
    return false;
  }

  // Check required fields
  if (!clinic.id || !clinic.name) {
    console.warn('[Validators] Clinic missing required fields');
    return false;
  }

  // Validate numeric fields
  if (clinic.capacity && typeof clinic.capacity !== 'number') {
    console.warn('[Validators] Clinic capacity must be numeric');
    return false;
  }

  return true;
}

/**
 * Sanitize string input
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 500); // Limit length
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input, min = 0, max = Infinity) {
  const num = parseInt(input, 10);
  
  if (isNaN(num)) {
    return min;
  }

  return Math.max(min, Math.min(num, max));
}

/**
 * Sanitize PIN input
 */
export function sanitizePin(input) {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove non-numeric characters
  const cleaned = input.replace(/\D/g, '');
  
  // Limit to 6 digits
  return cleaned.substring(0, 6);
}

/**
 * Validate PIN format
 */
export function validatePin(pin) {
  if (typeof pin !== 'string') {
    return { valid: false, error: 'PIN must be a string' };
  }

  const trimmed = pin.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'PIN cannot be empty' };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: 'PIN must contain only digits' };
  }

  if (trimmed.length < 2 || trimmed.length > 6) {
    return { valid: false, error: 'PIN must be 2-6 digits' };
  }

  return { valid: true };
}

/**
 * Validate clinic ID
 */
export function validateClinicId(clinicId) {
  if (!clinicId) {
    return false;
  }

  const id = parseInt(clinicId, 10);
  return !isNaN(id) && id > 0;
}

/**
 * Validate patient ID
 */
export function validatePatientId(patientId) {
  if (!patientId) {
    return false;
  }

  // Accept both numeric and string IDs
  if (typeof patientId === 'number') {
    return patientId > 0;
  }

  if (typeof patientId === 'string') {
    return patientId.trim().length > 0;
  }

  return false;
}

/**
 * Validate status value
 */
export function validateStatus(status) {
  const validStatuses = ['waiting', 'called', 'in', 'done', 'no_show'];
  return validStatuses.includes(status);
}

/**
 * Sanitize object
 */
export function sanitizeObject(obj, schema = {}) {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (schema[key]) {
      const fieldSchema = schema[key];
      
      if (fieldSchema.type === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (fieldSchema.type === 'number') {
        sanitized[key] = sanitizeNumber(value, fieldSchema.min, fieldSchema.max);
      } else if (fieldSchema.type === 'pin') {
        sanitized[key] = sanitizePin(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Validate API response structure
 */
export function validateApiResponse(response) {
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'Invalid response format' };
  }

  // Check for success indicator
  if (response.success === false) {
    return { valid: false, error: response.error || 'API returned error' };
  }

  return { valid: true };
}

/**
 * Validate form data
 */
export function validateFormData(data, rules = {}) {
  const errors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    // Check required
    if (rule.required && !value) {
      errors[field] = `${field} is required`;
      continue;
    }

    // Check type
    if (value && rule.type && typeof value !== rule.type) {
      errors[field] = `${field} must be ${rule.type}`;
      continue;
    }

    // Check min length
    if (value && rule.minLength && value.length < rule.minLength) {
      errors[field] = `${field} must be at least ${rule.minLength} characters`;
      continue;
    }

    // Check max length
    if (value && rule.maxLength && value.length > rule.maxLength) {
      errors[field] = `${field} must be at most ${rule.maxLength} characters`;
      continue;
    }

    // Check pattern
    if (value && rule.pattern && !rule.pattern.test(value)) {
      errors[field] = `${field} has invalid format`;
      continue;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export default {
  validateQueue,
  validatePatient,
  validateClinic,
  sanitizeString,
  sanitizeNumber,
  sanitizePin,
  validatePin,
  validateClinicId,
  validatePatientId,
  validateStatus,
  sanitizeObject,
  validateApiResponse,
  validateFormData
};
