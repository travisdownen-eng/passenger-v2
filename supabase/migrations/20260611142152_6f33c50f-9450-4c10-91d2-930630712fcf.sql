
CREATE TYPE public.patient_status AS ENUM ('pending_review','active','discharged','on_hold');
CREATE TYPE public.reconciliation_status AS ENUM ('not_started','in_progress','completed');
CREATE TYPE public.medication_source AS ENUM ('referral','hospital','patient_reported','provider','reconciled');

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  dob date,
  mrn text,
  referral_date date,
  status public.patient_status NOT NULL DEFAULT 'pending_review',
  hospitalization_reason text,
  home_health_reason text,
  admit_date date,
  discharge_date date,
  surgery_date date,
  precautions text[] DEFAULT '{}',
  allergies text[] DEFAULT '{}',
  past_medical_history text[] DEFAULT '{}',
  primary_diagnosis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referral_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  filename text NOT NULL,
  upload_date timestamptz NOT NULL DEFAULT now(),
  extracted_text text,
  summary_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  dosage text,
  frequency text,
  route text,
  source public.medication_source NOT NULL DEFAULT 'referral',
  high_risk boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reconciliation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  status public.reconciliation_status NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_referrals_patient ON public.referral_documents(patient_id);
CREATE INDEX idx_meds_patient ON public.medications(patient_id);
CREATE INDEX idx_recon_patient ON public.reconciliation_sessions(patient_id);

-- Grants (foundation phase: open access; tighten when auth lands)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO anon, authenticated;
GRANT ALL ON public.patients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_documents TO anon, authenticated;
GRANT ALL ON public.referral_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO anon, authenticated;
GRANT ALL ON public.medications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reconciliation_sessions TO anon, authenticated;
GRANT ALL ON public.reconciliation_sessions TO service_role;

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_sessions ENABLE ROW LEVEL SECURITY;

-- Foundation policies: permissive for prototype; will be replaced once clinician auth is added.
CREATE POLICY "open_all_patients" ON public.patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_referrals" ON public.referral_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_meds" ON public.medications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_recon" ON public.reconciliation_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_meds_updated BEFORE UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_recon_updated BEFORE UPDATE ON public.reconciliation_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
