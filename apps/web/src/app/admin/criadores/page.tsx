"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { getErrorMessage } from "@/lib/profiles/ensure-profile";
import {
  CREATOR_PLATFORMS,
  grantPendingCreatorRewards,
  isOfficialAccount,
  listCreatorApplications,
  reviewCreatorApplication,
  type CreatorApplicationForReview,
  type CreatorApplicationStatus,
} from "@/lib/services/creators.service";
import { createClient } from "@/lib/supabase/client";
import styles from "../../criadores/page.module.css";

const STATUS_TABS: { id: CreatorApplicationStatus; label: string }[] = [
  { id: "pending", label: "Pendentes" },
  { id: "approved", label: "Aprovadas" },
  { id: "rejected", label: "Recusadas" },
];

function platformLabel(platform: string) {
  return CREATOR_PLATFORMS.find((item) => item.id === platform)?.label ?? platform;
}

export default function AdminCriadoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CreatorApplicationStatus>("pending");
  const [applications, setApplications] = useState<CreatorApplicationForReview[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setApplications(await listCreatorApplications(supabase, status));
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Não foi possível carregar as inscrições."));
    }
  }, [status, supabase]);

  useEffect(() => {
    let isMounted = true;

    isOfficialAccount(supabase).then((allowed) => {
      if (isMounted) setIsAllowed(allowed);
    });

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!isAllowed) return;
    queueMicrotask(() => void load());
  }, [isAllowed, load]);

  async function handleReview(application: CreatorApplicationForReview, approve: boolean) {
    setPendingId(application.id);
    setMessage("");
    setError("");

    try {
      const result = await reviewCreatorApplication(
        supabase,
        application.id,
        approve,
        notes[application.id] ?? "",
      );
      setMessage(
        approve
          ? result.rewards_granted
            ? `@${application.username} aprovado: selo e tema liberados.`
            : `@${application.username} aprovado. Selo e tema ficam pendentes até a campanha Prime Influencer ser ligada.`
          : `Inscrição de @${application.username} recusada.`,
      );
      await load();
    } catch (reviewError) {
      setError(getErrorMessage(reviewError, "Não foi possível revisar."));
    } finally {
      setPendingId("");
    }
  }

  async function handleGrantPending() {
    setMessage("");
    setError("");
    try {
      const granted = await grantPendingCreatorRewards(supabase);
      setMessage(`${granted} recompensas entregues.`);
      await load();
    } catch (grantError) {
      setError(getErrorMessage(grantError, "Não foi possível entregar as recompensas."));
    }
  }

  return (
    <AppShell>
      <PageCard>
        <main className={styles.page}>
          <header className={styles.hero}>
            <span>Admin</span>
            <h1>Inscrições Prime Influencer</h1>
            <p>
              Antes de aprovar, abra o perfil da pessoa na rede externa e confira se o código de
              verificação está na bio.
            </p>
          </header>

          {isAllowed === null && <p className={styles.notice}>Verificando acesso...</p>}
          {isAllowed === false && (
            <p className={styles.error}>Acesso restrito às contas oficiais da Fluxo.</p>
          )}

          {isAllowed && (
            <>
              <div className={styles.actions}>
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    className={status === tab.id ? styles.primary : styles.secondary}
                    type="button"
                    onClick={() => setStatus(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
                {status === "approved" && (
                  <button className={styles.secondary} type="button" onClick={handleGrantPending}>
                    Entregar recompensas pendentes
                  </button>
                )}
              </div>

              {message && <p className={styles.notice}>{message}</p>}
              {error && <p className={styles.error}>{error}</p>}

              {!applications.length && !error && (
                <p className={styles.notice}>Nenhuma inscrição aqui.</p>
              )}

              {applications.map((application) => (
                <section className={styles.card} key={application.id}>
                  <h2>
                    {application.display_name || application.username}{" "}
                    {application.username && (
                      <Link href={`/u/${application.username}`}>@{application.username}</Link>
                    )}
                  </h2>
                  <p className={styles.muted}>
                    {platformLabel(application.platform)}: @{application.handle} ·{" "}
                    {application.followers_count.toLocaleString("pt-BR")} seguidores
                    {application.niche ? ` · ${application.niche}` : ""}
                  </p>
                  {application.profile_url && /^https?:\/\//i.test(application.profile_url) && (
                    <a href={application.profile_url} rel="noreferrer noopener" target="_blank">
                      {application.profile_url}
                    </a>
                  )}
                  {application.message && <p className={styles.muted}>{application.message}</p>}
                  <div className={styles.codeBox}>
                    <strong>{application.verification_code}</strong>
                  </div>
                  {application.status === "approved" && (
                    <p className={styles.muted}>
                      {application.rewards_granted ? "Selo e tema entregues." : "Recompensa pendente."}
                    </p>
                  )}

                  {application.status === "pending" && (
                    <>
                      <label>
                        Observação para o criador (opcional)
                        <input
                          value={notes[application.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [application.id]: event.target.value }))
                          }
                        />
                      </label>
                      <div className={styles.actions}>
                        <button
                          className={styles.secondary}
                          disabled={pendingId === application.id}
                          type="button"
                          onClick={() => handleReview(application, false)}
                        >
                          Recusar
                        </button>
                        <button
                          className={styles.primary}
                          disabled={pendingId === application.id}
                          type="button"
                          onClick={() => handleReview(application, true)}
                        >
                          Aprovar
                        </button>
                      </div>
                    </>
                  )}
                </section>
              ))}
            </>
          )}
        </main>
      </PageCard>
    </AppShell>
  );
}
