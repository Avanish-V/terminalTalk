import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

export function useWebRTC({ roomId, role, onDisconnect }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>("new");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("closed");
  }, []);

  const start = useCallback(async () => {
    // Get local media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);

    // Create peer connection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Add local tracks
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Handle remote tracks
    const remote = new MediaStream();
    setRemoteStream(remote);
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remote.addTrack(track);
      });
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        onDisconnect?.();
      }
    };

    // Signaling via Supabase Realtime Broadcast
    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate.toJSON() },
        });
      }
    };

    channel.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      if (payload?.candidate && pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(payload.candidate)
          );
        } catch (e) {
          console.warn("Failed to add ICE candidate:", e);
        }
      }
    });

    channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload?.sdp && pcRef.current) {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.sdp)
        );
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "answer",
          payload: { sdp: answer },
        });
      }
    });

    channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload?.sdp && pcRef.current) {
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.sdp)
        );
      }
    });

    // Offerer waits for answerer's ready signal before sending offer
    if (role === "offerer") {
      channel.on("broadcast", { event: "ready" }, async () => {
        if (pcRef.current && !pcRef.current.localDescription) {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          channel.send({
            type: "broadcast",
            event: "offer",
            payload: { sdp: offer },
          });
        }
      });
    }

    await channel.subscribe();

    // Answerer signals readiness; offerer also sends a ping in case answerer was first
    if (role === "answerer") {
      channel.send({ type: "broadcast", event: "ready", payload: {} });
    } else {
      // In case answerer is already subscribed, send offer after a short delay as fallback
      setTimeout(async () => {
        if (pcRef.current && !pcRef.current.localDescription) {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          channel.send({
            type: "broadcast",
            event: "offer",
            payload: { sdp: offer },
          });
        }
      }, 2000);
    }
  }, [roomId, role, onDisconnect]);

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
