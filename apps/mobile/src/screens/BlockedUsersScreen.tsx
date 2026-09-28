import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "../components/Avatar";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import { listBlockedUsers, unblockUser, type BlockedUser } from "../lib/services/safety.service";

type BlockedUsersScreenProps = {
  onBack: () => void;
};

export function BlockedUsersScreen({ onBack }: BlockedUsersScreenProps) {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    listBlockedUsers(createMobileSupabaseClient())
      .then((rows) => {
        if (isMounted) setUsers(rows);
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleUnblock(userId: string) {
    setPendingId(userId);
    try {
      await unblockUser(createMobileSupabaseClient(), userId);
      setUsers((current) => current.filter((user) => user.user_id !== userId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível desbloquear.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Pessoas bloqueadas</Text>
        <View style={styles.backButton} />
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {isLoading ? (
        <ActivityIndicator color="#ffc400" size="large" style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={users}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item }) => {
            const name = item.display_name || item.username || "Fluxo";
            return (
              <View style={styles.row}>
                <Avatar avatarUrl={item.avatar_url} label={name} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{name}</Text>
                  {!!item.username && <Text style={styles.rowUsername}>@{item.username}</Text>}
                </View>
                <Pressable
                  disabled={pendingId === item.user_id}
                  onPress={() => handleUnblock(item.user_id)}
                  style={styles.unblockButton}
                >
                  <Text style={styles.unblockText}>Desbloquear</Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>Você não bloqueou ninguém.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#030711",
    flex: 1,
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
    color: "#fecaca",
    marginHorizontal: 20,
  },
  loader: {
    marginTop: 40,
  },
  list: {
    gap: 6,
    paddingBottom: 118,
    paddingHorizontal: 16,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  rowUsername: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  unblockButton: {
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unblockText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    paddingTop: 40,
    textAlign: "center",
  },
});
