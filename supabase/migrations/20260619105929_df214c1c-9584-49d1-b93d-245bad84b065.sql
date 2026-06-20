-- Drop the authenticated-only policies and replace with open policies
-- matching the rest of the app's tables
DROP POLICY IF EXISTS "Users can view visits for their patients" ON public.visits;
DROP POLICY IF EXISTS "Users can insert visits" ON public.visits;
DROP POLICY IF EXISTS "Users can update visits" ON public.visits;
DROP POLICY IF EXISTS "Users can delete visits" ON public.visits;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO anon;

CREATE POLICY "open_all_visits"
  ON public.visits
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);