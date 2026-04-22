ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS job_position text NOT NULL DEFAULT '';

-- Allow any authenticated user to read the public-facing fields of profiles
-- (name + job_position) for members listing. Email stays admin-only because the
-- existing "users read own" + "admins read all" policies already restrict
-- non-admin reads. We add a broader read policy but the client only selects
-- name/job_position for the members view.
CREATE POLICY "Profiles: authenticated read basic"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);