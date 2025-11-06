// Database Validator - Verify data exists before operations
// Critical: All operations must validate data first

/**
 * Validate patient exists and has active path
 */
export async function validatePatient(env, patientId) {
  const pathKey = `path:${patientId}`;
  const path = await env.KV_ADMIN.get(pathKey, 'json');
  
  if (!path) {
    return {
      valid: false,
      error: 'المراجع غير مسجل في النظام',
      code: 'PATIENT_NOT_FOUND'
    };
  }
  
  if (!path.route || path.route.length === 0) {
    return {
      valid: false,
      error: 'مسار المراجع غير محدد',
      code: 'PATH_NOT_DEFINED'
    };
  }
  
  return {
    valid: true,
    path: path
  };
}

/**
 * Validate clinic exists in patient's path
 */
export async function validateClinicInPath(env, patientId, clinic) {
  const validation = await validatePatient(env, patientId);
  if (!validation.valid) {
    return validation;
  }
  
  const path = validation.path;
  
  if (!path.route.includes(clinic)) {
    return {
      valid: false,
      error: `العيادة ${clinic} غير موجودة في مسار المراجع`,
      code: 'CLINIC_NOT_IN_PATH',
      allowedClinics: path.route
    };
  }
  
  return {
    valid: true,
    path: path
  };
}

/**
 * Validate patient is in queue for specific clinic
 */
export async function validatePatientInQueue(env, patientId, clinic) {
  const userKey = `queue:user:${clinic}:${patientId}`;
  const userEntry = await env.KV_QUEUES.get(userKey, 'json');
  
  if (!userEntry) {
    return {
      valid: false,
      error: 'المراجع غير موجود في طابور هذه العيادة',
      code: 'NOT_IN_QUEUE'
    };
  }
  
  return {
    valid: true,
    entry: userEntry
  };
}

/**
 * Validate PIN for clinic
 */
export async function validateClinicPIN(env, clinic, pin) {
  const today = new Date().toISOString().split('T')[0];
  const pinsKey = `pins:daily:${today}`;
  const dailyPins = await env.KV_PINS.get(pinsKey, 'json');
  
  if (!dailyPins) {
    return {
      valid: false,
      error: 'أرقام PIN اليومية غير متوفرة',
      code: 'PINS_NOT_GENERATED'
    };
  }
  
  const clinicPinData = dailyPins[clinic];
  if (!clinicPinData) {
    return {
      valid: false,
      error: `رقم PIN غير متوفر للعيادة ${clinic}`,
      code: 'PIN_NOT_FOUND'
    };
  }
  
  const correctPin = typeof clinicPinData === 'object' ? clinicPinData.pin : clinicPinData;
  const normalizedInputPin = String(pin).trim();
  const normalizedCorrectPin = String(correctPin).trim();
  
  if (normalizedInputPin !== normalizedCorrectPin) {
    return {
      valid: false,
      error: 'رقم PIN غير صحيح',
      code: 'INCORRECT_PIN'
    };
  }
  
  // Verify PIN doesn't belong to another clinic
  for (const [otherClinic, otherPinData] of Object.entries(dailyPins)) {
    if (otherClinic !== clinic) {
      const otherPin = typeof otherPinData === 'object' ? otherPinData.pin : otherPinData;
      if (String(otherPin).trim() === normalizedInputPin) {
        return {
          valid: false,
          error: `رقم PIN هذا يخص عيادة ${otherClinic} وليس ${clinic}`,
          code: 'WRONG_CLINIC_PIN',
          correctClinic: otherClinic
        };
      }
    }
  }
  
  return {
    valid: true,
    pin: correctPin
  };
}

/**
 * Validate queue number matches
 */
export async function validateQueueNumber(env, patientId, clinic, queueNumber) {
  const validation = await validatePatientInQueue(env, patientId, clinic);
  if (!validation.valid) {
    return validation;
  }
  
  const userEntry = validation.entry;
  const expectedNumber = userEntry.number;
  const providedNumber = parseInt(queueNumber);
  
  if (expectedNumber !== providedNumber) {
    return {
      valid: false,
      error: 'رقم الطابور غير صحيح',
      code: 'INCORRECT_QUEUE_NUMBER',
      expected: expectedNumber,
      provided: providedNumber
    };
  }
  
  return {
    valid: true,
    entry: userEntry
  };
}

/**
 * Validate patient can enter clinic (is it next in path?)
 */
export async function validateCanEnterClinic(env, patientId, clinic) {
  const validation = await validateClinicInPath(env, patientId, clinic);
  if (!validation.valid) {
    return validation;
  }
  
  const path = validation.path;
  const currentIndex = path.current_index || 0;
  const expectedClinic = path.route[currentIndex];
  
  if (clinic !== expectedClinic) {
    return {
      valid: false,
      error: `يجب إكمال ${expectedClinic} أولاً قبل الانتقال إلى ${clinic}`,
      code: 'WRONG_SEQUENCE',
      expectedClinic: expectedClinic,
      currentIndex: currentIndex
    };
  }
  
  // Check if previous clinic was completed
  if (currentIndex > 0) {
    const previousClinic = path.route[currentIndex - 1];
    const previousCompleted = path.progress?.some(
      p => p.clinic === previousClinic && p.pin_verified
    );
    
    if (!previousCompleted) {
      return {
        valid: false,
        error: `يجب إكمال ${previousClinic} والتحقق من PIN أولاً`,
        code: 'PREVIOUS_NOT_COMPLETED',
        previousClinic: previousClinic
      };
    }
  }
  
  return {
    valid: true,
    path: path
  };
}

/**
 * Complete validation for verify-pin operation
 */
export async function validateVerifyPIN(env, patientId, clinic, pin, queueNumber) {
  // 1. Validate patient exists
  const patientValidation = await validatePatient(env, patientId);
  if (!patientValidation.valid) {
    return patientValidation;
  }
  
  // 2. Validate clinic in path
  const clinicValidation = await validateClinicInPath(env, patientId, clinic);
  if (!clinicValidation.valid) {
    return clinicValidation;
  }
  
  // 3. Validate patient in queue
  const queueValidation = await validatePatientInQueue(env, patientId, clinic);
  if (!queueValidation.valid) {
    return queueValidation;
  }
  
  // 4. Validate queue number
  const numberValidation = await validateQueueNumber(env, patientId, clinic, queueNumber);
  if (!numberValidation.valid) {
    return numberValidation;
  }
  
  // 5. Validate PIN
  const pinValidation = await validateClinicPIN(env, clinic, pin);
  if (!pinValidation.valid) {
    return pinValidation;
  }
  
  return {
    valid: true,
    path: patientValidation.path,
    entry: queueValidation.entry,
    pin: pinValidation.pin
  };
}

/**
 * Complete validation for queue enter operation
 */
export async function validateQueueEnter(env, patientId, clinic) {
  // 1. Validate patient exists
  const patientValidation = await validatePatient(env, patientId);
  if (!patientValidation.valid) {
    return patientValidation;
  }
  
  // 2. Validate can enter this clinic
  const enterValidation = await validateCanEnterClinic(env, patientId, clinic);
  if (!enterValidation.valid) {
    return enterValidation;
  }
  
  return {
    valid: true,
    path: patientValidation.path
  };
}

