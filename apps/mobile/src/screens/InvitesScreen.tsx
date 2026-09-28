import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  buildInviteShareMessage,
  getInviteLink,
  getMyInviteStatus,
  listMyInvitedFriends,
  type InviteStatus,
  type InvitedFriend,
} from "../lib/services/invites.service";

type InvitesScreenProps = {
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
};

export function InvitesScreen({ onBack, onOpenProfile }: InvitesScreenProps) {
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [friends, setFriends] = useState<InvitedFriend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createMobileSupabaseClient();
    const [nextStatus, nextFriends] = await Promise.all([
      getMyInviteStatus(supabase),
      listMyInvitedFriends(supabase),
    ]);
    setStatus(nextStatus);
    setFriends(nextFriends);
  }, []);

  useEffect(() => {
    let isMounted = true;

    load()
      .catch(() => {
        if (isMounted) setErrorMessage("Rode a migration 050 para ativar os convites.");
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
      // mantem os dados ja carregados
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleShare() {
    if (!status) return;
    await Share.share({ message: buildInviteShareMessage(status.code) }).catch(() => undefined);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ffc400" size="large" />
      </View>
    );
  }

  const link = status ? getInviteLink(status.code) : null;
  const pioneerProgress = status
    ? Math.min(friends.length / status.pioneer_azul_target, 1)
    : 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl onRefresh={handleRefresh} refreshing={isRefreshing} tintColor="#ffc400" />
      }
      style={styles.screen}
    >
      <View style={styles.topRow}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Convidar amigos</Text>
        <View style={styles.backButton} />
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {status && (
        <>
          <View style={styles.heroCard}>
            <Text style={styles.heroValue}>{status.slots_available}</Text>
            <Text style={styles.heroLabel}>
              {status.slots_available === 1 ? "convite disponível" : "convites disponíveis"}
            </Text>
            <Text style={styles.muted}>
              Quem entra pelo seu convite já fica conectado com você. Cada missão semanal
              concluída libera mais 1 convite.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Seu código</Text>
            <Text style={styles.code}>{status.code}</Text>
            {link && <Text style={styles.link}>{link}</Text>}
            <Pressable onPress={handleShare} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Compartilhar convite</Text>
            </Pressable>
            <Text style={styles.muted}>
              {status.slots_used} de {status.slots_total} convites usados
            </Text>
          </View>

          {status.pioneer_azul_active && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Selo Pioneiro Azul</Text>
              <Text style={styles.muted}>
                Os primeiros 1.000 a trazer {status.pioneer_azul_target} amigos ganham o selo azul
                para sempre. Restam {status.pioneer_azul_remaining.toLocaleString("pt-BR")} vagas.
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pioneerProgress * 100}%` }]} />
              </View>
              <Text style={styles.muted}>
                {Math.min(friends.length, status.pioneer_azul_target)} de{" "}
                {status.pioneer_azul_target} amigos
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quem entrou pelo seu convite</Text>
            {friends.length ? (
              friends.map((friend) => {
                const name = friend.display_name || friend.username || "Novo flow";
                return (
                  <Pressable
                    key={friend.invitee_id}
                    onPress={() => onOpenProfile(friend.invitee_id)}
                    style={styles.friendRow}
                  >
                    {friend.avatar_url ? (
                      <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatar} />
                    ) : (
                      <View style={[styles.friendAvatar, styles.friendAvatarFallback]}>
                        <Text style={styles.friendInitial}>{name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.friendBody}>
                      <Text style={styles.friendName}>{name}</Text>
                      <Text style={styles.muted}>
                        {friend.connected ? "Conectados" : "Entrou pelo seu convite"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.muted}>
                Ninguém entrou ainda. Mande seu convite para quem você quer ver na Fluxo.
              </Text>
            )}
          </View>
        </>
      )}
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
    gap: 14,
    paddingBottom: 118,
    paddingHorizontal: 20,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
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
    padding: 12,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,196,0,0.1)",
    borderColor: "rgba(255,196,0,0.3)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 22,
  },
  heroValue: {
    color: "#ffffff",
    fontSize: 44,
    fontWeight: "900",
  },
  heroLabel: {
    color: "#ffc400",
    fontSize: 15,
    fontWeight: "900",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  code: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
  },
  link: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textAlign: "center",
  },
  muted: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#050816",
    fontSize: 15,
    fontWeight: "900",
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    height: 10,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "#1e88ff",
    borderRadius: 999,
    height: "100%",
  },
  friendRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  friendAvatar: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  friendAvatarFallback: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    justifyContent: "center",
  },
  friendInitial: {
    color: "#050816",
    fontWeight: "900",
  },
  friendBody: {
    alignItems: "flex-start",
    flex: 1,
  },
  friendName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
