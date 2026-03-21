import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface ProfileFormProps {
  onSave: (values: { display_name: string; age: number; gender: string }) => Promise<void>;
  email: string;
}

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];

const ProfileForm = ({ onSave, email }: ProfileFormProps) => {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const parsedAge = parseInt(age, 10);

    if (!trimmedName) return setError("Name is required");
    if (trimmedName.length > 100) return setError("Name must be under 100 characters");
    if (!age || isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120) return setError("Enter a valid age (13–120)");
    if (!gender) return setError("Please select a gender");

    setSaving(true);
    try {
      await onSave({ display_name: trimmedName, age: parsedAge, gender });
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-terminal-green animate-pulse-green" />
            <span className="font-mono text-xs text-tracking-terminal text-terminal-green">
              Complete Your Profile
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold heading-tracking text-foreground">
            Almost there
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            Signed in as <span className="text-foreground">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <label className="font-mono text-xs text-tracking-terminal text-muted-foreground">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How others will see you"
              maxLength={100}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terminal-green/50 transition-shadow"
            />
          </div>

          {/* Age */}
          <div className="space-y-2">
            <label className="font-mono text-xs text-tracking-terminal text-muted-foreground">
              Age
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Your age"
              min={13}
              max={120}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terminal-green/50 transition-shadow"
            />
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <label className="font-mono text-xs text-tracking-terminal text-muted-foreground">
              Gender
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGender(opt)}
                  className={`font-mono text-xs px-3 py-2.5 rounded-lg border transition-colors ${
                    gender === opt
                      ? "bg-terminal-green/15 border-terminal-green text-terminal-green"
                      : "bg-surface border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
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

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={saving}
            className="w-full bg-terminal-green text-primary-foreground px-6 py-3 rounded-lg font-mono text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={16} />
              </>
            )}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
};

export default ProfileForm;
