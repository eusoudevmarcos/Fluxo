import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const discoverItems = [
  { title: "Em alta", meta: "Preview", description: "Descubra criações, Flows e Moments que começam a ganhar presença.", action: "Em breve" },
  { title: "Comunidades crescendo", meta: "Beta", description: "Atalho para encontrar comunidades oficiais e criadas pela galera.", action: "Explorar" },
  { title: "Novos creators", meta: "Em breve", description: "Sugestões reais entram quando Fãs, Seletos e ranking estiverem maduros.", action: "Em breve" },
  { title: "Moments do dia", meta: "Visual", description: "Entrada para o que está viralizando agora na Ocean.", action: "Ver Moments" },
];

export default function DiscoverPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Discover"
          title="Descubra flows, comunidades, creators e moments"
          description="Um ponto de entrada para achar o que está se espalhando na Ocean."
          stats={[
            { label: "Flows", value: "beta" },
            { label: "Moments", value: "ativo" },
            { label: "comunidades", value: "base" },
            { label: "ranking", value: "em breve" },
          ]}
          items={discoverItems}
        />
      </PageCard>
    </AppShell>
  );
}
