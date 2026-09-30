import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const notifications = [
  { title: "Gabriel deu Dahora", meta: "agora", description: "Seu Flow recebeu uma nova reação e entrou em uma conversa ativa." },
  { title: "Marina marcou Presença", meta: "5 min atrás", description: "Uma pessoa apareceu nos seus moments e pode virar conexão." },
  { title: "Nova recompensa disponível", meta: "hoje", description: "Complete sua ficha para melhorar seu engage inicial." },
  { title: "Sala recomendada", meta: "ao vivo", description: "Uma sala combina com seus interesses e está movimentada agora." },
];

export default function NotificacoesPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Notificações"
          title="Tudo que mexe com seu flow"
          description="Dahoras, respostas, fãs, recompensas e Presenças organizadas para você não perder o agora."
          stats={[{ label: "novas", value: "3" }, { label: "presenças", value: "18" }, { label: "waves", value: "6" }, { label: "recompensas", value: "1" }]}
          items={notifications}
        />
      </PageCard>
    </AppShell>
  );
}
