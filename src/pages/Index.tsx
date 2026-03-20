import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "../components/Landing";
import MatchingScreen from "../components/MatchingScreen";
import VideoStage from "../components/VideoStage";
import { useMatchmaking } from "../hooks/useMatchmaking";
import { useAuth } from "../hooks/useAuth";

type AppState = "landing" | "matching" | "connected";

const Index = () => {
  const [state, setState] = useState<AppState>("landing");
  const [peerEmail, setPeerEmail] = useState("");
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState<"offerer" | "answerer">("offerer");

  const { user, loading, error: authError, signInWithGoogle, signOut } = useAuth();
  const { findMatch, stopPolling } = useMatchmaking();

  const userEmail = user?.email || "";

  const handleStart = () => {
    if (!userEmail) return;
    setState("matching");
    findMatch(userEmail, (matchRoomId, peer, matchRole) => {
      setRoomId(matchRoomId);
      setPeerEmail(peer);
      setRole(matchRole);
      setState("connected");
    });
  };

  const handleNext = () => {
    setRoomId("");
    setPeerEmail("");
    setState("matching");
    findMatch(userEmail, (matchRoomId, peer, matchRole) => {
      setRoomId(matchRoomId);
      setPeerEmail(peer);
      setRole(matchRole);
      setState("connected");
    });
  };

  const handleEnd = () => {
    stopPolling();
    setState("landing");
    setPeerEmail("");
    setRoomId("");
  };

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        {state === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Landing
              onStart={handleStart}
              onSignIn={signInWithGoogle}
              user={user}
              loading={loading}
              authError={authError}
              onSignOut={signOut}
            />
          </motion.div>
        )}
        {state === "matching" && (
          <motion.div
            key="matching"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <MatchingScreen onCancel={handleEnd} />
          </motion.div>
        )}
        {state === "connected" && roomId && (
          <motion.div
            key="connected"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <VideoStage
              roomId={roomId}
              role={role}
              peerEmail={peerEmail}
              userEmail={userEmail}
              onNext={handleNext}
              onEnd={handleEnd}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
