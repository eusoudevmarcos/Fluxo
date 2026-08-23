import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import { oceanMobileTheme } from "../styles/theme";

type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme: string | null;
  aura: string | null;
  location_label: string | null;
  vibe: string | null;
  interests: string[] | null;
  onboarding_completed: boolean | null;
};

type Content = {
  id: string;
  author_id: string;
  content_type: "post" | "flow";
  text: string | null;
  media_url: string | null;
  media_type: "image" | "video" | "none";
  created_at: string;
};

type HomeScreenProps = {
  session: Session;
  onSignOut: () => Promise<void> | void;
};

function normalizeUsername(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^@|^~/, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/[._]{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "");

  return normalized || "fluxo";
}

function getEmailBase(email?: string | null) {
  return normalizeUsername(email?.split("@")[0] ?? "fluxo");
}

function getDisplayDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

async function ensureMobileProfile(session: Session) {
  const supabase = createMobileSupabaseClient();
  const userId = session.user.id;

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "user_id,username,display_name,avatar_url,bio,theme,aura,location_label,vibe,interests,onboarding_completed",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (existingProfile) return existingProfile as Profile;

  const username = getEmailBase(session.user.email);
  const displayName = username;
  const payload = {
    user_id: userId,
    username,
    display_name: displayName,
    avatar_url: null,
    bio: "",
    theme: "sunflow",
    aura: "starter",
    country: "BR",
    updated_at: new Date().toISOString(),
  };

  const { data: createdProfile, error: createError } = await supabase
    .from("profiles")
    .insert(payload)
    .select(
      "user_id,username,display_name,avatar_url,bio,theme,aura,location_label,vibe,interests,onboarding_completed",
    )
    .single();

  if (!createError) return createdProfile as Profile;
  if (createError.code !== "23505") throw createError;

  const retryPayload = {
    ...payload,
    username: `${username}.${Date.now().toString(36).slice(-5)}`,
  };
  const { data: retryProfile, error: retryError } = await supabase
    .from("profiles")
    .insert(retryPayload)
    .select(
      "user_id,username,display_name,avatar_url,bio,theme,aura,location_label,vibe,interests,onboarding_completed",
    )
    .single();

  if (retryError) throw retryError;
  return retryProfile as Profile;
}

export function HomeScreen({ onSignOut, session }: HomeScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadHome = useCallback(async () => {
    const supabase = createMobileSupabaseClient();
    const nextProfile = await ensureMobileProfile(session);

    const { data: contentRows, error: contentsError } = await supabase
      .from("contents")
      .select("id,author_id,content_type,text,media_url,media_type,created_at")
      .eq("author_id", session.user.id)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(12);

    if (contentsError) throw contentsError;

    setProfile(nextProfile);
    setContents((contentRows ?? []) as Content[]);
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setErrorMessage("");
    loadHome()
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel carregar.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadHome]);

  async function refreshHome() {
    setIsRefreshing(true);
    setErrorMessage("");

    try {
      await loadHome();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar.");
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={oceanMobileTheme.primary} size="large" />
      </View>
    );
  }

  const title = profile?.display_name || profile?.username || session.user.email || "Fluxo";
  const handle = profile?.username ? `@${profile.username}` : session.user.email;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={refreshHome}
          refreshing={isRefreshing}
          tintColor={oceanMobileTheme.primary}
        />
      }
      style={styles.screen}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>fluxo</Text>
          <Text style={styles.eyebrow}>Beta nativo conectado</Text>
        </View>
        <Pressable onPress={onSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sair</Text>
        </Pressable>
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{title.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{title}</Text>
          <Text style={styles.handle}>{handle}</Text>
          {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{contents.length}</Text>
          <Text style={styles.statLabel}>Criacoes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{profile?.aura ?? "starter"}</Text>
          <Text style={styles.statLabel}>Aura</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {profile?.onboarding_completed ? "OK" : "Pendente"}
          </Text>
          <Text style={styles.statLabel}>Perfil</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Suas criacoes</Text>
        <Pressable onPress={refreshHome}>
          <Text style={styles.refreshText}>Atualizar</Text>
        </Pressable>
      </View>

      {!contents.length ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nenhuma criacao ainda.</Text>
          <Text style={styles.emptyText}>
            O app ja esta autenticado no banco real. As proximas sprints trazem composer,
            feed e navegacao completa.
          </Text>
        </View>
      ) : (
        contents.map((content) => (
          <View key={content.id} style={styles.contentCard}>
            <View style={styles.contentMeta}>
              <Text style={styles.contentType}>{content.content_type}</Text>
              <Text style={styles.contentDate}>{getDisplayDate(content.created_at)}</Text>
            </View>
            <Text style={styles.contentText} numberOfLines={5}>
              {content.text || (content.media_url ? "Midia publicada" : "Sem legenda")}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: oceanMobileTheme.bg,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 40,
    paddingTop: 58,
  },
  centered: {
    alignItems: "center",
    backgroundColor: oceanMobileTheme.bg,
    flex: 1,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  logo: {
    color: oceanMobileTheme.primary,
    fontSize: 36,
    fontWeight: "900",
  },
  eyebrow: {
    color: oceanMobileTheme.muted,
    fontSize: 13,
    marginTop: 2,
  },
  signOutButton: {
    borderColor: oceanMobileTheme.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  signOutText: {
    color: oceanMobileTheme.text,
    fontWeight: "800",
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    padding: 12,
  },
  profileCard: {
    backgroundColor: oceanMobileTheme.card,
    borderColor: oceanMobileTheme.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(14, 165, 233, 0.18)",
    borderColor: oceanMobileTheme.primary,
    borderRadius: 24,
    borderWidth: 1,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  avatarText: {
    color: oceanMobileTheme.text,
    fontSize: 28,
    fontWeight: "900",
  },
  profileInfo: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
  },
  name: {
    color: oceanMobileTheme.text,
    fontSize: 22,
    fontWeight: "900",
  },
  handle: {
    color: oceanMobileTheme.primary,
    fontSize: 14,
  },
  bio: {
    color: oceanMobileTheme.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    backgroundColor: oceanMobileTheme.card,
    borderColor: oceanMobileTheme.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  statValue: {
    color: oceanMobileTheme.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    color: oceanMobileTheme.muted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: oceanMobileTheme.text,
    fontSize: 20,
    fontWeight: "900",
  },
  refreshText: {
    color: oceanMobileTheme.primary,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: oceanMobileTheme.card,
    borderColor: oceanMobileTheme.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  emptyTitle: {
    color: oceanMobileTheme.text,
    fontSize: 17,
    fontWeight: "900",
  },
  emptyText: {
    color: oceanMobileTheme.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  contentCard: {
    backgroundColor: oceanMobileTheme.card,
    borderColor: oceanMobileTheme.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  contentMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  contentType: {
    color: oceanMobileTheme.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  contentDate: {
    color: oceanMobileTheme.muted,
    fontSize: 12,
  },
  contentText: {
    color: oceanMobileTheme.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
