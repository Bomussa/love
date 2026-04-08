
-- Fix enter_unified_queue_safe function to avoid aggregate error with FOR UPDATE
CREATE OR REPLACE FUNCTION public.enter_unified_queue_safe(
    p_clinic_id TEXT,
    p_patient_id UUID,
    p_patient_name TEXT DEFAULT NULL,
    p_exam_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_last_number INTEGER;
    v_new_number INTEGER;
    v_existing_id UUID;
    v_existing_number INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Check if patient already in queue for this clinic today
    SELECT id, display_number INTO v_existing_id, v_existing_number
    FROM public.unified_queue
    WHERE clinic_id = p_clinic_id
      AND patient_id = p_patient_id
      AND queue_date = v_today
      AND status IN ('waiting', 'called', 'serving')
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'id', v_existing_id,
            'display_number', v_existing_number,
            'status', 'waiting',
            'already_exists', true
        );
    END IF;

    -- 2. Lock the table/rows for this clinic to get next number safely
    -- We use a separate counter table or a lock on the last entry
    -- For simplicity and safety, we'll get the max number without aggregate in FOR UPDATE
    
    SELECT display_number INTO v_last_number
    FROM public.unified_queue
    WHERE clinic_id = p_clinic_id
      AND queue_date = v_today
    ORDER BY display_number DESC
    LIMIT 1
    FOR UPDATE;

    v_new_number := COALESCE(v_last_number, 0) + 1;

    -- 3. Insert new entry
    INSERT INTO public.unified_queue (
        clinic_id,
        patient_id,
        patient_name,
        exam_type,
        display_number,
        status,
        queue_date,
        entered_at
    )
    VALUES (
        p_clinic_id,
        p_patient_id,
        p_patient_name,
        p_exam_type,
        v_new_number,
        'waiting',
        v_today,
        NOW()
    )
    RETURNING id INTO v_existing_id;

    RETURN jsonb_build_object(
        'id', v_existing_id,
        'display_number', v_new_number,
        'status', 'waiting',
        'already_exists', false
    );
END;
$$;
