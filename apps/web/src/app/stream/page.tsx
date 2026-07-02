import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const streamCards = [
  { title: "Criadores ao vivo", meta: "Em breve", description: "Lives de jogos, música, arte, lifestyle e eventos.", action: "Em breve" },
  { title: "Salas de eventos", meta: "Planejamento", description: "Eventos podem virar salas e Vibes quando o realtime avançado chegar.", action: "Em breve" },
  { title: "Recompensas", meta: "Futuro", description: "Auras, Selos e XP poderão se conectar a eventos ao vivo.", action: "Em breve" },
  { title: "Presença em tempo real", meta: "Visão futura", description: "A Wave vai priorizar presença viva sem implementar lives reais agora.", action: "Em breve" },
];

export default function StreamPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Wave Stream"
          title="Lives de jogos, música, arte, lifestyle e eventos"
          description="Preview visual do Stream. Transmissão ao vivo real não está ativa na beta."
          stats={[
            { label: "status", value: "em breve" },
            { label: "lives", value: "inativas" },
            { label: "eventos", value: "futuro" },
            { label: "presença", value: "planejada" },
          ]}
          items={streamCards}
        />
      </PageCard>
    </AppShell>
  );
}
