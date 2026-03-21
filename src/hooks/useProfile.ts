import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  age: number;
  gender: string;
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const saveProfile = useCallback(
    async (values: { display_name: string; age: number; gender: string }) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          { user_id: user.id, ...values, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) throw error;
      setProfile(data);
    },
    [user]
  );

  return { profile, loading, saveProfile, refetch: fetchProfile };
}
