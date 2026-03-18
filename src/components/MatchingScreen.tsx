import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const searchLines = [
  "[SEARCHING FOR PEER...]",
  "[SCANNING VERIFIED DOMAINS...]",
  "[FILTERING: TECH INDUSTRY ONLY]",
];

const MatchingScreen = ({ onMatched }: { onMatched: (domain: string) => void }) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine((prev) => (prev + 1) % searchLines.length);
    }, 1200);

    const matchTimer = setTimeout(() => {
      clearInterval(interval);
      setMatched(true);
      setTimeout(() => onMatched("engineer@nvidia.com"), 1500);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(matchTimer);
    };
  }, [onMatched]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <motion.div
        className="bg-surface rounded-lg p-8 max-w-md w-full"
        style={{ boxShadow: "var(--card-shadow)" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="font-mono text-sm space-y-3">
          <AnimatePresence mode="wait">
            {!matched ? (
              <motion.div
                key={currentLine}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-terminal-green"
              >
                {searchLines[currentLine]}
                <span className="animate-blink ml-1">▊</span>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <div className="text-terminal-green">[DOMAIN VERIFIED: NVIDIA.COM]</div>
                <div className="text-terminal-green font-semibold">[MATCH FOUND]</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scanning animation */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-terminal-green"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {matched ? "Establishing connection..." : "Scanning network..."}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default MatchingScreen;
