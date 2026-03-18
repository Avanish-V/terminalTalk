import { useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, SkipForward, Flag, MessageSquare, X } from "lucide-react";

interface VideoStageProps {
  peerDomain: string;
  userEmail: string;
  onNext: () => void;
  onEnd: () => void;
}

const VideoStage = ({ peerDomain, userEmail, onNext, onEnd }: VideoStageProps) => {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  const peerOrg = peerDomain.split("@")[1]?.split(".")[0]?.toUpperCase() || "UNKNOWN";
  const userOrg = userEmail.split("@")[1]?.split(".")[0]?.toUpperCase() || "YOU";

  return (
    <div className="flex flex-col h-screen">
      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 md:p-6 max-w-5xl mx-auto w-full">
        {/* Peer Video */}
        <motion.div
          className="relative bg-surface rounded-lg overflow-hidden flex items-center justify-center"
          style={{ boxShadow: "var(--card-shadow)" }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="absolute inset-4 bg-card rounded-inner flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="font-mono text-2xl md:text-4xl font-semibold text-terminal-green heading-tracking">
                {peerOrg}
              </div>
              <div className="font-mono text-xs text-muted-foreground text-tracking-terminal">
                Camera Connected
              </div>
            </div>
          </div>
          {/* Verified badge */}
          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-terminal-green-glow border border-terminal-green/30 rounded-full px-3 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-terminal-green animate-pulse-green" />
              <span className="font-mono text-xs text-terminal-green text-tracking-terminal">
                {peerDomain}
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
          <div className="absolute inset-4 bg-card rounded-inner flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="font-mono text-2xl md:text-4xl font-semibold text-foreground heading-tracking">
                {userOrg}
              </div>
              <div className="font-mono text-xs text-muted-foreground text-tracking-terminal">
                {camOn ? "Camera On" : "Camera Off"}
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-secondary/80 rounded-full px-3 py-1.5">
              <span className="font-mono text-xs text-muted-foreground">YOU</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Chat overlay */}
      {chatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 right-4 w-80 bg-surface rounded-lg overflow-hidden z-20"
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
              className="w-full bg-card rounded-inner px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              placeholder="Type a message..."
            />
          </div>
        </motion.div>
      )}

      {/* HUD Controls */}
      <div className="p-4 flex justify-center">
        <motion.div
          className="flex items-center gap-2 bg-surface/80 backdrop-blur-md rounded-full px-4 py-3"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05) inset, 0 -4px 12px rgba(0,0,0,0.3)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ControlButton
            icon={micOn ? <Mic size={18} /> : <MicOff size={18} />}
            active={micOn}
            onClick={() => setMicOn(!micOn)}
            label={micOn ? "Mute" : "Unmute"}
          />
          <ControlButton
            icon={camOn ? <Video size={18} /> : <VideoOff size={18} />}
            active={camOn}
            onClick={() => setCamOn(!camOn)}
            label={camOn ? "Camera Off" : "Camera On"}
          />
          <ControlButton
            icon={<MessageSquare size={18} />}
            active={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
            label="Chat"
          />

          <div className="w-px h-8 bg-border mx-1" />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "tween", ease: [0.4, 0, 0.2, 1] }}
            onClick={onNext}
            className="flex items-center gap-2 bg-terminal-green text-primary-foreground font-mono text-sm font-medium px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
          >
            <SkipForward size={16} />
            <span className="hidden sm:inline">Next</span>
          </motion.button>

          <div className="w-px h-8 bg-border mx-1" />

          <ControlButton
            icon={<Flag size={18} />}
            onClick={() => {}}
            label="Report"
            danger
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onEnd}
            className="bg-destructive text-destructive-foreground font-mono text-sm font-medium px-4 py-2.5 rounded-full hover:opacity-90 transition-opacity"
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
