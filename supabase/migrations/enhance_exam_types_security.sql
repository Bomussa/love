-- Enhancement Script for exam_types table
-- This script adds security policies, triggers, and indexes for better performance and security

-- ============================================
-- 1. Update RLS Policies for Better Security
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read" ON public.exam_types;
DROP POLICY IF EXISTS "Allow public insert" ON public.exam_types;
DROP POLICY IF EXISTS "Allow public update" ON public.exam_types;

-- Allow authenticated users to read exam types
CREATE POLICY "Allow authenticated read" ON public.exam_types
  FOR SELECT 
  TO authenticated
  USING (true);

-- Allow public (anonymous) users to read exam types (for login page)
CREATE POLICY "Allow anon read" ON public.exam_types
  FOR SELECT 
  TO anon
  USING (true);

-- Allow service_role to insert/update/delete (for admin operations)
CREATE POLICY "Allow service_role all" ON public.exam_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. Create or Replace update_updated_at Function
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Add Trigger to Auto-Update updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_exam_types_updated_at ON public.exam_types;

CREATE TRIGGER update_exam_types_updated_at
  BEFORE UPDATE ON public.exam_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. Create Indexes for Performance
-- ============================================

-- Index for filtering by is_active
CREATE INDEX IF NOT EXISTS idx_exam_types_is_active 
  ON public.exam_types(is_active);

-- Index for ordering by display_order
CREATE INDEX IF NOT EXISTS idx_exam_types_display_order 
  ON public.exam_types(display_order);

-- Composite index for common queries (active + order)
CREATE INDEX IF NOT EXISTS idx_exam_types_active_order 
  ON public.exam_types(is_active, display_order);

-- ============================================
-- 5. Add Comments for Documentation
-- ============================================

COMMENT ON TABLE public.exam_types IS 'Stores different types of medical examinations with their pathways';
COMMENT ON COLUMN public.exam_types.id IS 'Unique identifier for the exam type';
COMMENT ON COLUMN public.exam_types.name_ar IS 'Arabic name of the exam type';
COMMENT ON COLUMN public.exam_types.name_en IS 'English name of the exam type';
COMMENT ON COLUMN public.exam_types.description IS 'Detailed description of the exam type';
COMMENT ON COLUMN public.exam_types.pathway IS 'JSON array of clinic IDs representing the examination pathway';
COMMENT ON COLUMN public.exam_types.is_active IS 'Whether this exam type is currently active and available';
COMMENT ON COLUMN public.exam_types.display_order IS 'Order in which exam types should be displayed';
COMMENT ON COLUMN public.exam_types.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN public.exam_types.updated_at IS 'Timestamp when the record was last updated (auto-updated by trigger)';

-- ============================================
-- 6. Verification Query
-- ============================================

-- Display all exam types to verify
SELECT 
  id,
  name_ar,
  name_en,
  display_order,
  is_active,
  jsonb_array_length(pathway) as pathway_steps,
  created_at
FROM public.exam_types
ORDER BY display_order;
