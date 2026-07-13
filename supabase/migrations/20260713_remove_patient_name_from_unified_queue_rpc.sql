-- Remove the legacy patient-name argument from the patient queue RPC contract.
--
-- The patient-facing React components now call enter_unified_queue_safe with only
-- non-name patient identifiers and operational fields:
--   p_clinic_id, p_patient_id, p_exam_type, p_gender,
--   p_military_id, p_personal_id, and p_force.
--
-- If an older database still has the overload that accepts p_patient_name between
-- p_patient_id and p_exam_type, drop that overload before deploying the frontend.
-- The active no-name overload must be provided by the backend/love-api migration
-- that owns the enter_unified_queue_safe implementation.
DROP FUNCTION IF EXISTS public.enter_unified_queue_safe(
  TEXT, -- p_clinic_id
  TEXT, -- p_patient_id
  TEXT, -- p_patient_name (legacy, removed)
  TEXT, -- p_exam_type
  TEXT, -- p_gender
  TEXT, -- p_military_id
  TEXT, -- p_personal_id
  BOOLEAN -- p_force
);
