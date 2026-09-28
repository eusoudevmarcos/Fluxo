import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  ensureMyCoinWallet,
  listMyCoinTransactions,
  type CoinTransaction,
} from "../lib/services/coin.service";

type WalletScreenProps = {
  onBack: () => void;
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

function describeTransaction(transaction: CoinTransaction) {
  const counterpartName =
    transaction.counterpart?.display_name || transaction.counterpart?.username;

  switch (transaction.type) {
    case "mission_reward":
      return { icon: "⚡", title: transaction.reason || "Recompensa de missão" };
    case "gift_sent":
      return {
        icon: "🎁",
        title: counterpartName ? `Presente para ${counterpartName}` : "Presente enviado",
      };
    case "gift_received":
      return {
        icon: "🎁",
        title: counterpartName ? `Presente de ${counterpartName}` : "Presente recebido",
      };
    default:
      return { icon: "⚙", title: transaction.reason || "Ajuste" };
  }
}

export function WalletScreen({ onBack }: WalletScreenProps) {
  const [balance, setBalance] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadWallet = useCallback(async () => {
    const supabase = createMobileSupabaseClient();
    const [wallet, history] = await Promise.all([
      ensureMyCoinWallet(supabase),
      listMyCoinTransactions(supabase),
    ]);

    setBalance(wallet.balance);
    setLifetimeEarned(wallet.lifetime_earned);
    setTransactions(history);
  }, []);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setErrorMessage("");
    loadWallet()
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Não foi possível carregar sua carteira.",
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadWallet]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await loadWallet();
    } catch {
      // mantém os dados já carregados em caso de falha no refresh
    } finally {
      setIsRefreshing(false);
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
        <Text style={styles.title}>Carteira Fluxo Coin</Text>
        <View style={styles.backButton} />
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <FlatList
        contentContainerStyle={styles.content}
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl onRefresh={handleRefresh} refreshing={isRefreshing} tintColor="#ffc400" />
        }
        ListHeaderComponent={
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Seu saldo</Text>
              <Text style={styles.balanceValue}>{balance.toLocaleString("pt-BR")} OC</Text>
              <Text style={styles.lifetimeText}>
                {lifetimeEarned.toLocaleString("pt-BR")} OC ganhos ao todo
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Histórico</Text>
          </>
        }
        renderItem={({ item }) => {
          const { icon, title } = describeTransaction(item);
          const isPositive = item.amount >= 0;

          return (
            <View style={styles.transactionRow}>
              <Text style={styles.transactionIcon}>{icon}</Text>
              <View style={styles.transactionBody}>
                <Text style={styles.transactionTitle}>{title}</Text>
                <Text style={styles.transactionTime}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={[styles.transactionAmount, isPositive ? styles.amountPositive : styles.amountNegative]}>
                {isPositive ? "+" : ""}
                {item.amount.toLocaleString("pt-BR")} OC
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Complete missões e suba de nível para começar a acumular Fluxo Coin.
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
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
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
  content: {
    gap: 10,
    paddingBottom: 118,
    paddingHorizontal: 20,
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
  },
  balanceCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,196,0,0.1)",
    borderColor: "rgba(255,196,0,0.3)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginBottom: 18,
    padding: 22,
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  balanceValue: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },
  lifetimeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  transactionRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  transactionIcon: {
    fontSize: 18,
  },
  transactionBody: {
    flex: 1,
  },
  transactionTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  transactionTime: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: "900",
  },
  amountPositive: {
    color: "#8edbff",
  },
  amountNegative: {
    color: "rgba(255,255,255,0.7)",
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    paddingVertical: 20,
    textAlign: "center",
  },
});
