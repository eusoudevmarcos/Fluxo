import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { BottomNav, type ScreenTab } from "../components/BottomNav";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import { ensureMobileProfile, type Profile } from "../lib/services/profiles.service";
import { CreateScreen } from "./CreateScreen";
import { FeedScreen } from "./FeedScreen";
import { MessagesScreen } from "./MessagesScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { ProfileScreen } from "./ProfileScreen";
import { SearchScreen } from "./SearchScreen";

type HomeScreenProps = {
  session: Session;
  onSignOut: () => Promise<void> | void;
};

export function HomeScreen({ onSignOut, session }: HomeScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<ScreenTab>("home");
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(null);
  const [openConversationWithUserId, setOpenConversationWithUserId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setErrorMessage("");
    ensureMobileProfile(createMobileSupabaseClient(), session)
      .then((nextProfile) => {
        if (!isMounted) return;
        setProfile(nextProfile);
      })
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar seu perfil.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  const openProfile = useCallback(
    (userId: string) => {
      if (userId === session.user.id) {
        setViewedProfileUserId(null);
        setActiveTab("profile");
        return;
      }
      setViewedProfileUserId(userId);
    },
    [session.user.id],
  );

  const handleMessageUser = useCallback((userId: string) => {
    setOpenConversationWithUserId(userId);
    setViewedProfileUserId(null);
    setActiveTab("messages");
  }, []);

  const handleChangeTab = useCallback((tab: ScreenTab) => {
    setViewedProfileUserId(null);
    setActiveTab(tab);
  }, []);

  const handleConsumedOpenConversationRequest = useCallback(() => {
    setOpenConversationWithUserId(null);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ffc400" size="large" />
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{errorMessage}</Text>
      </View>
    );
  }

  if (profile && !profile.profile_required_completed) {
    return (
      <OnboardingScreen
        onComplete={setProfile}
        profile={profile}
        session={session}
      />
    );
  }

  let screen: ReactNode;

  if (viewedProfileUserId) {
    screen = (
      <ProfileScreen
        onBack={() => setViewedProfileUserId(null)}
        onMessageUser={handleMessageUser}
        onSignOut={onSignOut}
        session={session}
        userId={viewedProfileUserId}
      />
    );
  } else if (activeTab === "search") {
    screen = <SearchScreen onOpenProfile={openProfile} />;
  } else if (activeTab === "messages") {
    screen = (
      <MessagesScreen
        onConsumedOpenConversationRequest={handleConsumedOpenConversationRequest}
        onUnreadCountChange={setUnreadMessages}
        openConversationWithUserId={openConversationWithUserId}
        session={session}
      />
    );
  } else if (activeTab === "create") {
    screen = <CreateScreen onCreated={() => setActiveTab("home")} />;
  } else if (activeTab === "profile") {
    screen = (
      <ProfileScreen
        onMessageUser={handleMessageUser}
        onSignOut={onSignOut}
        session={session}
        userId={session.user.id}
      />
    );
  } else {
    screen = <FeedScreen onOpenProfile={openProfile} profile={profile} session={session} />;
  }

  return (
    <View style={styles.app}>
      {screen}
      <BottomNav activeTab={activeTab} onChange={handleChangeTab} unreadMessages={unreadMessages} />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    backgroundColor: "#030711",
    flex: 1,
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#030711",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  error: {
    color: "#fecaca",
    fontSize: 15,
    textAlign: "center",
  },
});
