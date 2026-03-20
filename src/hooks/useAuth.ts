import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User } from "@supabase/supabase-js";

const ALLOWED_DOMAINS = [
  "google.com", "meta.com", "apple.com", "microsoft.com", "amazon.com",
  "nvidia.com", "netflix.com", "stripe.com", "github.com", "vercel.com",
  "openai.com", "anthropic.com", "shopify.com", "figma.com", "notion.so",
];

const EDU_PATTERN = /\.edu$/i;

function isAllowedDomain(email: string): boolean {
  const domain = email.split("@")[1];
  if (!domain) return false;
  if (EDU_PATTERN.test(domain)) return true;
  return ALLOWED_DOMAINS.some((d) => domain.endsWith(d));
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        if (u?.email && !isAllowedDomain(u.email)) {
          await supabase.auth.signOut();
          setUser(null);
          setError("Only corporate tech or .edu emails are accepted");
        } else {
          setUser(u);
          setError(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      if (u?.email && !isAllowedDomain(u.email)) {
        supabase.auth.signOut();
        setUser(null);
        setError("Only corporate tech or .edu emails are accepted");
      } else {
        setUser(u);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      setError(error.message || "Failed to sign in with Google");
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, error, signInWithGoogle, signOut };
}
