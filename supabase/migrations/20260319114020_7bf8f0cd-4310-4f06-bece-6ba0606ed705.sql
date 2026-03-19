-- Lock down match_queue from direct client access; only backend service role should manage it
DROP POLICY IF EXISTS "Anyone can join queue" ON public.match_queue;
DROP POLICY IF EXISTS "Anyone can read queue" ON public.match_queue;
DROP POLICY IF EXISTS "Anyone can delete from queue" ON public.match_queue;

DROP POLICY IF EXISTS "No direct access to match queue" ON public.match_queue;
CREATE POLICY "No direct access to match queue"
ON public.match_queue
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);