-- Storage Bucket Policies for work-order-media
-- These policies control who can access files in the work-order-media bucket

-- Policy 1: Allow tenants to view attachments for their own work orders
DROP POLICY IF EXISTS "Tenants can view their work order attachments" ON storage.objects;
CREATE POLICY "Tenants can view their work order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    WHERE work_orders.tenant_id = auth.uid()
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);

-- Policy 2: Allow technicians to view attachments for assigned work orders
DROP POLICY IF EXISTS "Technicians can view assigned work order attachments" ON storage.objects;
CREATE POLICY "Technicians can view assigned work order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    WHERE work_orders.technician_id = auth.uid()
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);

-- Policy 3: Allow PMs to view attachments for their property's work orders
DROP POLICY IF EXISTS "PMs can view their property work order attachments" ON storage.objects;
CREATE POLICY "PMs can view their property work order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    JOIN users ON users.property_id = work_orders.property_id
    WHERE users.id = auth.uid()
    AND users.role = 'pm'
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);

-- Policy 4: Allow tenants to upload attachments to their own work orders
DROP POLICY IF EXISTS "Tenants can upload to their work orders" ON storage.objects;
CREATE POLICY "Tenants can upload to their work orders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    WHERE work_orders.tenant_id = auth.uid()
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);

-- Policy 5: Allow technicians to upload attachments to assigned work orders
DROP POLICY IF EXISTS "Technicians can upload to assigned work orders" ON storage.objects;
CREATE POLICY "Technicians can upload to assigned work orders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    WHERE work_orders.technician_id = auth.uid()
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);

-- Policy 6: Allow PMs to upload attachments to their property's work orders
DROP POLICY IF EXISTS "PMs can upload to their property work orders" ON storage.objects;
CREATE POLICY "PMs can upload to their property work orders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'work-order-media'
  AND EXISTS (
    SELECT 1 
    FROM work_orders 
    JOIN users ON users.property_id = work_orders.property_id
    WHERE users.id = auth.uid()
    AND users.role = 'pm'
    AND (storage.objects.name LIKE '%' || work_orders.id || '%')
  )
);

-- Verify policies were created
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%work order%'
ORDER BY policyname;

