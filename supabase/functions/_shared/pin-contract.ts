export type PinContract = {
  id: number;
  clinic_id: string;
  pin: string;
  created_at: string;
  valid_until: string;
  used_at: string | null;
};

export const PIN_CONTRACT_FIELDS = [
  'id',
  'clinic_id',
  'pin',
  'created_at',
  'valid_until',
  'used_at',
] as const;

export const PIN_CONTRACT_SELECT = PIN_CONTRACT_FIELDS.join(', ');

export const isPinActive = (pin: PinContract | null | undefined, nowIso = new Date().toISOString()) => {
  if (!pin) return false;
  if (pin.used_at) return false;
  return new Date(pin.valid_until).getTime() > new Date(nowIso).getTime();
};
