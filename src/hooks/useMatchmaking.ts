import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MatchResult {
  status: "waiting" | "matched";
  roomId?: string;
  peer?: string;
  role?: "offerer" | "answerer";
  queueId?: string;
}

export function useMatchmaking() {
  const [matching, setMatching] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    abortRef.current = true;
    setMatching(false);
  }, []);

  const findMatch = useCallback(
    async (
      email: string,
      onMatched: (roomId: string, peer: string, role: "offerer" | "answerer") => void
    ) => {
      setMatching(true);
      abortRef.current = false;

      try {
        const res = await supabase.functions.invoke("match", {
          body: { email },
        });

        if (abortRef.current) return;

        const data = res.data as MatchResult;

        if (data.status === "matched" && data.roomId && data.peer && data.role) {
          setMatching(false);
          onMatched(data.roomId, data.peer, data.role);
          return;
        }

        // We're in the queue, poll for a match
        pollingRef.current = setInterval(async () => {
          if (abortRef.current) return;

          try {
            const pollRes = await supabase.functions.invoke("match", {
              body: { email },
            });

            if (abortRef.current) return;

            const pollData = pollRes.data as MatchResult;
            if (pollData.status === "matched" && pollData.roomId && pollData.peer && pollData.role) {
              stopPolling();
              onMatched(pollData.roomId, pollData.peer, pollData.role);
            }
          } catch (e) {
            console.error("Polling error:", e);
          }
        }, 3000);
      } catch (e) {
        console.error("Match error:", e);
        setMatching(false);
      }
    },
    [stopPolling]
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { findMatch, stopPolling, matching };
}
