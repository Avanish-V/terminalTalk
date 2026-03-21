import { useState, useCallback, useRef, useEffect } from "react";
import { ref, push, remove, onValue, off, runTransaction, onDisconnect, serverTimestamp } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export function useMatchmaking() {
  const [matching, setMatching] = useState(false);
  const myQueueRef = useRef<any>(null);
  const unsubscribeRef = useRef<() => void | null>(null);
  const abortRef = useRef(false);
  const isMatchingRef = useRef(false);

  const stopPolling = useCallback(async () => {
    abortRef.current = true;
    isMatchingRef.current = false;
    setMatching(false);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (myQueueRef.current) {
      try {
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
      onMatched: (roomId: string, peer: string, role: "offerer" | "answerer") => void
    ) => {
      if (isMatchingRef.current) {
        console.warn("Already securely iterating a match. Ignoring duplicate findMatch call.");
        return;
      }
      isMatchingRef.current = true;
      setMatching(true);
      abortRef.current = false;

      try {
        // We'll write ourselves directly into the matchmaking queue
        const queueRef = ref(rtdb, "matchmaking");
        const nodeRef = push(queueRef);
        myQueueRef.current = nodeRef;

        // Ensure if we disconnect, we are removed from queue
        await onDisconnect(nodeRef).remove();

        await runTransaction(nodeRef, () => {
          return {
            email,
            status: "waiting",
            createdAt: serverTimestamp()
          };
        });

        if (abortRef.current) return;

          let claiming = false;

        // To match, we look at the queue
        const onQueueChange = onValue(queueRef, async (snapshot) => {
           if (abortRef.current) return;
           
           const data = snapshot.val();
           if (!data) return;

           const keys = Object.keys(data);
           
           // HIGHEST PRIORITY: Check if SOMEONE ELSE matched with us!
           // We must never block this check with a lock.
           for (const key of keys) {
             const peer = data[key];
             if (key === nodeRef.key) {
               // If this is our own node and it's suddenly matched
               if (peer.status === "matched") {
                 setMatching(false);
                 isMatchingRef.current = false;
                 if (unsubscribeRef.current) {
                   unsubscribeRef.current();
                   unsubscribeRef.current = null;
                 }
                 // If they set our roomId and peer email
                 onMatched(peer.roomId, peer.peer, "offerer");
                 remove(nodeRef).catch(console.error);
                 myQueueRef.current = null;
                 return; // We matched! Stop looking at the queue entirely.
               }
             }
           }

           // SECOND PRIORITY: If we are not matched, try to claim someone else.
           // Use a lock to prevent concurrent overlapping transactions from spanning out of control.
           if (claiming || abortRef.current) return;
           claiming = true;
           
           try {
             for (const key of keys) {
               if (abortRef.current || myQueueRef.current === null) break;
               if (key === nodeRef.key) continue; // Skip our own active node
               
               const peer = data[key];
               
               // PREVENT GHOST MATCHES!
               // If there is another node in the queue with the EXACT same email, 
               // it's a stale ghost from a recent page refresh. We shouldn't match with ourselves.
               if (peer.email === email) {
                 // Clean up the ghost node to keep the queue healthy
                 remove(ref(rtdb, `matchmaking/${key}`)).catch(console.warn);
                 continue; 
               }

               if (peer.status === "waiting") {
                 // Attempt to transactionally claim this peer
                 const peerRef = ref(rtdb, `matchmaking/${key}`);
                 const result = await runTransaction(peerRef, (currentData) => {
                   if (currentData && currentData.status === "waiting") {
                     currentData.status = "matched";
                     currentData.roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                     currentData.peer = email;
                     currentData.role = "offerer";
                     return currentData;
                   }
                   return currentData; // abort transaction
                 });

                 // If transaction succeeded and we successfully secured the peer
                 if (result.committed && result.snapshot.val()?.status === "matched" && result.snapshot.val()?.peer === email) {
                   if (!abortRef.current) {
                     setMatching(false);
                     isMatchingRef.current = false;
                     const roomId = result.snapshot.val().roomId;
                     onMatched(roomId, peer.email, "answerer");
                     
                     if (unsubscribeRef.current) {
                       unsubscribeRef.current();
                       unsubscribeRef.current = null;
                     }
                     // Remove our own waiting node from the queue
                     remove(nodeRef).catch(console.error);
                     myQueueRef.current = null;
                   }
                   break; // Stop iterating, we found a match!
                 }
               }
             }
           } finally {
             claiming = false;
           }
        });

        unsubscribeRef.current = () => off(queueRef, "value", onQueueChange);

      } catch (e) {
        console.error("Match error:", e);
        setMatching(false);
      }
    },
    []
  );

  useEffect(() => {
    return () => { stopPolling(); };
  }, [stopPolling]);

  return { findMatch, stopPolling, matching };
}
