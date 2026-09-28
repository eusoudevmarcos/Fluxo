"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HiCheck, HiClipboardCopy, HiShare, HiUserAdd } from "react-icons/hi";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import {
  getInviteLink,
  getMyInviteStatus,
  listMyInvitedFriends,
  type InviteStatus,
  type InvitedFriend,
} from "@/lib/services/invites.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

function buildShareText(link: string) {
  return `Tô na Fluxo e separei um dos meus convites pra você. Entra por aqui que a gente já fica conectado: ${link}`;
}

export default function ConvitesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [friends, setFriends] = useState<InvitedFriend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [nextStatus, nextFriends] = await Promise.all([
          getMyInviteStatus(supabase),
          listMyInvitedFriends(supabase),
        ]);
        if (!isMounted) return;
        setStatus(nextStatus);
        setFriends(nextFriends);
      } catch {
        if (isMounted) setError("Rode a migration 050 para ativar os convites.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const link = status ? getInviteLink(status.code) : "";
  const acceptedCount = friends.length;
  const pioneerProgress = status
    ? Math.min(acceptedCount / status.pioneer_azul_target, 1)
    : 0;

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    if (!link) return;
    const text = buildShareText(link);

    if (navigator.share) {
      try {
        await navigator.share({ title: "Convite Fluxo", text, url: link });
        return;
      } catch {
        // compartilhamento cancelado pelo usuario
        return;
      }
    }

    // Desktop sem share nativo: abre o WhatsApp Web com a mensagem pronta.
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <AppShell>
      <PageCard>
        <main className={styles.page}>
          <header className={styles.hero}>
            <span>Convites</span>
            <h1>
              {status
                ? `Você tem ${status.slots_available} ${status.slots_available === 1 ? "convite" : "convites"}`
                : "Seus convites"}
            </h1>
            <p>
              Quem entra pelo seu link já fica conectado com você. Cada missão semanal concluída
              libera mais 1 convite.
            </p>
          </header>

          {isLoading && <p className={styles.notice}>Carregando convites...</p>}
          {error && <p className={styles.error}>{error}</p>}

          {status && (
            <>
              <section className={styles.card}>
                <h2>Seu link pessoal</h2>
                <div className={styles.linkRow}>
                  <code>{link}</code>
                </div>
                <div className={styles.actions}>
                  <button type="button" onClick={copyLink}>
                    {copied ? <HiCheck aria-hidden /> : <HiClipboardCopy aria-hidden />}
                    {copied ? "Copiado" : "Copiar link"}
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={shareLink}>
                    <HiShare aria-hidden />
                    Compartilhar
                  </button>
                </div>
                <p className={styles.muted}>
                  Código: <strong>{status.code}</strong> · {status.slots_used} de{" "}
                  {status.slots_total} convites usados
                </p>
              </section>

              {status.pioneer_azul_active && (
                <section className={styles.card}>
                  <h2>Selo Pioneiro Azul</h2>
                  <p className={styles.muted}>
                    Os primeiros 1.000 a trazer {status.pioneer_azul_target} amigos ganham o selo
                    azul para sempre. Restam {status.pioneer_azul_remaining.toLocaleString("pt-BR")}{" "}
                    vagas.
                  </p>
                  <div className={styles.progress} aria-hidden>
                    <span style={{ width: `${pioneerProgress * 100}%` }} />
                  </div>
                  <small className={styles.muted}>
                    {Math.min(acceptedCount, status.pioneer_azul_target)} de{" "}
                    {status.pioneer_azul_target} amigos
                  </small>
                </section>
              )}

              <section className={styles.card}>
                <h2>Quem entrou pelo seu convite</h2>
                {friends.length ? (
                  <div className={styles.friendList}>
                    {friends.map((friend) => {
                      const name = friend.display_name || friend.username || "Novo flow";
                      return (
                        <Link
                          className={styles.friend}
                          href={friend.username ? `/u/${friend.username}` : "#"}
                          key={friend.invitee_id}
                        >
                          <span className={styles.friendAvatar}>
                            {friend.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={friend.avatar_url} alt="" />
                            ) : (
                              name.slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <span className={styles.friendInfo}>
                            <strong>{name}</strong>
                            <small>
                              {friend.connected ? "Conectados" : "Entrou pelo seu convite"}
                            </small>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.notice}>
                    <HiUserAdd aria-hidden /> Ninguém entrou ainda. Mande seu link para quem você
                    quer ver na Fluxo.
                  </p>
                )}
              </section>
            </>
          )}
        </main>
      </PageCard>
    </AppShell>
  );
}
