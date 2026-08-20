-- Repair properties.pm_id from users.property_id after wipes / PM recreate.

UPDATE public.properties p
SET pm_id = u.id
FROM public.users u
WHERE u.role = 'pm'
  AND u.property_id = p.id
  AND p.pm_id IS NULL;
