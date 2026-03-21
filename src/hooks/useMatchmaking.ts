import { useState, useCallback, useRef, useEffect } from "react";
import { ref, push, remove, onValue, off, runTransaction, onDisconnect, serverTimestamp } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export function useMatchmaking() {
  const [matching, setMatching] = useState(false);
  const myQueueRef = useRef<any>(null);
  const unsubscribeRef = useRef<() => void | null>(null);
  const abortRef = useRef(false);

  const stopPolling = useCallback(async () => {
    abortRef.current = true;
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

        // To match, we look at the queue
        const onQueueChange = onValue(queueRef, async (snapshot) => {
           if (abortRef.current) return;
           
           const data = snapshot.val();
           if (!data) return;

           const keys = Object.keys(data);
           // Try to find someone waiting who isn't us
           for (const key of keys) {
             const peer = data[key];
             if (key === nodeRef.key) {
               // If this is our own node and it's suddenly matched
               if (peer.status === "matched") {
                 setMatching(false);
                 if (unsubscribeRef.current) {
                   unsubscribeRef.current();
                   unsubscribeRef.current = null;
                 }
                 onMatched(peer.roomId, peer.peer, "offerer");
                 remove(nodeRef).catch(console.error);
                 myQueueRef.current = null;
               }
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

               if (result.committed && result.snapshot.val().status === "matched" && result.snapshot.val().peer === email) {
                 // We matched with them!
                 if (!abortRef.current) {
                   setMatching(false);
                   const roomId = result.snapshot.val().roomId;
                   onMatched(roomId, peer.email, "answerer");
                   
                   if (unsubscribeRef.current) {
                     unsubscribeRef.current();
                     unsubscribeRef.current = null;
                   }
                   remove(nodeRef).catch(console.error);
                   myQueueRef.current = null;
                 }
                 break;
               }
             }
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
