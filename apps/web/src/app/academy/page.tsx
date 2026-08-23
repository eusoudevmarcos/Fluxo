import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const academyCards = [
  { title: "Cursos rápidos", meta: "Em breve", description: "Aulas curtas por criadores, especialistas e comunidades.", action: "Em breve" },
  { title: "Trilhas de aprendizado", meta: "Planejamento", description: "Caminhos de estudo conectados a perfil, Aura e conquistas.", action: "Em breve" },
  { title: "Criadores especialistas", meta: "Futuro", description: "Espaço para quem ensina, cria e movimenta comunidades.", action: "Em breve" },
  { title: "Monetização futura", meta: "Não ativa", description: "Sem pagamentos ou venda de cursos nesta beta.", action: "Em breve" },
];

export default function AcademyPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Fluxo Academy"
          title="Cursos por criadores, especialistas e comunidades"
          description="Preview visual da Academy. Cursos reais e monetização ficam para depois da beta."
          stats={[
            { label: "status", value: "em breve" },
            { label: "cursos", value: "inativos" },
            { label: "pagamento", value: "não ativo" },
            { label: "trilhas", value: "futuro" },
          ]}
          items={academyCards}
        />
      </PageCard>
    </AppShell>
  );
}
