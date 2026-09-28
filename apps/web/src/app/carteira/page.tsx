"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { HiCog, HiCurrencyDollar, HiGift, HiLightningBolt } from "react-icons/hi";
import type { CoinTransaction, UserCoinWallet } from "@ocean/shared";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { ensureMyCoinWallet, listMyCoinTransactions } from "@/lib/services/coin.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

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

function describeTransaction(transaction: CoinTransaction): {
  Icon: ComponentType<{ "aria-hidden"?: boolean }>;
  title: string;
} {
  const counterpartName =
    transaction.counterpart?.display_name || transaction.counterpart?.username;

  switch (transaction.type) {
    case "mission_reward":
      return { Icon: HiLightningBolt, title: transaction.reason || "Recompensa de missão" };
    case "gift_sent":
      return {
        Icon: HiGift,
        title: counterpartName ? `Presente para ${counterpartName}` : "Presente enviado",
      };
    case "gift_received":
      return {
        Icon: HiGift,
        title: counterpartName ? `Presente de ${counterpartName}` : "Presente recebido",
      };
    default:
      return { Icon: HiCog, title: transaction.reason || "Ajuste" };
  }
}

export default function CarteiraPage() {
  const supabase = useMemo(() => createClient(), []);
  const [wallet, setWallet] = useState<UserCoinWallet | null>(null);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadWallet() {
      setIsLoading(true);
      setError("");

      try {
        const [nextWallet, nextTransactions] = await Promise.all([
          ensureMyCoinWallet(supabase),
          listMyCoinTransactions(supabase),
        ]);

        if (isMounted) {
          setWallet(nextWallet);
          setTransactions(nextTransactions);
        }
      } catch {
        if (isMounted) {
          setError("Rode as migrations 044 e 045 para ativar a carteira Fluxo Coin.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadWallet();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return (
    <AppShell>
      <PageCard>
        <main className={styles.page}>
          <header className={styles.hero}>
            <div>
              <span>Fluxo Coin</span>
              <h1>Sua carteira</h1>
              <p>
                Moeda 100% interna da Fluxo: você ganha completando missões e subindo de nível, e
                acumula na carteira. Sem conversão em dinheiro real e, por enquanto, sem troca
                entre pessoas — doações em lives chegam junto com o Fluxo Stream.
              </p>
            </div>
          </header>

          {isLoading && <p className={styles.notice}>Carregando carteira...</p>}
          {error && <p className={styles.error}>{error}</p>}

          {!isLoading && !error && (
            <>
              <section className={styles.balanceCard}>
                <span className={styles.balanceIcon}>
                  <HiCurrencyDollar />
                </span>
                <div className={styles.balanceInfo}>
                  <small>Seu saldo</small>
                  <strong>{(wallet?.balance ?? 0).toLocaleString("pt-BR")} OC</strong>
                  <em>{(wallet?.lifetime_earned ?? 0).toLocaleString("pt-BR")} OC ganhos ao todo</em>
                </div>
              </section>

              <section className={styles.card}>
                <h2>Histórico</h2>
                <div className={styles.transactionList}>
                  {transactions.length ? (
                    transactions.map((transaction) => {
                      const { Icon, title } = describeTransaction(transaction);
                      const isPositive = transaction.amount >= 0;

                      return (
                        <div className={styles.transaction} key={transaction.id}>
                          <Icon aria-hidden />
                          <div className={styles.transactionInfo}>
                            <strong>{title}</strong>
                            <small>{timeAgo(transaction.created_at)}</small>
                          </div>
                          <em className={isPositive ? styles.positive : styles.negative}>
                            {isPositive ? "+" : ""}
                            {transaction.amount.toLocaleString("pt-BR")} OC
                          </em>
                        </div>
                      );
                    })
                  ) : (
                    <p className={styles.notice}>
                      Complete missões e suba de nível para começar a acumular Fluxo Coin.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </PageCard>
    </AppShell>
  );
}
