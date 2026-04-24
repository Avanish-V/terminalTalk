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
    if (!roomId) return;

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
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      console.warn("[WebRTC] Media failed, trying fallback", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err2) {
        stream = new MediaStream();
      }
    }

    if (aborted) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);

    // 2. Initialize PeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
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
        sendEvent("ice-candidate", { candidate: event.candidate.toJSON() });
      }
    };

    // 3. Signaling Logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processSignal = async (event: string, payload: any) => {
      if (!pcRef.current) return;

      switch (event) {
        case "ice-candidate":
          if (payload?.candidate) {
            if (pcRef.current.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.warn);
            } else {
              pendingCandidates.current.push(payload.candidate);
            }
          }
          break;
        case "offer":
          if (payload?.sdp) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            for (const c of pendingCandidates.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn);
            }
            pendingCandidates.current = [];
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            sendEvent("answer", { sdp: answer });
          }
          break;
        case "answer":
          if (payload?.sdp) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            for (const c of pendingCandidates.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn);
            }
            pendingCandidates.current = [];
          }
          break;
        case "ready":
          if (role === "offerer" && !pcRef.current.localDescription) {
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            sendEvent("offer", { sdp: offer });
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
      sendEvent("ready", {});
    } else {
      // Offerer: Periodically ping until connected or offer sent
      const pingInterval = setInterval(() => {
        if (pcRef.current?.localDescription || pcRef.current?.connectionState === "connected" || aborted) {
          clearInterval(pingInterval);
          return;
        }
        sendEvent("ping", { timestamp: Date.now() });
      }, 3000);
      
      // Initial offer if already ready
      setTimeout(async () => {
        if (pcRef.current && !pcRef.current.localDescription && !aborted) {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          sendEvent("offer", { sdp: offer });
        }
      }, 1000);
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
