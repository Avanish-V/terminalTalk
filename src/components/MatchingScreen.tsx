import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const searchLines = [
  "[SEARCHING FOR PEER...]",
  "[SCANNING VERIFIED DOMAINS...]",
  "[FILTERING: TECH INDUSTRY ONLY]",
];

interface MatchingScreenProps {
  onCancel: () => void;
}

const MatchingScreen = ({ onCancel }: MatchingScreenProps) => {
  const [currentLine, setCurrentLine] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine((prev) => (prev + 1) % searchLines.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

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
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
              Scanning network...
            </span>
          </div>
          <button
            onClick={onCancel}
            className="font-mono text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default MatchingScreen;
