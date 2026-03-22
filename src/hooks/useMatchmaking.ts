import { useState, useCallback, useRef, useEffect } from "react";
import { ref, push, remove, onValue, off, runTransaction, onDisconnect, serverTimestamp } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export function useMatchmaking() {
  const [matching, setMatching] = useState(false);
  const myQueueRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const abortRef = useRef(false);
  const isMatchingRef = useRef(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(async () => {
    console.log("[Matchmaking] stopPolling called. Cleaning up...");
    abortRef.current = true;
    isMatchingRef.current = false;
    setMatching(false);

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (myQueueRef.current) {
      try {
        console.log("[Matchmaking] Removing node from queue:", myQueueRef.current.key);
        await remove(myQueueRef.current);
      } catch (e) {
        console.error("Error deleting queue node:", e);
      }
      myQueueRef.current = null;
    }
  }, []);

  const findMatch = useCallback(
    async (
      email: string,
      displayName: string,
      onMatched: (roomId: string, peer: string, peerName: string, role: "offerer" | "answerer") => void
    ) => {
      if (isMatchingRef.current) {
        console.warn("[Matchmaking] Already matching. Ignoring duplicate call.");
        return;
      }
      
      console.log("[Matchmaking] findMatch started for:", email, displayName);
      
      // Always cleanup before starting a new search to prevent race conditions
      await stopPolling();
      
      isMatchingRef.current = true;
      setMatching(true);
      abortRef.current = false;

      try {
        const queueRef = ref(rtdb, "matchmaking");
        const nodeRef = push(queueRef);
        myQueueRef.current = nodeRef;
        console.log("[Matchmaking] Created queue node:", nodeRef.key);

        await onDisconnect(nodeRef).remove();

        await runTransaction(nodeRef, () => {
          return {
            email,
            displayName: displayName || "Stranger",
            status: "waiting",
            lastActive: Date.now()
          };
        });

        heartbeatIntervalRef.current = setInterval(() => {
          if (myQueueRef.current && !abortRef.current) {
            runTransaction(myQueueRef.current, (data) => {
              if (data && data.status === "waiting") {
                data.lastActive = Date.now();
                return data;
              }
              return data;
            }).catch(console.warn);
          }
        }, 15000);

        if (abortRef.current) {
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          return;
        }

        let claiming = false;

        const onQueueChange = async (snapshot: any) => {
           if (abortRef.current) return;
           
           const data = snapshot.val();
           if (!data) return;

           const keys = Object.keys(data);
           
           for (const key of keys) {
             const peer = data[key];
             if (key === nodeRef.key) {
               if (peer.status === "matched") {
                 console.log("[Matchmaking] Peer matched with our node!");
                 setMatching(false);
                 isMatchingRef.current = false;
                 
                 // Unsubscribe first to avoid duplicate events
                 if (unsubscribeRef.current) {
                   unsubscribeRef.current();
                   unsubscribeRef.current = null;
                 } else {
                    // Fallback cleanup if unsubscribeRef was not yet populated (rare race condition)
                    off(queueRef, "value", onQueueChange);
                    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                 }
                 
                 onMatched(peer.roomId, peer.peer, peer.peerName, "offerer");
                 remove(nodeRef).catch(console.error);
                 myQueueRef.current = null;
                 return;
               }
             }
           }

           if (claiming || abortRef.current) return;
           claiming = true;
           
           try {
             for (const key of keys) {
               if (abortRef.current || myQueueRef.current === null) break;
               if (key === nodeRef.key) continue;
               
               const peer = data[key];
               if (peer.email === email) {
                 remove(ref(rtdb, `matchmaking/${key}`)).catch(console.warn);
                 continue; 
               }
               
               if (peer.status === "waiting") {
                 if (peer.lastActive && Date.now() - peer.lastActive > 45000) {
                   remove(ref(rtdb, `matchmaking/${key}`)).catch(console.warn);
                   continue;
                 }

                 const peerRef = ref(rtdb, `matchmaking/${key}`);
                 const result = await runTransaction(peerRef, (currentData) => {
                   if (currentData && currentData.status === "waiting") {
                     currentData.status = "matched";
                     currentData.roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                     currentData.peer = email;
                     currentData.peerName = displayName || "Stranger";
                     currentData.role = "offerer";
                     return currentData;
                   }
                   return currentData;
                 });

                 if (result.committed && result.snapshot.val()?.status === "matched" && result.snapshot.val()?.peer === email) {
                   if (!abortRef.current) {
                     console.log("[Matchmaking] Successfully claimed peer!");
                     setMatching(false);
                     isMatchingRef.current = false;
                     const roomId = result.snapshot.val().roomId;
                     
                     if (unsubscribeRef.current) {
                       unsubscribeRef.current();
                       unsubscribeRef.current = null;
                     } else {
                        off(queueRef, "value", onQueueChange);
                        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                     }
                     
                     onMatched(roomId, peer.email, peer.displayName, "answerer");
                     remove(nodeRef).catch(console.error);
                     myQueueRef.current = null;
                   }
                   break;
                 }
               }
             }
           } finally {
             claiming = false;
           }
        };

        // Assign unsubscribe function BEFORE attaching the listener
        unsubscribeRef.current = () => {
          console.log("[Matchmaking] Unsubscribing listener...");
          off(queueRef, "value", onQueueChange);
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        };

        onValue(queueRef, onQueueChange);

      } catch (e) {
        console.error("[Matchmaking] Error in findMatch:", e);
        setMatching(false);
        isMatchingRef.current = false;
        await stopPolling();
      }
    },
    [stopPolling]
  );

  useEffect(() => {
    return () => {
      console.log("[Matchmaking] Hook unmounting, stopping polling...");
      stopPolling(); 
    };
  }, [stopPolling]);

  return { findMatch, stopPolling, matching };
}

