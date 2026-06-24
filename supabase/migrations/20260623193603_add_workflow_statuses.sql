-- Shared workflow state for Passenger assistant outputs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_type') THEN
    CREATE TYPE public.workflow_type AS ENUM ('referral', 'medication', 'narrative', 'call');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_state') THEN
    CREATE TYPE public.workflow_state AS ENUM ('not_started', 'needs_review', 'ready_to_sync', 'synced');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workflow_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  workflow_type public.workflow_type NOT NULL,
  state public.workflow_state NOT NULL DEFAULT 'not_started',
  source_table text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  ready_to_sync_at timestamptz,
  synced_at timestamptz,
  CONSTRAINT workflow_statuses_source_pair CHECK (
    (source_table IS NULL AND source_id IS NULL)
    OR (source_table IS NOT NULL AND source_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_workflow_statuses_patient
  ON public.workflow_statuses(patient_id);

CREATE INDEX IF NOT EXISTS idx_workflow_statuses_state
  ON public.workflow_statuses(state);

CREATE INDEX IF NOT EXISTS idx_workflow_statuses_type_state
  ON public.workflow_statuses(workflow_type, state);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_statuses_artifact_unique
  ON public.workflow_statuses(workflow_type, source_table, source_id)
  WHERE source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_statuses_patient_type_unique
  ON public.workflow_statuses(patient_id, workflow_type)
  WHERE source_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_statuses TO anon, authenticated;
GRANT ALL ON public.workflow_statuses TO service_role;

ALTER TABLE public.workflow_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all_workflow_statuses"
  ON public.workflow_statuses
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_workflow_statuses_updated
  BEFORE UPDATE ON public.workflow_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
