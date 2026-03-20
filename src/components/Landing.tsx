import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Zap, Users } from "lucide-react";
import TerminalLog from "./TerminalLog";

const ALLOWED_DOMAINS = [
  "google.com", "meta.com", "apple.com", "microsoft.com", "amazon.com",
  "nvidia.com", "netflix.com", "stripe.com", "github.com", "vercel.com",
  "openai.com", "anthropic.com", "shopify.com", "figma.com", "notion.so",
];

const EDU_PATTERN = /\.edu$/i;

interface LandingProps {
  onStart: (email: string) => void;
}

const Landing = ({ onStart }: LandingProps) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const validateEmail = (e: string) => {
    const domain = e.split("@")[1];
    if (!domain) return false;
    if (EDU_PATTERN.test(domain)) return true;
    return ALLOWED_DOMAINS.some((d) => domain.endsWith(d));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    if (!validateEmail(email)) {
      setError("Only corporate tech or .edu emails are accepted");
      return;
    }
    setError("");
    onStart(email);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Hero */}
      <motion.div
        className="max-w-xl w-full space-y-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Logo */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-terminal-green animate-pulse-green" />
            <span className="font-mono text-xs text-tracking-terminal text-terminal-green">
              Live — 847 engineers online
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
        <div className="bg-surface rounded-lg p-5" style={{ boxShadow: "var(--card-shadow)" }}>
          <TerminalLog />
        </div>

        {/* Email Entry */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="font-mono text-xs text-tracking-terminal text-muted-foreground">
              Verify Your Identity
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="you@company.com"
                className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-terminal-green text-primary-foreground px-6 py-3 rounded-lg font-mono text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Start
                <ArrowRight size={16} />
              </motion.button>
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-destructive text-sm font-mono"
              >
                {error}
              </motion.p>
            )}
          </div>
        </form>

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
