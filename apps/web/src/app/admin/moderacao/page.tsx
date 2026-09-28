"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { getErrorMessage } from "@/lib/profiles/ensure-profile";
import {
  REPORT_REASON_LABELS,
  listAppFeedback,
  listOpenReports,
  resolveReports,
  type AppFeedback,
  type OpenReport,
} from "@/lib/services/admin.service";
import { isOfficialAccount } from "@/lib/services/creators.service";
import { createClient } from "@/lib/supabase/client";
import styles from "../../criadores/page.module.css";

type Tab = "reports" | "feedback" | "crash";

const TARGET_LABELS: Record<OpenReport["target_type"], string> = {
  content: "Post",
  comment: "Comentário",
  profile: "Perfil",
  message: "Mensagem",
};

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminModeracaoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<OpenReport[]>([]);
  const [feedback, setFeedback] = useState<AppFeedback[]>([]);
  const [pendingKey, setPendingKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      if (tab === "reports") {
        setReports(await listOpenReports(supabase));
      } else {
        const rows = await listAppFeedback(supabase, tab === "crash" ? "crash" : null);
        setFeedback(tab === "crash" ? rows : rows.filter((row) => row.kind !== "crash"));
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Rode a migration 055 para ativar a moderação."));
    }
  }, [supabase, tab]);

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

  async function handleResolve(report: OpenReport, action: "dismiss" | "remove") {
    const key = `${report.target_type}:${report.target_id}`;
    setPendingKey(key);
    setMessage("");
    setError("");
    try {
      await resolveReports(supabase, report.target_type, report.target_id, action);
      setMessage(action === "remove" ? "Conteúdo removido." : "Denúncias arquivadas; conteúdo mantido.");
      await load();
    } catch (resolveError) {
      setError(getErrorMessage(resolveError, "Não foi possível resolver."));
    } finally {
      setPendingKey("");
    }
  }

  return (
    <AppShell>
      <PageCard>
        <main className={styles.page}>
          <header className={styles.hero}>
            <span>Admin</span>
            <h1>Moderação e feedback do beta</h1>
            <p>
              Denúncias agrupadas por conteúdo (posts com 5 denúncias ficam ocultos até a revisão),
              feedbacks e erros enviados pelo app. Ver também{" "}
              <Link href="/admin/metricas">métricas</Link> e{" "}
              <Link href="/admin/criadores">criadores</Link>.
            </p>
          </header>

          {isAllowed === null && <p className={styles.notice}>Verificando acesso...</p>}
          {isAllowed === false && (
            <p className={styles.error}>Acesso restrito às contas oficiais da Fluxo.</p>
          )}

          {isAllowed && (
            <>
              <div className={styles.actions}>
                {(
                  [
                    ["reports", "Denúncias"],
                    ["feedback", "Feedbacks"],
                    ["crash", "Erros do app"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={tab === id ? styles.primary : styles.secondary}
                    type="button"
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {message && <p className={styles.notice}>{message}</p>}
              {error && <p className={styles.error}>{error}</p>}

              {tab === "reports" &&
                (reports.length ? (
                  reports.map((report) => {
                    const key = `${report.target_type}:${report.target_id}`;
                    return (
                      <section className={styles.card} key={key}>
                        <h2>
                          {TARGET_LABELS[report.target_type]} de{" "}
                          {report.target_username ? (
                            <Link href={`/u/${report.target_username}`}>@{report.target_username}</Link>
                          ) : (
                            "usuário"
                          )}{" "}
                          · {report.report_count} denúncia{report.report_count > 1 ? "s" : ""}
                        </h2>
                        <p className={styles.muted}>
                          {report.reasons.map((reason) => REPORT_REASON_LABELS[reason] ?? reason).join(", ")}{" "}
                          · desde {formatDate(report.first_reported_at)}
                          {report.content_visibility === "removed" ? " · oculto automaticamente" : ""}
                        </p>
                        {report.content_text && <p className={styles.muted}>“{report.content_text}”</p>}
                        {report.content_media_url && /^https?:\/\//i.test(report.content_media_url) && (
                          <a href={report.content_media_url} rel="noreferrer noopener" target="_blank">
                            Ver mídia
                          </a>
                        )}
                        {report.details.map((detail, index) => (
                          <p className={styles.muted} key={index}>
                            Detalhe: {detail}
                          </p>
                        ))}
                        <div className={styles.actions}>
                          <button
                            className={styles.secondary}
                            disabled={pendingKey === key}
                            type="button"
                            onClick={() => handleResolve(report, "dismiss")}
                          >
                            Manter (arquivar denúncias)
                          </button>
                          {report.target_type !== "profile" && (
                            <button
                              className={styles.primary}
                              disabled={pendingKey === key}
                              type="button"
                              onClick={() => handleResolve(report, "remove")}
                            >
                              Remover conteúdo
                            </button>
                          )}
                        </div>
                      </section>
                    );
                  })
                ) : (
                  !error && <p className={styles.notice}>Nenhuma denúncia aberta.</p>
                ))}

              {tab !== "reports" &&
                (feedback.length ? (
                  feedback.map((item) => (
                    <section className={styles.card} key={item.id}>
                      <h2>
                        {item.kind === "crash" ? "Erro" : item.kind === "bug" ? "Bug" : item.kind === "idea" ? "Ideia" : "Outro"}{" "}
                        · {formatDate(item.created_at)}
                      </h2>
                      <p className={styles.muted}>
                        {item.platform ?? "?"} · versão {item.app_version ?? "?"}
                      </p>
                      <p className={styles.muted} style={{ whiteSpace: "pre-wrap" }}>
                        {item.message}
                      </p>
                      {item.kind === "crash" && typeof item.context.stack === "string" && (
                        <pre className={styles.codeBox} style={{ overflowX: "auto", textAlign: "left" }}>
                          {item.context.stack}
                        </pre>
                      )}
                    </section>
                  ))
                ) : (
                  !error && <p className={styles.notice}>Nada por aqui ainda.</p>
                ))}
            </>
          )}
        </main>
      </PageCard>
    </AppShell>
  );
}
