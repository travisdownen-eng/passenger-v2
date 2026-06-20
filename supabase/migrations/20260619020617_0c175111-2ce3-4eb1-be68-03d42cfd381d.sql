INSERT INTO public.visits (patient_id, visit_type, visit_date, status, synced_from_hchb, narrative)
SELECT 
  id as patient_id,
  CASE 
    WHEN episode_start_date IS NOT NULL AND episode_start_date >= CURRENT_DATE - 7 THEN 'SOC'
    WHEN discharge_date IS NOT NULL THEN 'AgencyDischarge'
    ELSE 'Routine'
  END as visit_type,
  COALESCE(episode_start_date, CURRENT_DATE) as visit_date,
  'completed' as status,
  true as synced_from_hchb,
  '' as narrative
FROM public.patients
WHERE NOT EXISTS (SELECT 1 FROM public.visits WHERE visits.patient_id = patients.id)
LIMIT 10;