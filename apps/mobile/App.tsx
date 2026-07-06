import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  createMobileSupabaseClient,
  getMobileSupabaseConfigError,
} from "./src/lib/supabase/client";
import { AuthScreen } from "./src/screens/AuthScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { oceanMobileTheme } from "./src/styles/theme";

export default function App() {
  const configError = useMemo(() => getMobileSupabaseConfigError(), []);
  const [isLoading, setIsLoading] = useState(!configError);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (configError) return undefined;

    const supabase = createMobileSupabaseClient();
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configError]);

  async function handleSignOut() {
    await createMobileSupabaseClient().auth.signOut();
  }

  if (configError) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <Text style={styles.logo}>wave</Text>
        <Text style={styles.message}>{configError}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <StatusBar style="light" />
        <ActivityIndicator color={oceanMobileTheme.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {session ? (
        <HomeScreen onSignOut={handleSignOut} session={session} />
      ) : (
        <AuthScreen />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: oceanMobileTheme.bg,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    color: oceanMobileTheme.primary,
    fontSize: 42,
    fontWeight: "900",
  },
  message: {
    color: oceanMobileTheme.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
