"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import {
  ensureProfileWithClient,
  getErrorMessage,
  type OceanProfile,
} from "@/lib/profiles/ensure-profile";
import { createClient } from "@/lib/supabase/client";

type ProfileContextValue = {
  user: User | null;
  profile: OceanProfile | null;
  isLoading: boolean;
  error: string;
  refreshProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

type ProfileProviderProps = {
  children: ReactNode;
};

export function ProfileProvider({ children }: ProfileProviderProps) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<OceanProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function refreshProfile() {
    setError("");
    setIsLoading(true);

    try {
      const { data, error: sessionError } = await supabase.auth.getUser();

      if (sessionError) {
        throw sessionError;
      }

      if (!data.user) {
        setUser(null);
        setProfile(null);
        return;
      }

      setUser(data.user);
      const ensuredProfile = await ensureProfileWithClient(supabase);
      setProfile(ensuredProfile);
    } catch (profileError) {
      setError(getErrorMessage(profileError, "Não foi possível carregar seu perfil."));
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      refreshProfile();
    });

    const { data } = supabase.auth.onAuthStateChange(() => {
      refreshProfile();
    });

    return () => {
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return (
    <ProfileContext.Provider
      value={{ user, profile, isLoading, error, refreshProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile precisa estar dentro de ProfileProvider.");
  }

  return context;
}