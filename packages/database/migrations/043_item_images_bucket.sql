-- 043_item_images_bucket.sql
--
-- Creates the `item-images` storage bucket used by
-- apps/web/src/hooks/use-image-upload.ts. In the cloud project this bucket was
-- created by hand in the dashboard, so fresh databases (local edition,
-- staging, CI) were missing it.
--
-- Idempotent: a no-op where the bucket / policies already exist.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'item-images',
    'item-images',
    true,                                   -- images are served by public URL
    5242880,                                -- 5 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- The browser uploads with the signed-in user's token, so authenticated users
-- may add (but not overwrite or delete) objects in this bucket only.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'item_images_authenticated_insert'
    ) THEN
        CREATE POLICY item_images_authenticated_insert ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'item-images');
    END IF;
END $$;
