import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process: {
  env: Record<string, string | undefined>;
};

export function getMobileSupabaseEnv() {
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function getMobileSupabaseConfigError() {
  const { url, anonKey } = getMobileSupabaseEnv();

  if (!url || !anonKey) {
    return "Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.";
  }

  return "";
}

let mobileSupabaseClient: SupabaseClient | null = null;

export function createMobileSupabaseClient() {
  if (mobileSupabaseClient) return mobileSupabaseClient;

  const { url, anonKey } = getMobileSupabaseEnv();

  if (!url || !anonKey) {
    throw new Error(getMobileSupabaseConfigError());
  }

  mobileSupabaseClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: AsyncStorage,
    },
  });

  return mobileSupabaseClient;
}
