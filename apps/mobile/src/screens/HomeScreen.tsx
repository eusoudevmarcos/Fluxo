import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from "react-native";

import { BottomNav, type ScreenTab } from "../components/BottomNav";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import { addPushTapListener, registerForPushNotifications } from "../lib/push";
import { hasAcceptedCurrentLegalVersions } from "../lib/services/legal.service";
import { countMyUnreadNotifications } from "../lib/services/notifications.service";
import { ensureMobileProfile, type Profile } from "../lib/services/profiles.service";
import { BlockedUsersScreen } from "./BlockedUsersScreen";
import { CreateScreen } from "./CreateScreen";
import { FeedbackScreen } from "./FeedbackScreen";
import { CreatorProgramScreen } from "./CreatorProgramScreen";
import { FeedScreen } from "./FeedScreen";
import { InvitesScreen } from "./InvitesScreen";
import { LegalAcceptScreen } from "./LegalAcceptScreen";
import { MessagesScreen } from "./MessagesScreen";
import { MissionsScreen } from "./MissionsScreen";
import { NotificationsScreen } from "./NotificationsScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { ProfileScreen } from "./ProfileScreen";
import { SearchScreen } from "./SearchScreen";
import { WalletScreen } from "./WalletScreen";

type HomeScreenProps = {
  session: Session;
  onSignOut: () => Promise<void> | void;
};

export function HomeScreen({ onSignOut, session }: HomeScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<ScreenTab>("home");
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(null);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);
  const [isCreatorProgramOpen, setIsCreatorProgramOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isBlockedUsersOpen, setIsBlockedUsersOpen] = useState(false);
  const [openConversationWithUserId, setOpenConversationWithUserId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Contador de notificacoes: consulta ao abrir e a cada 30 s (o Realtime nao roda no Render;
  // o push avisa com o app fechado).
  useEffect(() => {
    const supabase = createMobileSupabaseClient();
    let isMounted = true;

    const refresh = () =>
      countMyUnreadNotifications(supabase).then((count) => {
        if (isMounted) setUnreadNotifications(count);
      });

    void refresh();
    const timer = setInterval(() => void refresh(), 30000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [session.user.id]);

  const handleNotificationsRead = useCallback(() => setUnreadNotifications(0), []);

  // Push: registra o aparelho depois do onboarding (o pedido de permissao nao aparece no meio
  // do cadastro) e abre a lista de notificacoes quando a pessoa toca num push.
  const isProfileReady = Boolean(profile?.profile_required_completed);

  useEffect(() => {
    if (!isProfileReady) return;
    registerForPushNotifications(createMobileSupabaseClient()).catch(() => undefined);
  }, [isProfileReady]);

  useEffect(
    () =>
      addPushTapListener(() => {
        setViewedProfileUserId(null);
        setIsNotificationsOpen(true);
      }),
    [],
  );

  // Abre uma tela a partir das notificacoes, fechando a lista.
  const openFromNotifications = useCallback((open: () => void) => {
    setIsNotificationsOpen(false);
    open();
  }, []);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setErrorMessage("");
    const supabase = createMobileSupabaseClient();
    Promise.all([ensureMobileProfile(supabase, session), hasAcceptedCurrentLegalVersions(supabase)])
      .then(([nextProfile, accepted]) => {
        if (!isMounted) return;
        setProfile(nextProfile);
        setHasAcceptedLegal(accepted);
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
    setIsMissionsOpen(false);
    setIsWalletOpen(false);
    setIsInvitesOpen(false);
    setIsCreatorProgramOpen(false);
    setIsNotificationsOpen(false);
    setIsFeedbackOpen(false);
    setIsBlockedUsersOpen(false);
    setActiveTab(tab);
  }, []);

  // Botao voltar do Android fecha a tela sobreposta (na mesma ordem em que elas aparecem) e
  // volta para o Inicio antes de sair do app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (viewedProfileUserId) {
        setViewedProfileUserId(null);
        return true;
      }
      if (isWalletOpen) {
        setIsWalletOpen(false);
        return true;
      }
      if (isFeedbackOpen) {
        setIsFeedbackOpen(false);
        return true;
      }
      if (isBlockedUsersOpen) {
        setIsBlockedUsersOpen(false);
        return true;
      }
      if (isCreatorProgramOpen) {
        setIsCreatorProgramOpen(false);
        return true;
      }
      if (isInvitesOpen) {
        setIsInvitesOpen(false);
        return true;
      }
      if (isMissionsOpen) {
        setIsMissionsOpen(false);
        return true;
      }
      if (isNotificationsOpen) {
        setIsNotificationsOpen(false);
        return true;
      }
      if (activeTab !== "home") {
        setActiveTab("home");
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [
    activeTab,
    isBlockedUsersOpen,
    isFeedbackOpen,
    isCreatorProgramOpen,
    isInvitesOpen,
    isMissionsOpen,
    isNotificationsOpen,
    isWalletOpen,
    viewedProfileUserId,
  ]);

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

  if (!hasAcceptedLegal) {
    return <LegalAcceptScreen onAccepted={() => setHasAcceptedLegal(true)} onSignOut={onSignOut} />;
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
    // Vem antes das telas sobrepostas para que abrir um amigo a partir de Convites funcione.
    screen = (
      <ProfileScreen
        onBack={() => setViewedProfileUserId(null)}
        onMessageUser={handleMessageUser}
        onSignOut={onSignOut}
        session={session}
        userId={viewedProfileUserId}
      />
    );
  } else if (isWalletOpen) {
    screen = <WalletScreen onBack={() => setIsWalletOpen(false)} />;
  } else if (isFeedbackOpen) {
    screen = <FeedbackScreen onBack={() => setIsFeedbackOpen(false)} />;
  } else if (isBlockedUsersOpen) {
    screen = <BlockedUsersScreen onBack={() => setIsBlockedUsersOpen(false)} />;
  } else if (isCreatorProgramOpen) {
    screen = <CreatorProgramScreen onBack={() => setIsCreatorProgramOpen(false)} />;
  } else if (isInvitesOpen) {
    screen = (
      <InvitesScreen onBack={() => setIsInvitesOpen(false)} onOpenProfile={openProfile} />
    );
  } else if (isMissionsOpen) {
    screen = (
      <MissionsScreen
        onBack={() => setIsMissionsOpen(false)}
        onOpenInvites={() => setIsInvitesOpen(true)}
        onOpenWallet={() => setIsWalletOpen(true)}
      />
    );
  } else if (isNotificationsOpen) {
    screen = (
      <NotificationsScreen
        onBack={() => setIsNotificationsOpen(false)}
        onOpenCreatorProgram={() => openFromNotifications(() => setIsCreatorProgramOpen(true))}
        onOpenInvites={() => openFromNotifications(() => setIsInvitesOpen(true))}
        onOpenMissions={() => openFromNotifications(() => setIsMissionsOpen(true))}
        onOpenOwnProfile={() => openFromNotifications(() => setActiveTab("profile"))}
        onOpenProfile={openProfile}
        onRead={handleNotificationsRead}
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
        onOpenBlockedUsers={() => setIsBlockedUsersOpen(true)}
        onOpenCreatorProgram={() => setIsCreatorProgramOpen(true)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenInvites={() => setIsInvitesOpen(true)}
        onOpenMissions={() => setIsMissionsOpen(true)}
        onSignOut={onSignOut}
        session={session}
        userId={session.user.id}
      />
    );
  } else {
    screen = (
      <FeedScreen
        onOpenMissions={() => setIsMissionsOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenProfile={openProfile}
        profile={profile}
        session={session}
        unreadNotifications={unreadNotifications}
      />
    );
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
