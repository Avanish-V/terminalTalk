import { useRef, useState, useCallback, useEffect } from "react";
import { ref, push, onChildAdded, off, onDisconnect, remove } from "firebase/database";
import { rtdb } from "@/lib/firebase";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Global STUN Servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },

    // ExpressTURN Servers (Configured via .env)
    {
      urls: import.meta.env.VITE_TURN_URL || "turn:free.expressturn.com:3478",
      username: import.meta.env.VITE_TURN_USERNAME || "000000002092365468",
      credential: import.meta.env.VITE_TURN_PASSWORD || "xuNsuAomcOWD96gimmwqkmNjzhg=",
    },
  ],
  iceCandidatePoolSize: 10,
};

interface UseWebRTCOptions {
  roomId: string;
  role: "offerer" | "answerer";
  onDisconnect?: () => void;
}

export function useWebRTC({ roomId, role, onDisconnect: onDisconnectCb }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>("new");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback((destroyRoom: boolean = false) => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCandidates.current = []; // Critical: clear stale candidates between matches

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Cleanup room data manually ONLY on explicit hangup (not React strict mode remounts)
    if (destroyRoom && roomId) {
      const roomRef = ref(rtdb, `rooms/${roomId}`);
      remove(roomRef).catch(console.error);
    }

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("closed");
  }, [roomId]);

  const sendEvent = useCallback(async (event: string, payload: unknown) => {
    if (!roomId) return;
    try {
      console.log(`[WebRTC] Preparing to send ${event} from ${role}`, payload);
      const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
      const safePayload = JSON.parse(JSON.stringify(payload));
      await push(messagesRef, {
        event,
        payload: safePayload,
        sender: role,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("[WebRTC] Error sending signal event:", e);
    }
  }, [roomId, role]);

  const signalBuffer = useRef<{ event: string; payload: unknown }[]>([]);

  const start = useCallback(async () => {
    if (!roomId || pcRef.current) return;

    let aborted = false;
    const oldCleanup = unsubscribeRef.current;
    unsubscribeRef.current = () => {
      if (oldCleanup) oldCleanup();
      aborted = true;
    };

    const roomRef = ref(rtdb, `rooms/${roomId}`);
    onDisconnect(roomRef).remove().catch(console.error);

    // 1. Get Media
    let stream: MediaStream;
    try {
      // Small delay to allow hardware to release from previous session
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log("[WebRTC] Requesting media for room:", roomId);
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      console.warn("[WebRTC] Media failed, trying fallback", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err2) {
        console.error("[WebRTC] All media requests failed", err2);
        stream = new MediaStream();
      }
    }

    if (aborted) {
      console.log("[WebRTC] Start aborted during media request");
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    console.log(`[WebRTC] Obtained stream with ${stream.getTracks().length} tracks`);
    localStreamRef.current = stream;
    setLocalStream(stream);

    // 2. Initialize PeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track: ${event.track.kind}`, event.streams[0]?.id);
      setRemoteStream(prev => {
        if (event.streams && event.streams[0]) return event.streams[0];
        if (prev) {
          if (!prev.getTracks().includes(event.track)) prev.addTrack(event.track);
          return prev;
        }
        return new MediaStream([event.track]);
      });
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        onDisconnectCb?.();
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[WebRTC] Local ICE candidate generated");
        sendEvent("ice-candidate", { candidate: event.candidate.toJSON() });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] ICE gathering state:", pc.iceGatheringState);
    };

    // 3. Signaling Logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processSignal = async (event: string, payload: any) => {
      if (!pcRef.current) return;

      switch (event) {
        case "ice-candidate":
          if (payload?.candidate) {
            if (pcRef.current.remoteDescription) {
              console.log("[WebRTC] Adding remote ICE candidate");
              await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.warn);
            } else {
              console.log("[WebRTC] Storing pending remote ICE candidate");
              pendingCandidates.current.push(payload.candidate);
            }
          }
          break;
        case "offer":
          if (payload?.sdp) {
            console.log("[WebRTC] Received offer, setting remote description");
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            console.log("[WebRTC] Remote description set, processing pending candidates:", pendingCandidates.current.length);
            for (const c of pendingCandidates.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn);
            }
            pendingCandidates.current = [];
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            sendEvent("answer", { sdp: pcRef.current.localDescription?.toJSON() || answer });
          }
          break;
        case "answer":
          if (payload?.sdp) {
            console.log("[WebRTC] Received answer, setting remote description");
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            console.log("[WebRTC] Remote description set (answer), processing pending candidates:", pendingCandidates.current.length);
            for (const c of pendingCandidates.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn);
            }
            pendingCandidates.current = [];
          }
          break;
        case "ready":
          if (role === "offerer" && pcRef.current.connectionState !== "connected") {
            // If we already have an offer, re-send it in case they missed it
            if (pcRef.current.signalingState === "have-local-offer") {
              console.log("[WebRTC] Received ready and already have offer, re-sending current offer");
              sendEvent("offer", { sdp: pcRef.current.localDescription?.toJSON() });
              return;
            }
            
            if (pcRef.current.signalingState !== "stable") {
              console.log("[WebRTC] Received ready but signaling state is not stable, skipping new offer creation");
              return;
            }

            console.log("[WebRTC] Received ready, creating new offer");
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            sendEvent("offer", { sdp: pcRef.current.localDescription?.toJSON() || offer });
          }
          break;
        case "ping":
          if (role === "answerer" && pcRef.current.connectionState !== "connected") {
            sendEvent("ready", {}); // Respond to pings with ready if not connected
          }
          break;
      }
    };

    const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
    const onMessageAdded = onChildAdded(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || data.sender === role) return;
      processSignal(data.event, data.payload);
    });

    unsubscribeRef.current = () => off(messagesRef, "child_added", onMessageAdded);

    // 4. Initial Trigger
    if (role === "answerer") {
      // Answerer: Send ready initially and then periodically until connected
      sendEvent("ready", {});
      const readyInterval = setInterval(() => {
        if (pcRef.current?.connectionState === "connected" || aborted) {
          clearInterval(readyInterval);
          return;
        }
        sendEvent("ready", {});
      }, 3000);
    } else {
      // Offerer: Periodically ping until connected
      const pingInterval = setInterval(() => {
        if (pcRef.current?.connectionState === "connected" || aborted) {
          clearInterval(pingInterval);
          return;
        }
        sendEvent("ping", { timestamp: Date.now() });
      }, 3000);
      
      // Initial offer attempt
      setTimeout(async () => {
        if (pcRef.current && pcRef.current.connectionState !== "connected" && !aborted) {
          console.log("[WebRTC] Sending initial offer");
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          sendEvent("offer", { sdp: pcRef.current.localDescription?.toJSON() || offer });
        }
      }, 1500);
    }
  }, [roomId, role, onDisconnectCb, sendEvent]);

  const toggleMic = useCallback(
    (enabled: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = enabled;
      });
    },
    []
  );

  const toggleCam = useCallback(
    (enabled: boolean) => {
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.enabled = enabled;
      });
    },
    []
  );

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    localStream,
    remoteStream,
    connectionState,
    start,
    cleanup,
    toggleMic,
    toggleCam,
  };
}
