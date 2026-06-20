UPDATE public.visits SET visit_type = 'Subsequent' WHERE visit_type = 'Routine';
ALTER TABLE public.visits ALTER COLUMN visit_type SET DEFAULT 'Subsequent';