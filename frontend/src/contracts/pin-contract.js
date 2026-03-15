/**
 * Canonical PIN Contract (Frontend)
 * @typedef {Object} PinContract
 * @property {number|string} id
 * @property {string} clinic_id
 * @property {string} pin
 * @property {string} created_at
 * @property {string} valid_until
 * @property {string|null} used_at
 */

export const PIN_CONTRACT_FIELDS = ['id', 'clinic_id', 'pin', 'created_at', 'valid_until', 'used_at'];
export const PIN_CONTRACT_SELECT = PIN_CONTRACT_FIELDS.join(', ');

export function isPinActive(pin) {
  return !!pin && !pin.used_at && (!pin.valid_until || new Date(pin.valid_until) > new Date());
}
