import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "../components/Avatar";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  getProfileContentStats,
  listContentsByAuthorId,
  type ContentRow,
  type ProfileContentStats,
} from "../lib/services/contents.service";
import {
  getProfileByUserId,
  getRelationshipStats,
  getRelationshipState,
  toggleFollowProfile,
  type Profile,
  type RelationshipStats,
} from "../lib/services/profiles.service";

type ProfileScreenProps = {
  session: Session;
  userId: string;
  onBack?: () => void;
  onSignOut?: () => Promise<void> | void;
  onMessageUser: (userId: string) => void;
};

export function ProfileScreen({ session, userId, onBack, onSignOut, onMessageUser }: ProfileScreenProps) {
  const isSelf = userId === session.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<RelationshipStats>({ fans: 0, seletos: 0 });
  const [contentStats, setContentStats] = useState<ProfileContentStats>({
    contentCount: 0,
    dahorasReceived: 0,
  });
  const [contents, setContents] = useState<ContentRow[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [canFollow, setCanFollow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadProfile = useCallback(async () => {
    const supabase = createMobileSupabaseClient();

    const [profileData, relationshipStats, profileContentStats, authoredContents, relationshipState] =
      await Promise.all([
        getProfileByUserId(supabase, userId),
        getRelationshipStats(supabase, userId),
        getProfileContentStats(supabase, userId),
        listContentsByAuthorId(supabase, userId),
        isSelf ? Promise.resolve({ isFollowing: false, canFollow: false }) : getRelationshipState(supabase, userId),
      ]);

    setProfile(profileData);
    setStats(relationshipStats);
    setContentStats(profileContentStats);
    setContents(authoredContents);
    setIsFollowing(relationshipState.isFollowing);
    setCanFollow(relationshipState.canFollow);
  }, [userId, isSelf]);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setErrorMessage("");
    loadProfile()
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar o perfil.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadProfile]);

  async function handleToggleFollow() {
    setIsTogglingFollow(true);
    const previousIsFollowing = isFollowing;
    setIsFollowing(!previousIsFollowing);
    setStats((previous) => ({
      ...previous,
      fans: previous.fans + (previousIsFollowing ? -1 : 1),
    }));

    try {
      const supabase = createMobileSupabaseClient();
      await toggleFollowProfile(supabase, userId, previousIsFollowing);
    } catch (error) {
      setIsFollowing(previousIsFollowing);
      setStats((previous) => ({
        ...previous,
        fans: previous.fans + (previousIsFollowing ? 1 : -1),
      }));
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível seguir.");
    } finally {
      setIsTogglingFollow(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ffc400" size="large" />
      </View>
    );
  }

  const displayName = profile?.display_name || profile?.username || "Fluxo";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        ) : (
          <Text style={styles.brandSmall}>fluxo</Text>
        )}
        {isSelf && (
          <Pressable onPress={onSignOut} style={styles.settingsButton}>
            <Text style={styles.settingsText}>⚙</Text>
          </Pressable>
        )}
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <View style={styles.intro}>
        <Avatar avatarUrl={profile?.avatar_url} label={displayName} large />
        <View style={styles.introCopy}>
          <Text style={styles.username}>@{profile?.username || "fluxo"}</Text>
          <Text style={styles.bio}>{profile?.bio || "Viva o flow. Sinta o momentum."}</Text>
          {!!profile?.location_label && <Text style={styles.location}>⌖ {profile.location_label}</Text>}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{contentStats.contentCount}</Text>
          <Text style={styles.statLabel}>Flows</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.fans}</Text>
          <Text style={styles.statLabel}>Fãs</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.seletos}</Text>
          <Text style={styles.statLabel}>Seletos</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{contentStats.dahorasReceived}</Text>
          <Text style={styles.statLabel}>Dahoras</Text>
        </View>
      </View>

      {!isSelf && (
        <View style={styles.followRow}>
          <Pressable
            disabled={!canFollow || isTogglingFollow}
            onPress={handleToggleFollow}
            style={[styles.followButton, isFollowing && styles.followingButton]}
          >
            <Text style={[styles.followText, isFollowing && styles.followingText]}>
              {isFollowing ? "Seguindo" : "♚ Ser fã"}
            </Text>
          </Pressable>
          <Pressable onPress={() => onMessageUser(userId)} style={styles.messageButton}>
            <Text style={styles.messageButtonText}>▱</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.grid}>
        {contents.map((content) =>
          content.media_url ? (
            <ImageBackground
              key={content.id}
              source={{ uri: content.media_url }}
              style={styles.gridItem}
              imageStyle={styles.gridImage}
            />
          ) : (
            <View key={content.id} style={[styles.gridItem, styles.gridTextItem]}>
              <Text numberOfLines={5} style={styles.gridText}>
                {content.text}
              </Text>
            </View>
          ),
        )}
        {!contents.length && (
          <Text style={styles.emptyGrid}>
            {isSelf ? "Você ainda não postou nada." : "Essa pessoa ainda não postou nada."}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  content: {
    paddingBottom: 118,
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  brandSmall: {
    color: "#ffc400",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  settingsButton: {
    padding: 8,
  },
  settingsText: {
    color: "#ffffff",
    fontSize: 25,
  },
  intro: {
    flexDirection: "row",
    gap: 18,
  },
  introCopy: {
    flex: 1,
    gap: 7,
    justifyContent: "center",
  },
  username: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  bio: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
  },
  location: {
    color: "#ffffff",
    fontSize: 13,
  },
  statsRow: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 26,
    paddingVertical: 16,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    marginTop: 3,
  },
  followRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  followButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 14,
    flex: 1,
    paddingVertical: 15,
  },
  followingButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
  },
  followText: {
    color: "#050816",
    fontSize: 16,
    fontWeight: "900",
  },
  followingText: {
    color: "#ffffff",
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 26,
  },
  gridItem: {
    height: 124,
    justifyContent: "flex-end",
    width: "31.8%",
  },
  gridImage: {
    borderRadius: 13,
  },
  gridTextItem: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "flex-start",
    padding: 8,
  },
  gridText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
  },
  emptyGrid: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    paddingVertical: 24,
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    marginBottom: 16,
    padding: 12,
  },
});
