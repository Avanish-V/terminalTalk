import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Zap, Users, LogOut, Clock, Lock } from "lucide-react";
import TerminalLog from "./TerminalLog";
import type { User } from "firebase/auth";

interface LandingProps {
  onStart: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  user: User | null;
  loading: boolean;
  authError: string | null;
}

const Landing = ({ onStart, onSignIn, onSignOut, user, loading, authError }: LandingProps) => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [timeMessage, setTimeMessage] = useState("");

  useEffect(() => {
    const checkAvailability = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const available = import.meta.env.VITE_BYPASS_TIME_RESTRICTION === "true" || (currentHour >= 20 && currentHour < 21); 
      setIsAvailable(available);

      if (!available) {
        const next8PM = new Date(now);
        if (currentHour >= 21) {
            next8PM.setDate(now.getDate() + 1);
        }
        next8PM.setHours(20, 0, 0, 0); 
        
        const diffMs = next8PM.getTime() - now.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffHrs > 0) {
           setTimeMessage(`Starts in ${diffHrs}h ${diffMins}m`);
        } else {
           setTimeMessage(`Starts in ${diffMins}m`);
        }
      }
    };

    checkAvailability();
    const interval = setInterval(checkAvailability, 60000); // Verify every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        className="max-w-xl w-full space-y-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Logo */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-terminal-green animate-pulse-green' : 'bg-muted-foreground'}`} />
            <span className={`font-mono text-xs text-tracking-terminal ${isAvailable ? 'text-terminal-green' : 'text-muted-foreground'}`}>
              {isAvailable ? "Live — 847 engineers online" : "Next Session Starts at 8:00 PM"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold heading-tracking text-foreground">
            Terminal
          </h1>
          <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
            Verified 1:1 video chats for the tech industry. No profiles. No history. Just conversations.
          </p>
        </div>

        {/* Terminal Boot Log */}
        {isAvailable && (
          <div className="bg-surface rounded-lg p-5" style={{ boxShadow: "var(--card-shadow)" }}>
            <TerminalLog />
          </div>
        )}

        {/* Auth Section / Offline Notice */}
        <div className="space-y-4">
          <label className="font-mono text-xs text-tracking-terminal text-muted-foreground">
            {isAvailable ? "Verify Your Identity" : "Daily Matching Event"}
          </label>

          {!isAvailable ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-surface border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-4"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground">
                <Clock size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-mono text-lg text-foreground font-bold tracking-tight">Opens at 8:00 PM</h3>
                <p className="font-mono text-xs text-muted-foreground max-w-[280px]">
                  To guarantee everyone finds a match instantly, Terminal only opens for one hour every day!
                </p>
              </div>
              <div className="flex items-center gap-2 bg-background px-5 py-2.5 rounded-full border border-border mt-2">
                <div className="w-2 h-2 rounded-full bg-terminal-green animate-pulse-green" />
                <span className="font-mono text-sm text-foreground font-medium">
                  {timeMessage}
                </span>
              </div>
            </motion.div>
          ) : loading ? (
            <div className="flex items-center gap-3 py-3">
              <div className="w-4 h-4 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-xs text-muted-foreground">Checking session...</span>
            </div>
          ) : user ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-terminal-green shrink-0" />
                  <span className="font-mono text-sm text-foreground truncate">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={onSignOut}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onStart}
                className="w-full bg-terminal-green text-primary-foreground px-6 py-3 rounded-lg font-mono text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Start Session
                <ArrowRight size={16} />
              </motion.button>
            </div>
          ) : (
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onSignIn}
                className="w-full flex items-center justify-center gap-3 bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-foreground hover:bg-secondary/50 transition-colors"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </motion.button>
              <p className="font-mono text-[11px] text-muted-foreground text-center">
                Sign in with any Google account
              </p>
            </div>
          )}

          {authError && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-destructive text-sm font-mono"
            >
              {authError}
            </motion.p>
          )}
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap gap-4">
          {[
            { icon: <Shield size={14} />, label: "Domain Verified" },
            { icon: <Zap size={14} />, label: "E2E Encrypted" },
            { icon: <Users size={14} />, label: "Tech Only" },
          ].map((feat) => (
            <div
              key={feat.label}
              className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-surface px-3 py-2 rounded-full"
            >
              <span className="text-terminal-green">{feat.icon}</span>
              {feat.label}
            </div>
          ))}
        </div>

        {/* Accepted Domains */}
        <div className="space-y-3">
          <span className="font-mono text-xs text-tracking-terminal text-muted-foreground">
            Accepted Domains
          </span>
          <div className="flex flex-wrap gap-2">
            {["google.com", "meta.com", "nvidia.com", "openai.com", "*.edu"].map((d) => (
              <span
                key={d}
                className="font-mono text-xs bg-surface px-2.5 py-1 rounded text-muted-foreground"
              >
                @{d}
              </span>
            ))}
            <span className="font-mono text-xs text-muted-foreground px-2.5 py-1">
              +15 more
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Landing;
