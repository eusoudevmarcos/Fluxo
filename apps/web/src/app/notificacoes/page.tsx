import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const notifications = [
  { title: "Gabriel deu dahora", meta: "agora", description: "Seu flow recebeu uma nova reacao e entrou em uma conversa ativa." },
  { title: "Marina marcou presenca", meta: "5 min atras", description: "Uma pessoa apareceu no seu momentum e pode virar conexao." },
  { title: "Nova recompensa disponivel", meta: "hoje", description: "Complete sua ficha para melhorar seu rate engage inicial." },
  { title: "Sala recomendada", meta: "ao vivo", description: "Uma sala combina com seus interesses e esta movimentada agora." },
];

export default function NotificacoesPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Notificacoes"
          title="Tudo que mexe com seu flow"
          description="Curtidas, respostas, seguidores, recompensas e presencas organizadas para voce nao perder o agora."
          stats={[{ label: "novas", value: "3" }, { label: "presencas", value: "18" }, { label: "waves", value: "6" }, { label: "recompensas", value: "1" }]}
          items={notifications}
        />
      </PageCard>
    </AppShell>
  );
}