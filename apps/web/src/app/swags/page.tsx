import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const flows = [
  { title: "Surf no pôr do sol", meta: "12,4k dahoras", description: "Vídeo curto quase quadrado com clima cinematográfico e alta presença.", action: "Assistir" },
  { title: "Treino de domingo", meta: "8,1k waves", description: "Conteúdo rápido com energia social e comentários acontecendo agora.", action: "Abrir" },
  { title: "Vida na cidade", meta: "5,8k presencas", description: "Recortes visuais do agora em cards leves e faceis de explorar.", action: "Ver" },
  { title: "Trips Fluxo", meta: "2,7k seletos", description: "Flows de viagem, lifestyle e comunidades conectadas por vibe.", action: "Discover" },
];

export default function FlowsPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Flows"
          title="Videos rapidos em cards vivos"
          description="Conteudos retangulares e quase quadrados para descobrir pessoas, lugares e vibes sem sair do flow."
          stats={[{ label: "assistidos", value: "1,2M" }, { label: "dahoras", value: "240k" }, { label: "waves", value: "82k" }, { label: "novos hoje", value: "418" }]}
          items={flows}
        />
      </PageCard>
    </AppShell>
  );
}
