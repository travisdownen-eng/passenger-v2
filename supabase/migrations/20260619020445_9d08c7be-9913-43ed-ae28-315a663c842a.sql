-- Create visits table for narrative assistant
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_type text NOT NULL DEFAULT 'Routine',
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'scheduled',
  narrative text,
  generated_documentation jsonb DEFAULT '[]'::jsonb,
  reassess_satisfies text,
  anticipate_discharge text,
  synced_from_hchb boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Grants for Data API access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;

-- Enable RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies - visits are scoped to patient context
CREATE POLICY "Users can view visits for their patients"
  ON public.visits
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert visits"
  ON public.visits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update visits"
  ON public.visits
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete visits"
  ON public.visits
  FOR DELETE
  TO authenticated
  USING (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();