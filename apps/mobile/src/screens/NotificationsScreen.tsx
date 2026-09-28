import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "../components/Avatar";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  describeNotification,
  listMyNotifications,
  markAllNotificationsRead,
  type AppNotification,
} from "../lib/services/notifications.service";

type NotificationsScreenProps = {
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenMissions: () => void;
  onOpenInvites: () => void;
  onOpenCreatorProgram: () => void;
  onOpenOwnProfile: () => void;
  onRead: () => void;
};

function timeAgo(isoDate: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(isoDate).toLocaleDateString("pt-BR");
}

export function NotificationsScreen({
  onBack,
  onOpenProfile,
  onOpenMissions,
  onOpenInvites,
  onOpenCreatorProgram,
  onOpenOwnProfile,
  onRead,
}: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Ref para o callback do pai nao recriar `load` (e recarregar em loop) a cada render.
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  const load = useCallback(async () => {
    const supabase = createMobileSupabaseClient();
    const rows = await listMyNotifications(supabase);
    setNotifications(rows);

    // Abrir a tela marca tudo como lido; os itens novos continuam destacados nesta visita.
    if (rows.some((row) => !row.read_at)) {
      await markAllNotificationsRead(supabase).catch(() => undefined);
      onReadRef.current();
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    load()
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Não foi possível carregar notificações.",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [load]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await load();
    } catch {
      // mantem a lista atual
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleOpen(notification: AppNotification) {
    switch (notification.type) {
      case "mission_reward":
        onOpenMissions();
        return;
      case "seal_granted":
        onOpenOwnProfile();
        return;
      case "invite_accepted":
        onOpenInvites();
        return;
      case "creator_application_reviewed":
        onOpenCreatorProgram();
        return;
      default:
        if (notification.actor_id) onOpenProfile(notification.actor_id);
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
      <View style={styles.topRow}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Notificações</Text>
        <View style={styles.backButton} />
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <FlatList
        contentContainerStyle={styles.list}
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl onRefresh={handleRefresh} refreshing={isRefreshing} tintColor="#ffc400" />
        }
        renderItem={({ item }) => {
          const { icon, text } = describeNotification(item);
          const actorName = item.actor?.display_name || item.actor?.username || "Fluxo";

          return (
            <Pressable
              onPress={() => handleOpen(item)}
              style={[styles.row, !item.read_at && styles.rowUnread]}
            >
              {item.actor ? (
                <Avatar avatarUrl={item.actor.avatar_url} label={actorName} />
              ) : (
                <View style={styles.iconBubble}>
                  <Text style={styles.iconText}>{icon}</Text>
                </View>
              )}
              <View style={styles.rowBody}>
                <Text numberOfLines={3} style={styles.rowText}>
                  {text}
                </Text>
                <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
              </View>
              {!item.read_at && <View style={styles.unreadDot} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nada por aqui ainda. Poste, cumpra missões e convide amigos para movimentar seu flow.
          </Text>
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
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  backButton: {
    minWidth: 28,
    padding: 4,
  },
  backText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    marginBottom: 10,
    marginHorizontal: 20,
    padding: 12,
  },
  list: {
    gap: 8,
    paddingBottom: 118,
    paddingHorizontal: 16,
  },
  row: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  rowUnread: {
    backgroundColor: "rgba(255,196,0,0.07)",
  },
  iconBubble: {
    alignItems: "center",
    backgroundColor: "rgba(255,196,0,0.14)",
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  iconText: {
    fontSize: 18,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 19,
  },
  rowTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  unreadDot: {
    backgroundColor: "#ffc400",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 40,
    textAlign: "center",
  },
});
