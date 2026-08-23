import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
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

type ScreenTab = "home" | "search" | "create" | "messages" | "profile" | "other";

const heroImage =
  "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=1200&q=85";

const galleryImages = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1520454974749-611b7248ffdb?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=700&q=80",
];

const highlightItems = ["Novo", "Trips", "Surfs", "Treinos", "Vida", "Momentos"];

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

function getProfileName(profile: Profile | null, session: Session) {
  return profile?.display_name || profile?.username || session.user.email || "Fluxo";
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
  const payload = {
    user_id: userId,
    username,
    display_name: username,
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

function Avatar({ profile, label, large = false }: { profile?: Profile | null; label: string; large?: boolean }) {
  return (
    <View style={[styles.avatarFrame, large && styles.avatarFrameLarge]}>
      {profile?.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={[styles.avatarImage, large && styles.avatarImageLarge]} />
      ) : (
        <View style={[styles.avatarFallback, large && styles.avatarFallbackLarge]}>
          <Text style={[styles.avatarText, large && styles.avatarTextLarge]}>
            {label.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: ScreenTab; onChange: (tab: ScreenTab) => void }) {
  return (
    <View style={styles.bottomNav}>
      <Pressable onPress={() => onChange("home")} style={styles.navItem}>
        <Text style={[styles.navIcon, activeTab === "home" && styles.navActive]}>⌂</Text>
        <Text style={[styles.navLabel, activeTab === "home" && styles.navActive]}>Inicio</Text>
      </Pressable>
      <Pressable onPress={() => onChange("search")} style={styles.navItem}>
        <Text style={[styles.navIcon, activeTab === "search" && styles.navActive]}>⌕</Text>
      </Pressable>
      <Pressable onPress={() => onChange("create")} style={styles.createButton}>
        <Text style={styles.createIcon}>＋</Text>
      </Pressable>
      <Pressable onPress={() => onChange("messages")} style={styles.navItem}>
        <View>
          <Text style={[styles.navIcon, activeTab === "messages" && styles.navActive]}>▱</Text>
          <Text style={styles.badge}>3</Text>
        </View>
        <Text style={[styles.navLabel, activeTab === "messages" && styles.navActive]}>Mensagens</Text>
      </Pressable>
      <Pressable onPress={() => onChange("profile")} style={styles.navItem}>
        <Text style={[styles.navIcon, activeTab === "profile" && styles.navActive]}>♙</Text>
        <Text style={[styles.navLabel, activeTab === "profile" && styles.navActive]}>Perfil</Text>
      </Pressable>
    </View>
  );
}

function ImmersiveHome({ profile, session }: { profile: Profile | null; session: Session }) {
  const title = getProfileName(profile, session);

  return (
    <ImageBackground source={{ uri: heroImage }} resizeMode="cover" style={styles.immersive}>
      <View style={styles.scrim} />
      <View style={styles.topBar}>
        <Text style={styles.brand}>fluxo</Text>
        <View style={styles.topActions}>
          <Text style={styles.bell}>♢</Text>
          <View style={styles.miniAvatar}>
            <Text style={styles.miniAvatarText}>{title.slice(0, 1).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        <Text style={[styles.tab, styles.tabActive]}>Flow</Text>
        <Text style={styles.tab}>Momentum</Text>
        <Text style={styles.tab}>Discover</Text>
      </View>

      <View style={styles.sideActions}>
        <View style={styles.actionPill}>
          <Text style={styles.actionEmoji}>👊</Text>
          <Text style={styles.actionName}>Dahora</Text>
          <Text style={styles.actionValue}>12,4k</Text>
        </View>
        <View style={styles.actionPill}>
          <Text style={styles.actionEmoji}>☰</Text>
          <Text style={styles.actionValue}>256</Text>
        </View>
        <View style={[styles.actionPill, styles.wavePill]}>
          <Text style={styles.actionEmoji}>◒</Text>
          <Text style={styles.actionName}>Wave</Text>
          <Text style={styles.actionValue}>1,2k</Text>
        </View>
        <View style={styles.actionPill}>
          <Text style={styles.actionEmoji}>◉</Text>
          <Text style={styles.actionName}>Presenca</Text>
          <Text style={styles.actionValue}>18,6k</Text>
        </View>
      </View>

      <View style={styles.flowCaption}>
        <View style={styles.authorRow}>
          <Avatar profile={profile} label={title} />
          <Text style={styles.authorName}>@{profile?.username || "gabriel"} ✹ · 2h</Text>
        </View>
        <Text style={styles.flowText}>Nada como terminar o dia nesse flow 🌊</Text>
        <Text style={styles.flowText}>Viver o agora e sentir cada detalhe.</Text>
        <Text style={styles.tags}>#fluxo #surf #vibe #flow</Text>
        <View style={styles.musicChip}>
          <Text style={styles.musicIcon}>♫</Text>
          <View>
            <Text style={styles.musicTitle}>Good Days</Text>
            <Text style={styles.musicArtist}>SZA</Text>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

function Highlights() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
      {highlightItems.map((item, index) => (
        <View key={item} style={styles.highlightItem}>
          <View style={styles.highlightThumb}>
            {index === 0 ? (
              <Text style={styles.highlightPlus}>＋</Text>
            ) : (
              <Image source={{ uri: galleryImages[(index - 1) % galleryImages.length] }} style={styles.highlightImage} />
            )}
          </View>
          <Text style={styles.highlightLabel}>{item}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ProfileScreen({
  isOther,
  onSignOut,
  profile,
  session,
}: {
  isOther?: boolean;
  onSignOut?: () => Promise<void> | void;
  profile: Profile | null;
  session: Session;
}) {
  const selfName = getProfileName(profile, session);
  const name = isOther ? "Gabriel" : selfName;
  const username = isOther ? "gabriel" : profile?.username || "seuperfil";
  const location = profile?.location_label || "Rio de Janeiro, Brasil";

  return (
    <ScrollView style={styles.profileScreen} contentContainerStyle={styles.profileContent}>
      <View style={styles.profileTop}>
        <Text style={styles.brandSmall}>fluxo</Text>
        <Pressable onPress={isOther ? undefined : onSignOut} style={styles.settingsButton}>
          <Text style={styles.settingsText}>{isOther ? "•••" : "⚙"}</Text>
        </Pressable>
      </View>

      <View style={styles.profileIntro}>
        <Avatar profile={isOther ? null : profile} label={name} large />
        <View style={styles.profileCopy}>
          <View style={styles.verifiedRow}>
            <Text style={styles.profileName}>@{username}</Text>
            <Text style={styles.verify}>✹</Text>
          </View>
          <Text style={styles.profileBio}>
            {isOther ? "Surfista · Criador de conteudo" : "Viva o flow. Sinta o momentum."}
          </Text>
          <Text style={styles.location}>⌖ {location}</Text>
          <View style={styles.auraChip}>
            <Text>{isOther ? "🌊 Aura Oceano" : "☀ Aura Solar"}</Text>
            <Text>›</Text>
          </View>
        </View>
      </View>

      <View style={styles.profileStats}>
        <View style={styles.profileStat}>
          <Text style={styles.profileStatValue}>{isOther ? "158" : "236"}</Text>
          <Text style={styles.profileStatLabel}>Flows</Text>
        </View>
        <View style={styles.profileStat}>
          <Text style={styles.profileStatValue}>{isOther ? "845k" : "1,2M"}</Text>
          <Text style={styles.profileStatLabel}>Fas</Text>
        </View>
        <View style={styles.profileStat}>
          <Text style={styles.profileStatValue}>{isOther ? "278" : "342"}</Text>
          <Text style={styles.profileStatLabel}>Seletos</Text>
        </View>
        <View style={styles.profileStat}>
          <Text style={styles.profileStatValue}>{isOther ? "92%" : "89%"}</Text>
          <Text style={styles.profileStatLabel}>Engage</Text>
        </View>
      </View>

      {isOther ? (
        <View style={styles.followRow}>
          <Pressable style={styles.followButton}>
            <Text style={styles.followText}>♚ Ser fa</Text>
          </Pressable>
          <Pressable style={styles.messageButton}>
            <Text style={styles.messageButtonText}>▱</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.player}>
          <Image source={{ uri: galleryImages[1] }} style={styles.album} />
          <View style={styles.playerText}>
            <Text style={styles.song}>Swimming Pools</Text>
            <Text style={styles.artist}>Kendrick Lamar</Text>
            <Text style={styles.spotify}>● Spotify</Text>
          </View>
          <View style={styles.playButton}>
            <Text style={styles.playText}>▶</Text>
          </View>
        </View>
      )}

      <Highlights />

      <View style={styles.profileTabs}>
        <Text style={[styles.profileTab, styles.profileTabActive]}>Flows</Text>
        <Text style={styles.profileTab}>Waves</Text>
        <Text style={styles.profileTab}>Salvos</Text>
      </View>

      <View style={styles.grid}>
        {galleryImages.map((image, index) => (
          <ImageBackground key={image} source={{ uri: image }} style={styles.gridItem} imageStyle={styles.gridImage}>
            <Text style={styles.playCount}>▶ {["210k", "158k", "132k", "98k", "85k", "72k"][index]}</Text>
          </ImageBackground>
        ))}
      </View>
    </ScrollView>
  );
}

export function HomeScreen({ onSignOut, session }: HomeScreenProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<ScreenTab>("home");

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

  const screen = useMemo(() => {
    if (activeTab === "profile") {
      return <ProfileScreen onSignOut={onSignOut} profile={profile} session={session} />;
    }

    if (activeTab === "search") {
      return <ProfileScreen isOther profile={profile} session={session} />;
    }

    if (activeTab === "messages") {
      return (
        <View style={styles.placeholderScreen}>
          <Text style={styles.brandSmall}>fluxo</Text>
          <Text style={styles.placeholderTitle}>Mensagens</Text>
          <Text style={styles.placeholderText}>
            Privs real completo entra na proxima sprint nativa. No web, ele ja pode ser testado.
          </Text>
        </View>
      );
    }

    if (activeTab === "create") {
      return (
        <View style={styles.placeholderScreen}>
          <Text style={styles.brandSmall}>fluxo</Text>
          <Text style={styles.placeholderTitle}>Criar Flow</Text>
          <Text style={styles.placeholderText}>
            Composer nativo de camera, foto e video fica para a proxima etapa. Use o web mobile para criar agora.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        refreshControl={
          <RefreshControl onRefresh={refreshHome} refreshing={isRefreshing} tintColor={oceanMobileTheme.primary} />
        }
        style={styles.screen}
      >
        {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
        <ImmersiveHome profile={profile} session={session} />
        {!!contents.length && (
          <View style={styles.liveStrip}>
            <Text style={styles.sectionTitle}>Criacoes reais da sua conta</Text>
            {contents.slice(0, 3).map((content) => (
              <Text key={content.id} style={styles.liveItem}>
                {content.text || "Midia publicada"}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }, [activeTab, contents, errorMessage, isRefreshing, onSignOut, profile, session, refreshHome]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={oceanMobileTheme.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.app}>
      {screen}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    backgroundColor: "#030711",
    flex: 1,
  },
  screen: {
    backgroundColor: "#030711",
    flex: 1,
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#030711",
    flex: 1,
    justifyContent: "center",
  },
  immersive: {
    height: 820,
    justifyContent: "space-between",
    paddingBottom: 106,
    paddingHorizontal: 26,
    paddingTop: 56,
  },
  scrim: {
    backgroundColor: "rgba(3, 7, 17, 0.36)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    color: "#ffffff",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1.6,
  },
  brandSmall: {
    color: "#ffc400",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  topActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  bell: {
    color: "#ffffff",
    fontSize: 25,
  },
  miniAvatar: {
    alignItems: "center",
    backgroundColor: "#10213d",
    borderColor: "#ffc400",
    borderRadius: 12,
    borderWidth: 1,
    height: 39,
    justifyContent: "center",
    width: 39,
  },
  miniAvatarText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  tabs: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 42,
    marginTop: -48,
  },
  tab: {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: 16,
  },
  tabActive: {
    borderBottomColor: "#ffc400",
    borderBottomWidth: 2,
    color: "#ffc400",
    paddingBottom: 8,
  },
  sideActions: {
    gap: 12,
    position: "absolute",
    right: 20,
    top: 278,
  },
  actionPill: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 72,
    justifyContent: "center",
    paddingHorizontal: 10,
    width: 72,
  },
  wavePill: {
    borderColor: "rgba(78, 160, 255, 0.55)",
  },
  actionEmoji: {
    color: "#ffffff",
    fontSize: 22,
  },
  actionName: {
    color: "#ffc400",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  actionValue: {
    color: "#ffffff",
    fontSize: 12,
    marginTop: 2,
  },
  flowCaption: {
    gap: 8,
    maxWidth: 320,
  },
  authorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  authorName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  flowText: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 27,
  },
  tags: {
    color: "#32d7ff",
    fontSize: 15,
  },
  musicChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  musicIcon: {
    color: "#ffffff",
    fontSize: 20,
  },
  musicTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  musicArtist: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
  },
  bottomNav: {
    alignItems: "center",
    backgroundColor: "rgba(3, 7, 17, 0.94)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    height: 88,
    justifyContent: "space-around",
    left: 0,
    paddingBottom: 16,
    position: "absolute",
    right: 0,
  },
  navItem: {
    alignItems: "center",
    minWidth: 58,
  },
  navIcon: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 26,
    lineHeight: 29,
  },
  navLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    marginTop: 2,
  },
  navActive: {
    color: "#ffc400",
  },
  createButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 28,
    height: 58,
    justifyContent: "center",
    marginTop: -22,
    width: 58,
  },
  createIcon: {
    color: "#050816",
    fontSize: 37,
    lineHeight: 40,
  },
  badge: {
    backgroundColor: "#ffc400",
    borderRadius: 999,
    color: "#050816",
    fontSize: 11,
    fontWeight: "900",
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: -7,
    textAlign: "center",
    top: -5,
  },
  profileScreen: {
    backgroundColor: "#030711",
    flex: 1,
  },
  profileContent: {
    paddingBottom: 118,
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  profileTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  settingsButton: {
    padding: 8,
  },
  settingsText: {
    color: "#ffffff",
    fontSize: 25,
  },
  profileIntro: {
    flexDirection: "row",
    gap: 18,
  },
  profileCopy: {
    flex: 1,
    gap: 7,
    justifyContent: "center",
  },
  verifiedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  profileName: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },
  verify: {
    color: "#ffc400",
    fontSize: 17,
  },
  profileBio: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
  },
  location: {
    color: "#ffffff",
    fontSize: 13,
  },
  auraChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 17,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profileStats: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 26,
    paddingVertical: 16,
  },
  profileStat: {
    alignItems: "center",
    flex: 1,
  },
  profileStatValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  profileStatLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    marginTop: 3,
  },
  player: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
    padding: 12,
  },
  album: {
    borderRadius: 8,
    height: 48,
    width: 48,
  },
  playerText: {
    flex: 1,
  },
  song: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  artist: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    marginTop: 2,
  },
  spotify: {
    color: "#22c55e",
    fontSize: 11,
    marginTop: 5,
  },
  playButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  playText: {
    color: "#ffffff",
    fontSize: 16,
  },
  highlights: {
    gap: 10,
    paddingVertical: 22,
  },
  highlightItem: {
    alignItems: "center",
    width: 72,
  },
  highlightThumb: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    borderWidth: 1,
    height: 72,
    justifyContent: "center",
    overflow: "hidden",
    width: 72,
  },
  highlightImage: {
    height: "100%",
    width: "100%",
  },
  highlightPlus: {
    color: "#ffffff",
    fontSize: 32,
  },
  highlightLabel: {
    color: "#ffffff",
    fontSize: 12,
    marginTop: 7,
  },
  profileTabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  profileTab: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 17,
    paddingBottom: 9,
  },
  profileTabActive: {
    borderBottomColor: "#ffc400",
    borderBottomWidth: 2,
    color: "#ffc400",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridItem: {
    height: 124,
    justifyContent: "flex-end",
    width: "31.8%",
  },
  gridImage: {
    borderRadius: 13,
  },
  playCount: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    padding: 7,
  },
  followRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  followButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 14,
    flex: 1,
    paddingVertical: 15,
  },
  followText: {
    color: "#050816",
    fontSize: 16,
    fontWeight: "900",
  },
  messageButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    justifyContent: "center",
    width: 58,
  },
  messageButtonText: {
    color: "#ffffff",
    fontSize: 25,
  },
  avatarFrame: {
    borderColor: "#ffc400",
    borderRadius: 13,
    borderWidth: 1,
    padding: 2,
  },
  avatarFrameLarge: {
    borderRadius: 23,
    borderWidth: 2,
    shadowColor: "#ffc400",
    shadowOpacity: 0.65,
    shadowRadius: 16,
  },
  avatarImage: {
    borderRadius: 10,
    height: 38,
    width: 38,
  },
  avatarImageLarge: {
    borderRadius: 20,
    height: 118,
    width: 118,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: "#112544",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  avatarFallbackLarge: {
    borderRadius: 20,
    height: 118,
    width: 118,
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  avatarTextLarge: {
    fontSize: 42,
  },
  liveStrip: {
    gap: 10,
    padding: 18,
    paddingBottom: 116,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  liveItem: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    color: "#ffffff",
    padding: 14,
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    marginHorizontal: 16,
    marginTop: 56,
    padding: 12,
  },
  placeholderScreen: {
    alignItems: "flex-start",
    backgroundColor: "#030711",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 28,
  },
  placeholderTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  placeholderText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    lineHeight: 24,
  },
});
