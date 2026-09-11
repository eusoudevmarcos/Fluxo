import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "../components/Avatar";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import { toggleDahora } from "../lib/services/dahoras.service";
import { listFeedContents, type FeedContent } from "../lib/services/contents.service";
import { getProfileName, type Profile } from "../lib/services/profiles.service";

type FeedScreenProps = {
  session: Session;
  profile: Profile | null;
  onOpenProfile: (userId: string) => void;
};

function timeAgo(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(isoDate).toLocaleDateString("pt-BR");
}

function PostCard({
  content,
  onOpenProfile,
  onToggleDahora,
}: {
  content: FeedContent;
  onOpenProfile: (userId: string) => void;
  onToggleDahora: (contentId: string) => void;
}) {
  const authorName = content.author?.display_name || content.author?.username || "Fluxo";

  return (
    <View style={styles.card}>
      <Pressable onPress={() => onOpenProfile(content.author_id)} style={styles.cardHeader}>
        <Avatar avatarUrl={content.author?.avatar_url} label={authorName} />
        <View style={styles.cardHeaderText}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.timestamp}>
            {content.author?.username ? `~${content.author.username} · ` : ""}
            {timeAgo(content.created_at)}
          </Text>
        </View>
      </Pressable>

      {!!content.text && <Text style={styles.body}>{content.text}</Text>}

      {content.media_url && content.media_type === "image" && (
        <Image source={{ uri: content.media_url }} style={styles.media} resizeMode="cover" />
      )}

      <View style={styles.actionsRow}>
        <Pressable onPress={() => onToggleDahora(content.id)} style={styles.actionButton}>
          <Text style={[styles.actionIcon, content.has_dahora && styles.actionIconActive]}>
            👊
          </Text>
          <Text style={styles.actionValue}>{content.dahora_count}</Text>
        </Pressable>
        <View style={styles.actionButton}>
          <Text style={styles.actionIcon}>☰</Text>
          <Text style={styles.actionValue}>{content.comments_count}</Text>
        </View>
        <View style={styles.actionButton}>
          <Text style={styles.actionIcon}>◒</Text>
          <Text style={styles.actionValue}>{content.wave_count}</Text>
        </View>
      </View>
    </View>
  );
}

export function FeedScreen({ session, profile, onOpenProfile }: FeedScreenProps) {
  const [contents, setContents] = useState<FeedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadFeed = useCallback(async () => {
    const supabase = createMobileSupabaseClient();
    const feedContents = await listFeedContents(supabase, session.user.id);
    setContents(feedContents);
  }, [session.user.id]);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setErrorMessage("");
    loadFeed()
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadFeed]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setErrorMessage("");

    try {
      await loadFeed();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível atualizar.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleToggleDahora(contentId: string) {
    setContents((previous) =>
      previous.map((content) =>
        content.id === contentId
          ? {
              ...content,
              has_dahora: !content.has_dahora,
              dahora_count: content.dahora_count + (content.has_dahora ? -1 : 1),
            }
          : content,
      ),
    );

    try {
      const supabase = createMobileSupabaseClient();
      const state = await toggleDahora(supabase, contentId);
      setContents((previous) =>
        previous.map((content) =>
          content.id === contentId
            ? { ...content, has_dahora: state.has_dahora, dahora_count: state.count }
            : content,
        ),
      );
    } catch {
      loadFeed().catch(() => undefined);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ffc400" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>fluxo</Text>
        <Pressable onPress={() => onOpenProfile(session.user.id)}>
          <Avatar avatarUrl={profile?.avatar_url} label={getProfileName(profile, session)} />
        </Pressable>
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <FlatList
        contentContainerStyle={styles.list}
        data={contents}
        keyExtractor={(content) => content.id}
        refreshControl={
          <RefreshControl onRefresh={handleRefresh} refreshing={isRefreshing} tintColor="#ffc400" />
        }
        renderItem={({ item }) => (
          <PostCard content={item} onOpenProfile={onOpenProfile} onToggleDahora={handleToggleDahora} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Ainda não rolou nada por aqui</Text>
            <Text style={styles.emptyText}>Seja a primeira criação a aparecer no Flow.</Text>
          </View>
        }
      />
    </View>
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
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  brand: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  list: {
    gap: 14,
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  authorName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  timestamp: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 12,
    marginTop: 1,
  },
  body: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 21,
  },
  media: {
    borderRadius: 14,
    height: 320,
    width: "100%",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 22,
  },
  actionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionIcon: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
  },
  actionIconActive: {
    color: "#ffc400",
  },
  actionValue: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingTop: 80,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
});
