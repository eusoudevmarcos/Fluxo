import { useCallback, useEffect, useState } from "react";
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
import { createMobileSupabaseClient } from "../lib/supabase/client";
import { searchProfiles, type PublicProfile } from "../lib/services/profiles.service";

type SearchScreenProps = {
  onOpenProfile: (userId: string) => void;
};

export function SearchScreen({ onOpenProfile }: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const runSearch = useCallback(async (term: string) => {
    const supabase = createMobileSupabaseClient();
    return searchProfiles(supabase, term);
  }, []);

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
  }, [query, runSearch]);

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
                <Text style={styles.rowName}>{item.display_name || item.username}</Text>
                {!!item.username && <Text style={styles.rowUsername}>@{item.username}</Text>}
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
