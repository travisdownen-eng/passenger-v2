ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS code_status text,
  ADD COLUMN IF NOT EXISTS episode_start_date date,
  ADD COLUMN IF NOT EXISTS episode_end_date date,
  ADD COLUMN IF NOT EXISTS patient_goals text;