-- Storage Bucket and Policies for profile-pictures
-- These policies control who can access and upload profile pictures

-- Create the profile-pictures bucket (run this in Supabase Dashboard Storage section if bucket doesn't exist)
-- Or use: INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true);

-- Policy 1: Allow users to view their own profile picture
DROP POLICY IF EXISTS "Users can view their own profile picture" ON storage.objects;
CREATE POLICY "Users can view their own profile picture"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (storage.objects.name LIKE '%' || auth.uid()::text || '%')
);

-- Policy 2: Allow users to view profile pictures of users in their property (for PMs, tenants, technicians)
DROP POLICY IF EXISTS "Users can view profile pictures in their property" ON storage.objects;
CREATE POLICY "Users can view profile pictures in their property"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND EXISTS (
    SELECT 1 
    FROM users viewer
    JOIN users profile_owner ON viewer.property_id = profile_owner.property_id
    WHERE viewer.id = auth.uid()
    AND (storage.objects.name LIKE '%' || profile_owner.id::text || '%')
  )
);

-- Policy 3: Allow users to upload their own profile picture
DROP POLICY IF EXISTS "Users can upload their own profile picture" ON storage.objects;
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND (storage.objects.name LIKE '%' || auth.uid()::text || '%')
);

-- Policy 4: Allow users to update their own profile picture
DROP POLICY IF EXISTS "Users can update their own profile picture" ON storage.objects;
CREATE POLICY "Users can update their own profile picture"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (storage.objects.name LIKE '%' || auth.uid()::text || '%')
)
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND (storage.objects.name LIKE '%' || auth.uid()::text || '%')
);

-- Policy 5: Allow users to delete their own profile picture
DROP POLICY IF EXISTS "Users can delete their own profile picture" ON storage.objects;
CREATE POLICY "Users can delete their own profile picture"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (storage.objects.name LIKE '%' || auth.uid()::text || '%')
);

-- Policy 6: Allow PMs to view all profile pictures in their property
DROP POLICY IF EXISTS "PMs can view all profile pictures in their property" ON storage.objects;
CREATE POLICY "PMs can view all profile pictures in their property"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid()
    AND users.role = 'pm'
    AND EXISTS (
      SELECT 1 
      FROM users property_users
      WHERE property_users.property_id = users.property_id
      AND (storage.objects.name LIKE '%' || property_users.id::text || '%')
    )
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
AND policyname LIKE '%profile picture%'
ORDER BY policyname;


