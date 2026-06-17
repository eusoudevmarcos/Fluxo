import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const dateCards = [
  { title: "Vibe Match", meta: "Em breve", description: "Conexões por vibe, interesses e intenção declarada no perfil.", action: "Em breve" },
  { title: "Pessoas perto de você", meta: "Segurança", description: "Localização ajuda a sugerir conexões próximas sem expor coordenadas.", action: "Em breve" },
  { title: "Segurança reforçada", meta: "Elegibilidade", description: "Disponível futuramente apenas para usuários elegíveis e maiores de idade.", action: "Em breve" },
  { title: "Filtros sociais", meta: "Visão futura", description: "Preferências, comunidades e presença social entram como contexto.", action: "Em breve" },
];

export default function DatePage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Wave Date"
          title="Conexões com vibe, localização e segurança"
          description="Preview do recurso futuro da Wave. Não há match real ativo na beta."
          stats={[
            { label: "status", value: "em breve" },
            { label: "idade", value: "18+" },
            { label: "segurança", value: "prioridade" },
            { label: "match", value: "futuro" },
          ]}
          items={dateCards}
        />
      </PageCard>
    </AppShell>
  );
}
