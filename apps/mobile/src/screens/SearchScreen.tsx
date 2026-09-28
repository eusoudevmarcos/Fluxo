import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "../components/Avatar";
import { SealBadge } from "../components/SealBadge";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  getMyNearbySettings,
  searchProfiles,
  setNearbyVisibility,
  updateMyLocation,
  type NearbySettings,
  type PublicProfile,
} from "../lib/services/profiles.service";

async function getCurrentCoords(requestPermission: boolean) {
  const permission = requestPermission
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    if (requestPermission) {
      throw new Error("Permita a localização para ver pessoas próximas.");
    }
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return position.coords;
}

type SearchScreenProps = {
  onOpenProfile: (userId: string) => void;
};

export function SearchScreen({ onOpenProfile }: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [nearby, setNearby] = useState<NearbySettings | null>(null);
  const [isUpdatingNearby, setIsUpdatingNearby] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const runSearch = useCallback(async (term: string) => {
    const supabase = createMobileSupabaseClient();
    return searchProfiles(supabase, term);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createMobileSupabaseClient();

    async function loadNearby() {
      const settings = await getMyNearbySettings(supabase).catch(() => null);
      if (!isMounted) return;
      setNearby(settings);

      // Renova a posicao de quem ja ligou, sem pedir permissao de novo (servidor limita a uma
      // atualizacao a cada 10 minutos).
      if (settings?.nearby_visible) {
        const coords = await getCurrentCoords(false).catch(() => null);
        if (coords) await updateMyLocation(supabase, coords).catch(() => undefined);
      }
    }

    void loadNearby();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleToggleNearby() {
    if (!nearby) return;
    const supabase = createMobileSupabaseClient();
    setIsUpdatingNearby(true);
    setErrorMessage("");

    try {
      if (nearby.nearby_visible) {
        await setNearbyVisibility(supabase, false);
        setNearby({ ...nearby, nearby_visible: false });
      } else {
        const coords = await getCurrentCoords(true);
        if (coords) await updateMyLocation(supabase, coords);
        await setNearbyVisibility(supabase, true);
        setNearby({ ...nearby, nearby_visible: true });
      }
      setReloadKey((current) => current + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível atualizar.");
    } finally {
      setIsUpdatingNearby(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrorMessage("");

    const timeoutId = setTimeout(() => {
      runSearch(query)
        .then((profiles) => {
          if (!isMounted) return;
          setResults(profiles);
        })
        .catch((error) => {
          if (!isMounted) return;
          setErrorMessage(error instanceof Error ? error.message : "Não foi possível buscar.");
        })
        .finally(() => {
          if (!isMounted) return;
          setIsLoading(false);
        });
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [query, reloadKey, runSearch]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brandSmall}>fluxo</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder="Buscar pessoas"
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.input}
          value={query}
        />
      </View>

      {!query.trim() && nearby?.is_adult && (
        <View style={styles.nearbyCard}>
          <View style={styles.nearbyText}>
            <Text style={styles.nearbyTitle}>Pessoas perto de você</Text>
            <Text style={styles.nearbySubtitle}>
              {nearby.nearby_visible
                ? "Ativado. Ninguém vê sua localização exata, só uma faixa de distância."
                : "Veja e apareça para quem também ativou. Nunca com a localização exata."}
            </Text>
          </View>
          <Pressable
            disabled={isUpdatingNearby}
            onPress={handleToggleNearby}
            style={[styles.nearbyButton, nearby.nearby_visible && styles.nearbyButtonOff]}
          >
            {isUpdatingNearby ? (
              <ActivityIndicator color={nearby.nearby_visible ? "#ffffff" : "#050816"} />
            ) : (
              <Text
                style={[
                  styles.nearbyButtonText,
                  nearby.nearby_visible && styles.nearbyButtonTextOff,
                ]}
              >
                {nearby.nearby_visible ? "Desativar" : "Ativar"}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {isLoading ? (
        <ActivityIndicator color="#ffc400" size="large" style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={results}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpenProfile(item.user_id)} style={styles.row}>
              <Avatar avatarUrl={item.avatar_url} label={item.display_name || item.username || "Fluxo"} />
              <View style={styles.rowText}>
                <View style={styles.rowNameLine}>
                  <Text style={styles.rowName}>{item.display_name || item.username}</Text>
                  <SealBadge seal={item.verified_seal} size={14} />
                </View>
                {!!item.username && <Text style={styles.rowUsername}>@{item.username}</Text>}
                {!!item.suggestion_detail && (
                  <Text style={styles.rowReason}>{item.suggestion_detail}</Text>
                )}
              </View>
              {item.is_following && <Text style={styles.followingTag}>Seguindo</Text>}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Ninguém encontrado.</Text>
            </View>
          }
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
  header: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  brandSmall: {
    color: "#ffc400",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loader: {
    marginTop: 40,
  },
  list: {
    gap: 4,
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
  },
  rowNameLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  rowName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  rowUsername: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 1,
  },
  rowReason: {
    color: "#ffc400",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  nearbyCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    marginHorizontal: 16,
    padding: 14,
  },
  nearbyText: {
    flex: 1,
    gap: 2,
  },
  nearbyTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  nearbySubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    lineHeight: 17,
  },
  nearbyButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 14,
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nearbyButtonOff: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
  },
  nearbyButtonText: {
    color: "#050816",
    fontSize: 13,
    fontWeight: "900",
  },
  nearbyButtonTextOff: {
    color: "#ffffff",
  },
  followingTag: {
    color: "#ffc400",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
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
});
