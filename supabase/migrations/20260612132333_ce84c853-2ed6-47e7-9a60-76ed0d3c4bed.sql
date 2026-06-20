ALTER TABLE public.patients ADD COLUMN physician_name text;
ALTER TABLE public.patients ADD COLUMN physician_phone text;
ALTER TABLE public.patients ADD COLUMN patient_order text;

GRANT SELECT, INSERT, UPDATE ON public.patients TO anon, authenticated;
GRANT ALL ON public.patients TO service_role;