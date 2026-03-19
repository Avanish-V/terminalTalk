-- Lock down match_sessions from direct client access while keeping service-role access for backend logic
DROP POLICY IF EXISTS "No direct access to match sessions" ON public.match_sessions;
CREATE POLICY "No direct access to match sessions"
ON public.match_sessions
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);