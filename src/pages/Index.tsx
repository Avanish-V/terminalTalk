import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "../components/Landing";
import MatchingScreen from "../components/MatchingScreen";
import VideoStage from "../components/VideoStage";

type AppState = "landing" | "matching" | "connected";

const Index = () => {
  const [state, setState] = useState<AppState>("landing");
  const [userEmail, setUserEmail] = useState("");
  const [peerDomain, setPeerDomain] = useState("");

  const handleStart = (email: string) => {
    setUserEmail(email);
    setState("matching");
  };

  const handleMatched = useCallback((peer: string) => {
    setPeerDomain(peer);
    setState("connected");
  }, []);

  const handleNext = () => {
    setState("matching");
    setPeerDomain("");
  };

  const handleEnd = () => {
    setState("landing");
    setUserEmail("");
    setPeerDomain("");
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
            <Landing onStart={handleStart} />
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
            <MatchingScreen onMatched={handleMatched} />
          </motion.div>
        )}
        {state === "connected" && (
          <motion.div
            key="connected"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <VideoStage
              peerDomain={peerDomain}
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
