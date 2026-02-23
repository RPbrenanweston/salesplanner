-- Create public storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true);

-- RLS is already enabled on storage.objects by Supabase

-- Policy: Anyone can read logos (public bucket)
CREATE POLICY "Public logo read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Policy: Authenticated users can upload logos to their org folder
CREATE POLICY "Authenticated users can upload org logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT org_id::text
    FROM users
    WHERE id = auth.uid()
  )
);

-- Policy: Users can update their own org's logos
CREATE POLICY "Users can update own org logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT org_id::text
    FROM users
    WHERE id = auth.uid()
  )
);

-- Policy: Users can delete their own org's logos
CREATE POLICY "Users can delete own org logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (
    SELECT org_id::text
    FROM users
    WHERE id = auth.uid()
  )
);
