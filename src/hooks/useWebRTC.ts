import { useRef, useState, useCallback, useEffect } from "react";
import { ref, push, onChildAdded, off, onDisconnect, remove } from "firebase/database";
import { rtdb } from "@/lib/firebase";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // A TURN server is STRICTLY REQUIRED for connections crossing symmetric NATs (4G/5G/Corporate Wifi)
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ],
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
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Cleanup room data manually ONLY on explicit hangup (not React strict mode remounts)
    if (destroyRoom) {
      const roomRef = ref(rtdb, `rooms/${roomId}`);
      remove(roomRef).catch(console.error);
    }

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("closed");
  }, [roomId]);

  const sendEvent = useCallback(async (event: string, payload: any) => {
    try {
      console.log(`[WebRTC] Preparing to send ${event} from ${role}`, payload);
      const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
      // Firebase throws an exception if payload contains Custom Prototypes like RTCSessionDescription.
      // We safely convert it to a primitive plane object here:
      const safePayload = JSON.parse(JSON.stringify(payload));

      console.log(`[WebRTC] Pushing ${event} safely to RTDB:`, safePayload);
      await push(messagesRef, {
        event,
        payload: safePayload,
        sender: role,
        timestamp: Date.now()
      });
      console.log(`[WebRTC] Successfully sent ${event}`);
    } catch (e) {
      console.error("[WebRTC] Error sending signal event:", e);
    }
  }, [roomId, role]);

  const start = useCallback(async () => {
    // Register onDisconnect to clean up on sudden closes
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    onDisconnect(roomRef).remove().catch(console.error);

    // Get local media
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (err) {
      console.warn("Failed to get both video and audio. Trying audio only.", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err2) {
        console.error("Failed to get any media devices:", err2);
        // Fallback to empty stream so negotiation doesn't completely halt
        stream = new MediaStream();
      }
    }
    localStreamRef.current = stream;
    setLocalStream(stream);

    // Create peer connection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Add local tracks
    stream.getTracks().forEach((track) => {
      console.log(`[WebRTC] Adding local track: ${track.kind}`);
      pc.addTrack(track, stream);
    });

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log("[WebRTC] Received remote track:", event.track.kind);
      setRemoteStream((prevStream) => {
        // We MUST use the browser's native stream instance directly and keep it stable!
        // Re-creating MediaStreams can stall playback.
        if (event.streams && event.streams.length > 0) {
          console.log("[WebRTC] Native streams provided by ontrack. Using streams[0].");
          return event.streams[0];
        }

        // Fallback if browser doesn't send streams[]
        if (prevStream) {
          if (!prevStream.getTracks().includes(event.track)) {
            console.log("[WebRTC] Falling back to manual prevStream.addTrack");
            prevStream.addTrack(event.track);
          }
          return prevStream; // Keep same reference
        }

        console.log("[WebRTC] No prev stream, creating new MediaStream with first track.");
        return new MediaStream([event.track]);
      });
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state changed to: ${pc.connectionState}`);
      setConnectionState(pc.connectionState);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        onDisconnectCb?.();
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[WebRTC] Gathered ICE candidate.");
        sendEvent("ice-candidate", { candidate: event.candidate.toJSON() });
      } else {
        console.log("[WebRTC] Finished gathering ICE candidates.");
      }
    };

    // Signaling via Realtime Database
    const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
    const onMessageAdded = onChildAdded(messagesRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data || data.sender === role) return;

      console.log(`[WebRTC] Received ${data.event} from ${data.sender}`, data.payload);

      switch (data.event) {
        case "ice-candidate":
          if (data.payload?.candidate && pcRef.current) {
            const candidateList = pendingCandidates.current;
            if (pcRef.current.remoteDescription) {
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(data.payload.candidate));
                console.log("[WebRTC] Added ICE candidate successfully.");
              } catch (e) {
                console.warn("[WebRTC] Failed to add ICE candidate:", e);
              }
            } else {
              console.log("[WebRTC] Remote description missing, buffering ICE candidate.");
              candidateList.push(data.payload.candidate);
            }
          }
          break;

        case "offer":
          if (data.payload?.sdp && pcRef.current) {
            console.log("[WebRTC] Setting remote description from offer...");
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
            // Flush any pending candidates
            for (const c of pendingCandidates.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn);
            }
            pendingCandidates.current = [];

            console.log("[WebRTC] Creating answer...");
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            sendEvent("answer", { sdp: answer });
          }
          break;

        case "answer":
          if (data.payload?.sdp && pcRef.current) {
            console.log("[WebRTC] Setting remote description from answer...");
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
            // Flush any pending candidates
            for (const c of pendingCandidates.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn);
            }
            pendingCandidates.current = [];
          }
          break;

        case "ready":
          if (role === "offerer" && pcRef.current && !pcRef.current.localDescription) {
            console.log("[WebRTC] Receiver is ready. Creating offer...");
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            sendEvent("offer", { sdp: offer });
          }
          break;
      }
    });

    unsubscribeRef.current = () => off(messagesRef, "child_added", onMessageAdded);

    // Answerer signals readiness; offerer also sends a ping in case answerer was first
    if (role === "answerer") {
      console.log("[WebRTC] Connecting as answerer, sending ready signal.");
      sendEvent("ready", {});
    } else {
      console.log("[WebRTC] Connecting as offerer, setting backup 2s timeout for offer.");
      // In case answerer is already subscribed, send offer after a short delay as fallback
      setTimeout(async () => {
        if (pcRef.current && !pcRef.current.localDescription) {
          console.log("[WebRTC] Outputting backup 2s timeout offer...");
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          sendEvent("offer", { sdp: offer });
        }
      }, 2000);
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
