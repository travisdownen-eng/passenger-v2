-- Seed a recent 'Subsequent' visit for every patient that doesn't already have one,
-- so the Documentation Assistant's Subsequent Visit workflow can be exercised.
INSERT INTO public.visits (patient_id, visit_type, visit_date, status, synced_from_hchb, narrative)
SELECT
  p.id,
  'Subsequent',
  CURRENT_DATE,
  'scheduled',
  true,
  ''
FROM public.patients p
WHERE NOT EXISTS (
  SELECT 1 FROM public.visits v
  WHERE v.patient_id = p.id AND v.visit_type = 'Subsequent'
);