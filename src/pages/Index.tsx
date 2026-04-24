import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "../components/Landing";
import ProfileForm from "../components/ProfileForm";
import MatchingScreen from "../components/MatchingScreen";
import VideoStage from "../components/VideoStage";
import { useMatchmaking } from "../hooks/useMatchmaking";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";

type AppState = "landing" | "profile" | "matching" | "connected";

const Index = () => {
  const [state, setState] = useState<AppState>("landing");
  const [peerEmail, setPeerEmail] = useState("");
  const [peerName, setPeerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState<"offerer" | "answerer">("offerer");
  const [timeError, setTimeError] = useState<string | null>(null);

  const { user, loading, error: authError, signInWithGoogle, signOut } = useAuth();
  const { profile, loading: profileLoading, saveProfile } = useProfile(user);
  const { findMatch, stopPolling } = useMatchmaking();

  const userEmail = user?.email || "";

  const isTimeValid = () => {
    if (import.meta.env.VITE_BYPASS_TIME_RESTRICTION === "true") return true;
    const currentHour = new Date().getHours();
    return currentHour >= 20 && currentHour < 21;
  };

  const handleSignIn = () => {
    if (!isTimeValid()) {
      setTimeError("Service is only available between 8 PM and 9 PM.");
      return;
    }
    setTimeError(null);
    signInWithGoogle();
  };

  const handleStart = () => {
    if (!isTimeValid()) {
      setTimeError("Service is only available between 8 PM and 9 PM.");
      return;
    }
    setTimeError(null);
    if (!userEmail) return;
    if (!profile) {
      setState("profile");
      return;
    }
    startMatching();
  };

  const startMatching = () => {
    setState("matching");
    findMatch(userEmail, profile?.display_name || "Stranger", (matchRoomId, peer, matchPeerName, matchRole) => {
      setRoomId(matchRoomId);
      setPeerEmail(peer);
      setPeerName(matchPeerName || "Stranger");
      setRole(matchRole);
      setState("connected");
    });
  };

  const handleProfileSave = async (values: { display_name: string; age: number; gender: string }) => {
    await saveProfile(values);
    startMatching();
  };

  const handleNext = async () => {
    if (!isTimeValid()) {
      handleEnd();
      alert("Service is only available between 8 PM and 9 PM. The session has ended.");
      return;
    }

    await stopPolling();
    setRoomId("");
    setPeerEmail("");
    setPeerName("");
    setState("matching");
    findMatch(userEmail, profile?.display_name || "Stranger", (matchRoomId, peer, matchPeerName, matchRole) => {
      setRoomId(matchRoomId);
      setPeerEmail(peer);
      setPeerName(matchPeerName || "Stranger");
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
              onSignIn={handleSignIn}
              user={user}
              loading={loading || profileLoading}
              authError={authError || timeError}
              onSignOut={signOut}
            />
          </motion.div>
        )}
        {state === "profile" && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ProfileForm onSave={handleProfileSave} email={userEmail} />
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
              peerName={peerName}
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
