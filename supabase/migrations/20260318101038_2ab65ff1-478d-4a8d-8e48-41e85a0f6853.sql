
-- Queue table for users waiting to be matched
CREATE TABLE public.match_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_queue ENABLE ROW LEVEL SECURITY;

-- Allow anonymous/authenticated users to insert themselves and read
CREATE POLICY "Anyone can join queue" ON public.match_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read queue" ON public.match_queue
  FOR SELECT USING (true);

CREATE POLICY "Anyone can delete from queue" ON public.match_queue
  FOR DELETE USING (true);

-- Index for fast matching
CREATE INDEX idx_match_queue_created_at ON public.match_queue (created_at);
