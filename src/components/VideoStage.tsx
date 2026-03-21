import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, SkipForward, Flag, MessageSquare, X } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";

interface VideoStageProps {
  roomId: string;
  role: "offerer" | "answerer";
  peerEmail: string;
  userEmail: string;
  onNext: () => void;
  onEnd: () => void;
}

const VideoStage = ({ roomId, role, peerEmail, userEmail, onNext, onEnd }: VideoStageProps) => {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [peerDisconnected, setPeerDisconnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const { localStream, remoteStream, connectionState, start, cleanup, toggleMic, toggleCam } =
    useWebRTC({
      roomId,
      role,
      onDisconnect: () => {
        setPeerDisconnected(true);
      },
    });

  useEffect(() => {
    start();
    return () => cleanup();
  }, [roomId]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn("Local play block:", e));
    }
  }, [localStream]);

  // Keep a local track count so React UI correctly un-mounts the "Connecting..." overlay immediately.
  const [trackCount, setTrackCount] = useState(0);

  useEffect(() => {
    if (remoteStream) {
      setTrackCount(remoteStream.getTracks().length);
      
      const updateCount = () => {
        setTrackCount(remoteStream.getTracks().length);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(e => console.warn("Track count play kick:", e));
        }
      };

      remoteStream.addEventListener("addtrack", updateCount);
      remoteStream.addEventListener("removetrack", updateCount);
      
      return () => {
        remoteStream.removeEventListener("addtrack", updateCount);
        remoteStream.removeEventListener("removetrack", updateCount);
      }
    } else {
      setTrackCount(0);
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(e => console.warn("Autoplay remote video block:", e));
      }
    }
  }, [remoteStream]);

  const handleMicToggle = () => {
    const next = !micOn;
    setMicOn(next);
    toggleMic(next);
  };

  const handleCamToggle = () => {
    const next = !camOn;
    setCamOn(next);
    toggleCam(next);
  };

  const handleNext = () => {
    cleanup(true);
    onNext();
  };

  const handleEnd = () => {
    cleanup(true);
    onEnd();
  };

  const peerOrg = peerEmail.split("@")[1]?.split(".")[0]?.toUpperCase() || "PEER";
  const userOrg = userEmail.split("@")[1]?.split(".")[0]?.toUpperCase() || "YOU";

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Video Grid */}
      <div className="flex-1 grid grid-rows-2 md:grid-rows-1 md:grid-cols-2 gap-2 p-2 md:gap-6 md:p-6 max-w-5xl mx-auto w-full min-h-0">
        {/* Peer Video */}
        <motion.div
          className="relative bg-surface rounded-lg overflow-hidden flex items-center justify-center"
          style={{ boxShadow: "var(--card-shadow)" }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          {trackCount === 0 && (
            <div className="absolute inset-4 bg-card rounded-[var(--radius-inner)] flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="font-mono text-2xl md:text-4xl font-semibold text-terminal-green heading-tracking">
                  {peerOrg}
                </div>
                <div className="font-mono text-xs text-muted-foreground text-tracking-terminal">
                  {connectionState === "connected" ? "Camera Connected" : "Connecting..."}
                </div>
              </div>
            </div>
          )}
          <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4 z-10">
            <div className="bg-terminal-green-glow border border-terminal-green/30 rounded-full px-3 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-terminal-green animate-pulse-green" />
              <span className="font-mono text-[10px] md:text-xs text-terminal-green text-tracking-terminal">
                {peerEmail}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Your Video */}
        <motion.div
          className="relative bg-surface rounded-lg overflow-hidden flex items-center justify-center"
          style={{ boxShadow: "var(--card-shadow)" }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
          {!localStream && (
            <div className="absolute inset-4 bg-card rounded-[var(--radius-inner)] flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="font-mono text-xl md:text-4xl font-semibold text-foreground heading-tracking">
                  {userOrg}
                </div>
                <div className="font-mono text-xs text-muted-foreground text-tracking-terminal">
                  Starting Camera...
                </div>
              </div>
            </div>
          )}
          <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4 z-10">
            <div className="bg-secondary/80 rounded-full px-2 py-1 md:px-3 md:py-1.5">
              <span className="font-mono text-[10px] md:text-xs text-muted-foreground">YOU</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Disconnected Overlay */}
      {peerDisconnected && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <div className="bg-card border border-border p-6 md:p-8 rounded-[var(--radius)] shadow-xl text-center space-y-5 max-w-sm w-full">
            <div className="mx-auto w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
              <VideoOff size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="font-mono text-xl text-foreground font-semibold">User Disconnected</h3>
              <p className="text-sm text-muted-foreground font-mono">The peer has left the session or lost connection.</p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={handleEnd}
                className="flex-1 px-4 py-2.5 rounded-[var(--radius-inner)] border border-border text-foreground hover:bg-secondary font-mono text-sm transition-colors"
              >
                Go Home
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2.5 rounded-[var(--radius-inner)] bg-terminal-green text-primary-foreground font-mono text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <SkipForward size={16} />
                Find Next
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Chat overlay */}
      {chatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 right-3 left-3 sm:left-auto sm:w-80 bg-surface rounded-lg overflow-hidden z-20"
          style={{ boxShadow: "var(--card-shadow)" }}
        >
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="font-mono text-xs text-tracking-terminal text-muted-foreground">Text Chat</span>
            <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          <div className="h-48 p-3 text-sm text-muted-foreground flex items-center justify-center">
            <span className="font-mono text-xs">No messages yet</span>
          </div>
          <div className="p-3 border-t border-border">
            <input
              className="w-full bg-card rounded-[var(--radius-inner)] px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              placeholder="Type a message..."
            />
          </div>
        </motion.div>
      )}

      {/* HUD Controls */}
      <div className="p-2 sm:p-4 flex justify-center">
        <motion.div
          className="flex items-center gap-1.5 sm:gap-2 bg-surface/80 backdrop-blur-md rounded-full px-3 py-2.5 sm:px-4 sm:py-3"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05) inset, 0 -4px 12px rgba(0,0,0,0.3)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ControlButton
            icon={micOn ? <Mic size={18} /> : <MicOff size={18} />}
            active={micOn}
            onClick={handleMicToggle}
            label={micOn ? "Mute" : "Unmute"}
          />
          <ControlButton
            icon={camOn ? <Video size={18} /> : <VideoOff size={18} />}
            active={camOn}
            onClick={handleCamToggle}
            label={camOn ? "Camera Off" : "Camera On"}
          />
          <ControlButton
            icon={<MessageSquare size={18} />}
            active={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
            label="Chat"
          />

          <div className="w-px h-8 bg-border mx-0.5 sm:mx-1" />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "tween", ease: [0.4, 0, 0.2, 1] }}
            onClick={handleNext}
            className="flex items-center gap-1.5 bg-terminal-green text-primary-foreground font-mono text-xs sm:text-sm font-medium px-3 sm:px-5 py-2 sm:py-2.5 rounded-full hover:opacity-90 transition-opacity"
          >
            <SkipForward size={14} />
            <span className="hidden sm:inline">Next</span>
          </motion.button>

          <div className="w-px h-8 bg-border mx-0.5 sm:mx-1" />

          <ControlButton
            icon={<Flag size={18} />}
            onClick={() => {}}
            label="Report"
            danger
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEnd}
            className="bg-destructive text-destructive-foreground font-mono text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 sm:py-2.5 rounded-full hover:opacity-90 transition-opacity"
          >
            End
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

const ControlButton = ({
  icon,
  active,
  onClick,
  label,
  danger,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`relative p-2.5 rounded-full transition-colors ${
      danger
        ? "text-destructive hover:bg-destructive/10"
        : active
        ? "text-foreground bg-secondary"
        : "text-muted-foreground hover:bg-secondary"
    }`}
    title={label}
  >
    {icon}
  </motion.button>
);

export default VideoStage;
