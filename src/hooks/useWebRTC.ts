import { useRef, useState, useCallback, useEffect } from "react";
import { ref, push, onChildAdded, off, onDisconnect, remove } from "firebase/database";
import { rtdb } from "@/lib/firebase";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
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

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // Cleanup room data manually if we're leaving gracefully
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    remove(roomRef).catch(console.error);

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("closed");
  }, [roomId]);

  const sendEvent = useCallback(async (event: string, payload: any) => {
    try {
      const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
      await push(messagesRef, {
        event,
        payload,
        sender: role,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("Error sending signal event:", e);
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
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Handle remote tracks
    pc.ontrack = (event) => {
      setRemoteStream((prevStream) => {
        // We MUST use the browser's native stream instance directly and keep it stable!
        // Re-creating MediaStreams can stall playback.
        if (event.streams && event.streams.length > 0) {
          return event.streams[0];
        }
        
        // Fallback if browser doesn't send streams[]
        if (prevStream) {
          if (!prevStream.getTracks().includes(event.track)) {
            prevStream.addTrack(event.track);
          }
          return prevStream; // Keep same reference
        }
        
        return new MediaStream([event.track]);
      });
    };

    pc.onconnectionstatechange = () => {
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
        sendEvent("ice-candidate", { candidate: event.candidate.toJSON() });
      }
    };

    // Signaling via Realtime Database
    const messagesRef = ref(rtdb, `rooms/${roomId}/messages`);
    const onMessageAdded = onChildAdded(messagesRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data || data.sender === role) return;

      switch (data.event) {
        case "ice-candidate":
          if (data.payload?.candidate && pcRef.current) {
            const candidateList = pendingCandidates.current;
            if (pcRef.current.remoteDescription) {
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(data.payload.candidate));
              } catch (e) {
                console.warn("Failed to add ICE candidate:", e);
              }
            } else {
              candidateList.push(data.payload.candidate);
            }
          }
          break;

        case "offer":
          if (data.payload?.sdp && pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.payload.sdp));
            // Flush any pending candidates
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
          if (data.payload?.sdp && pcRef.current) {
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
      sendEvent("ready", {});
    } else {
      // In case answerer is already subscribed, send offer after a short delay as fallback
      setTimeout(async () => {
        if (pcRef.current && !pcRef.current.localDescription) {
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
