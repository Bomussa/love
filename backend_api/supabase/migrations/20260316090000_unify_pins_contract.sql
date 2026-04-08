-- Unify public.pins contract to: clinic_id, pin, valid_until, used_at, created_at

ALTER TABLE public.pins
  ADD COLUMN IF NOT EXISTS clinic_id TEXT,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pins' AND column_name = 'clinic_code'
  ) THEN
    EXECUTE 'UPDATE public.pins SET clinic_id = COALESCE(clinic_id, clinic_code) WHERE clinic_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pins' AND column_name = 'clinic'
  ) THEN
    EXECUTE 'UPDATE public.pins SET clinic_id = COALESCE(clinic_id, clinic) WHERE clinic_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pins' AND column_name = 'expires_at'
  ) THEN
    EXECUTE 'UPDATE public.pins SET valid_until = COALESCE(valid_until, expires_at) WHERE valid_until IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pins' AND column_name = 'is_active'
  ) THEN
    EXECUTE $$
      UPDATE public.pins
      SET used_at = COALESCE(used_at, CASE WHEN is_active = false THEN COALESCE(valid_until, now()) ELSE NULL END)
      WHERE used_at IS NULL
    $$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pins' AND column_name = 'date'
  ) THEN
    EXECUTE $$
      UPDATE public.pins
      SET valid_until = COALESCE(valid_until, (date::timestamptz + interval '1 day - 1 millisecond'))
      WHERE valid_until IS NULL
    $$;
  END IF;
END $$;

UPDATE public.pins
SET created_at = COALESCE(created_at, NOW())
WHERE created_at IS NULL;

UPDATE public.pins
SET valid_until = COALESCE(valid_until, created_at + INTERVAL '1 day')
WHERE valid_until IS NULL;

ALTER TABLE public.pins
  ALTER COLUMN clinic_id SET NOT NULL,
  ALTER COLUMN pin SET NOT NULL,
  ALTER COLUMN valid_until SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pins_contract_lookup
  ON public.pins (clinic_id, pin, valid_until DESC);

CREATE INDEX IF NOT EXISTS idx_pins_contract_active
  ON public.pins (clinic_id, valid_until DESC)
  WHERE used_at IS NULL;

COMMENT ON COLUMN public.pins.clinic_id IS 'Canonical column for clinic reference (source of truth).';
COMMENT ON COLUMN public.pins.valid_until IS 'Canonical expiration timestamp for PIN validity.';
COMMENT ON COLUMN public.pins.used_at IS 'When PIN was verified/consumed; nullable.';
COMMENT ON TABLE public.pins IS 'Source of truth for PIN workflow across generation, verification, and queue calls.';

-- One-way cache sync: keep clinics.pin_code aligned to latest active pin while
-- keeping public.pins as the canonical source of truth.
CREATE OR REPLACE FUNCTION public.sync_clinic_pin_cache_from_pins()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.clinics
  SET pin_code = NEW.pin
  WHERE id = NEW.clinic_id
    AND (
      pin_code IS DISTINCT FROM NEW.pin
      OR pin_code IS NULL
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_clinic_pin_cache_from_pins ON public.pins;
CREATE TRIGGER trg_sync_clinic_pin_cache_from_pins
AFTER INSERT OR UPDATE OF pin, valid_until, used_at ON public.pins
FOR EACH ROW
EXECUTE FUNCTION public.sync_clinic_pin_cache_from_pins();

UPDATE public.clinics c
SET pin_code = p.pin
FROM (
  SELECT DISTINCT ON (clinic_id) clinic_id, pin
  FROM public.pins
  WHERE valid_until > NOW()
  ORDER BY clinic_id, valid_until DESC, created_at DESC
) p
WHERE c.id = p.clinic_id
  AND c.pin_code IS DISTINCT FROM p.pin;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pins' AND column_name = 'clinic_code'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.pins.clinic_code IS ''LEGACY: compatibility-only; scheduled for removal after transition.''';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pins' AND column_name = 'expires_at'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.pins.expires_at IS ''LEGACY: compatibility-only; use valid_until.''';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pins' AND column_name = 'is_active'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.pins.is_active IS ''LEGACY: compatibility-only; derive status from used_at + valid_until.''';
  END IF;
END $$;
