import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const lines = [
  { text: "[TERMINAL] Initializing secure connection...", delay: 0 },
  { text: "[TERMINAL] Protocol: WebRTC/E2E Encrypted", delay: 600 },
  { text: "[TERMINAL] Verifying domain authenticity...", delay: 1200 },
  { text: "[TERMINAL] Status: READY", delay: 1800, highlight: true },
];

const TerminalLog = () => {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    lines.forEach((line, i) => {
      setTimeout(() => setVisibleLines(i + 1), line.delay);
    });
  }, []);

  return (
    <div className="font-mono text-xs sm:text-sm space-y-1">
      <AnimatePresence>
        {lines.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className={line.highlight ? "text-terminal-green" : "text-muted-foreground"}
          >
            {line.text}
            {i === visibleLines - 1 && (
              <span className="animate-blink ml-1">▊</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default TerminalLog;
