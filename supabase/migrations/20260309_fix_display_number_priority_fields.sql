-- Ensure display_number is numeric and add priority metadata fields.
-- Also sanitize legacy rows where display_number was stored as text.

ALTER TABLE IF EXISTS public.queues
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_label TEXT;

ALTER TABLE IF EXISTS public.unified_queue
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_label TEXT;

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type
  INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'unified_queue'
    AND column_name = 'display_number';

  IF col_type IN ('character varying', 'text') THEN
    EXECUTE $migration$
      WITH normalized AS (
        SELECT
          id,
          clinic_id,
          entered_at,
          CASE
            WHEN trim(display_number) ~ '^[0-9]+$' THEN trim(display_number)::integer
            ELSE NULL
          END AS numeric_display,
          row_number() OVER (
            PARTITION BY clinic_id
            ORDER BY entered_at, id
          ) AS clinic_seq
        FROM public.unified_queue
      ),
      fallback AS (
        SELECT
          id,
          COALESCE(
            numeric_display,
            COALESCE(max(numeric_display) OVER (PARTITION BY clinic_id), 0) + clinic_seq
          ) AS cleaned_display
        FROM normalized
      )
      UPDATE public.unified_queue q
      SET display_number = fallback.cleaned_display::text
      FROM fallback
      WHERE q.id = fallback.id;
    $migration$;

    ALTER TABLE public.unified_queue
      ALTER COLUMN display_number TYPE INTEGER
      USING NULLIF(regexp_replace(display_number::text, '[^0-9]', '', 'g'), '')::INTEGER;
  END IF;
END $$;
