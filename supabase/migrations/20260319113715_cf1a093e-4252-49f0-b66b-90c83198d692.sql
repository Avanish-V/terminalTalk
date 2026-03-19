-- Persist completed matches so both peers can retrieve the same room assignment
CREATE TABLE IF NOT EXISTS public.match_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_one_email TEXT NOT NULL,
  user_two_email TEXT NOT NULL,
  offerer_email TEXT NOT NULL,
  answerer_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_sessions_distinct_emails CHECK (user_one_email <> user_two_email)
);

ALTER TABLE public.match_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_match_sessions_user_one_email ON public.match_sessions (user_one_email);
CREATE INDEX IF NOT EXISTS idx_match_sessions_user_two_email ON public.match_sessions (user_two_email);
CREATE INDEX IF NOT EXISTS idx_match_sessions_created_at ON public.match_sessions (created_at);