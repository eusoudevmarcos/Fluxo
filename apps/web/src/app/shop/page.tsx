import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const shopCards = [
  { title: "Produtos perto de você", meta: "Em breve", description: "Marketplace futuro com localização e reputação social.", action: "Em breve" },
  { title: "Vendedores com reputação", meta: "Planejamento", description: "Histórico social e confiança entram antes de compra e venda real.", action: "Em breve" },
  { title: "Reviews sociais", meta: "Visão futura", description: "Avaliações conectadas ao perfil, comunidades e presença.", action: "Em breve" },
  { title: "Ocean Coin", meta: "Futuro regulado", description: "Integração futura sujeita a requisitos técnicos, legais e regulatórios.", action: "Em breve" },
];

export default function ShopPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Ocean Shop"
          title="Produtos, localização, reputação social e reviews"
          description="Preview visual do marketplace futuro. Compra, venda e pagamentos não estão ativos na beta."
          stats={[
            { label: "status", value: "em breve" },
            { label: "pagamento", value: "inativo" },
            { label: "wallet", value: "não ativa" },
            { label: "reviews", value: "futuro" },
          ]}
          items={shopCards}
        />
      </PageCard>
    </AppShell>
  );
}
