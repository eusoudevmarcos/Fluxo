"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { getErrorMessage } from "@/lib/profiles/ensure-profile";
import { getGrowthMetrics, type GrowthMetrics } from "@/lib/services/admin.service";
import { isOfficialAccount } from "@/lib/services/creators.service";
import { createClient } from "@/lib/supabase/client";
import styles from "../../criadores/page.module.css";

const SECTIONS: { key: keyof GrowthMetrics; title: string; labels: Record<string, string> }[] = [
  {
    key: "users",
    title: "Usuários",
    labels: {
      total: "Contas",
      completed_signup: "Cadastro completo",
      new_today: "Novos hoje",
      new_7d: "Novos (7 dias)",
      active_today: "Ativos hoje",
      active_7d: "Ativos (7 dias)",
      teens: "Adolescentes",
      nearby_enabled: "Pessoas próximas ativado",
    },
  },
  {
    key: "invites",
    title: "Convites",
    labels: {
      accepted_total: "Aceitos (total)",
      accepted_7d: "Aceitos (7 dias)",
      inviters_total: "Pessoas que trouxeram alguém",
      signups_via_invite_pct: "% de cadastros via convite",
    },
  },
  {
    key: "missions",
    title: "Missões",
    labels: {
      completed_today: "Concluídas hoje",
      completed_7d: "Concluídas (7 dias)",
      users_completing_7d: "Pessoas cumprindo (7 dias)",
    },
  },
  {
    key: "content",
    title: "Conteúdo e interação (7 dias)",
    labels: {
      posts_today: "Posts hoje",
      posts_7d: "Posts",
      comments_7d: "Comentários",
      waves_7d: "Waves",
      follows_7d: "Novos seguidores",
    },
  },
  {
    key: "safety",
    title: "Segurança e beta",
    labels: {
      open_reports: "Denúncias abertas",
      hidden_contents: "Posts ocultos/removidos",
      blocks_7d: "Bloqueios (7 dias)",
      feedback_7d: "Feedbacks (7 dias)",
      crashes_7d: "Erros do app (7 dias)",
    },
  },
  {
    key: "creators",
    title: "Prime Influencer",
    labels: { pending: "Inscrições pendentes", approved: "Aprovados" },
  },
];

export default function AdminMetricasPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const allowed = await isOfficialAccount(supabase);
      if (!isMounted) return;
      setIsAllowed(allowed);
      if (!allowed) return;

      try {
        const nextMetrics = await getGrowthMetrics(supabase);
        if (isMounted) setMetrics(nextMetrics);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError, "Rode as migrations até a 057."));
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return (
    <AppShell>
      <PageCard>
        <main className={styles.page}>
          <header className={styles.hero}>
            <span>Admin</span>
            <h1>Métricas do crescimento</h1>
            <p>
              Números ao vivo do beta. Ver também <Link href="/admin/moderacao">moderação</Link> e{" "}
              <Link href="/admin/criadores">criadores</Link>.
            </p>
          </header>

          {isAllowed === null && <p className={styles.notice}>Verificando acesso...</p>}
          {isAllowed === false && (
            <p className={styles.error}>Acesso restrito às contas oficiais da Fluxo.</p>
          )}
          {error && <p className={styles.error}>{error}</p>}

          {metrics && (
            <>
              <section className={styles.perks}>
                {SECTIONS.flatMap((section) => {
                  const values = metrics[section.key] as Record<string, number>;
                  return Object.entries(section.labels).map(([field, label]) => (
                    <div key={`${section.key}.${field}`}>
                      <small>{section.title}</small>
                      <strong style={{ fontSize: 26 }}>
                        {Number(values?.[field] ?? 0).toLocaleString("pt-BR")}
                      </strong>
                      <small>{label}</small>
                    </div>
                  ));
                })}
              </section>

              <section className={styles.card}>
                <h2>Campanhas de selo</h2>
                {metrics.seal_campaigns.map((campaign) => (
                  <p className={styles.muted} key={campaign.slug}>
                    <strong>{campaign.title}</strong>: {campaign.granted.toLocaleString("pt-BR")} de{" "}
                    {campaign.max.toLocaleString("pt-BR")} {campaign.active ? "(ativa)" : "(desligada)"}
                  </p>
                ))}
              </section>

              <p className={styles.muted}>
                Atualizado em {new Date(metrics.generated_at).toLocaleString("pt-BR")}.
              </p>
            </>
          )}
        </main>
      </PageCard>
    </AppShell>
  );
}
