import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "firebase/auth";

export interface Profile {
  id: string; // we'll use user.uid here
  user_id: string; // we'll keep this redundant for compatibility
  display_name: string;
  age: number;
  gender: string;
  updated_at?: string;
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
    try {
      const docRef = doc(db, "profiles", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as Profile);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error("Error fetching profile:", e);
      setProfile(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const saveProfile = useCallback(
    async (values: { display_name: string; age: number; gender: string }) => {
      if (!user) return;
      const profileData: Profile = {
        id: user.uid,
        user_id: user.uid,
        ...values,
        updated_at: new Date().toISOString(),
      };
      
      try {
        await setDoc(doc(db, "profiles", user.uid), profileData, { merge: true });
        setProfile(profileData);
      } catch (error) {
        console.error("Error saving profile:", error);
        throw error;
      }
    },
    [user]
  );

  return { profile, loading, saveProfile, refetch: fetchProfile };
}
