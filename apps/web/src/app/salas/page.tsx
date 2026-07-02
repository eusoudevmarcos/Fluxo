import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const rooms = [
  { title: "Salas nas Comunidades", meta: "Beta", description: "As salas reais vivem dentro das comunidades e já têm chat básico por texto.", action: "Abrir Comunidades" },
  { title: "Até 200 pessoas", meta: "Capacidade", description: "Cada sala mostra capacidade e presença aproximada para organizar conversas.", action: "Em breve" },
  { title: "Eventos e Vibes", meta: "Visão futura", description: "Salas públicas separadas entram depois, conectadas a eventos e Vibes.", action: "Em breve" },
  { title: "Moderação", meta: "Próxima fase", description: "Antes de escala, salas terão denúncias, limites e regras mais fortes.", action: "Em breve" },
];

export default function SalasPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Salas"
          title="Conversas ao vivo dentro das Comunidades"
          description="Na beta, as salas ficam nas comunidades. A rota separada mostra o plano futuro sem prometer live real."
          stats={[
            { label: "status", value: "beta" },
            { label: "chat", value: "básico" },
            { label: "capacidade", value: "200" },
            { label: "realtime", value: "fallback" },
          ]}
          items={rooms}
        />
      </PageCard>
    </AppShell>
  );
}
