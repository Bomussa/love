export const generatePinCode = (length = 6) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(Math.floor(min + Math.random() * (max - min)));
};

export const getEndOfDayISO = () => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return end.toISOString();
};

export const getTodayDate = () => new Date().toISOString().split('T')[0];

export const findLatestValidPin = async (db, clinicId, pin = null) => {
  let query = db
    .from('pins')
    .select('id, clinic_id, pin, valid_until, used_at, created_at')
    .eq('clinic_id', clinicId)
    .gt('valid_until', new Date().toISOString());

  if (pin) query = query.eq('pin', pin);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
};

export const generateDailyPin = async (db, clinicId) => {
  const existingPin = await findLatestValidPin(db, clinicId);
  const today = getTodayDate();

  if (existingPin && new Date(existingPin.created_at).toISOString().split('T')[0] === today) {
    return { pinRecord: existingPin, isExisting: true };
  }

  const { data, error } = await db
    .from('pins')
    .insert({
      clinic_id: clinicId,
      pin: generatePinCode(6),
      valid_until: getEndOfDayISO(),
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;

  // Legacy cache sync only: pins table remains the source of truth.
  await db
    .from('clinics')
    .update({ pin_code: data.pin })
    .eq('id', clinicId);

  return { pinRecord: data, isExisting: false };
};

export const verifyPin = async (db, clinicId, pin) => {
  const pinRecord = await findLatestValidPin(db, clinicId, pin);
  if (!pinRecord) {
    return { valid: false, pinRecord: null };
  }

  const now = new Date().toISOString();

  if (!pinRecord.used_at) {
    const { error: updateError } = await db
      .from('pins')
      .update({ used_at: now })
      .eq('id', pinRecord.id);

    if (updateError) throw updateError;

    pinRecord.used_at = now;
  }

  return { valid: true, pinRecord };
};

export const getPinStatus = async (db, clinicId) => {
  const pinRecord = await findLatestValidPin(db, clinicId);

  if (!pinRecord) {
    return { hasActivePin: false, pinRecord: null };
  }

  return { hasActivePin: true, pinRecord };
};

export const assertPinValidForQueueAction = async (db, clinicId, pin) => {
  const pinRecord = await findLatestValidPin(db, clinicId, pin);
  return !!pinRecord;
};
