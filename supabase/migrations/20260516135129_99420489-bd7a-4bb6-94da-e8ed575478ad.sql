
-- Public buckets already serve direct URLs without needing a SELECT policy on storage.objects.
-- The previous "Anyone read letterhead" policy enabled listing — drop it.
DROP POLICY IF EXISTS "Anyone read letterhead" ON storage.objects;
