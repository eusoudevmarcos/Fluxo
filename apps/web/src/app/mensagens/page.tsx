import { AppShell } from "@/components/layout/AppShell";
import { FeaturePage } from "@/components/pages/FeaturePage";
import { PageCard } from "@/components/ui/PageCard";

const conversations = [
  { title: "Marcos Ocean", meta: "online agora", description: "Conversa preparada para mensagens privadas da Ocean." },
  { title: "Grupo Surf Brasil", meta: "12 novas", description: "Comunidade chamando para um role perto de voce." },
  { title: "Marina Souza", meta: "ha 20 min", description: "Respondeu sobre uma vibe em comum no Date." },
  { title: "Ocean Creators", meta: "sala vinculada", description: "Troca rapida para criadores e perfis em crescimento." },
];

export default function PrivsPage() {
  return (
    <AppShell>
      <PageCard>
        <FeaturePage
          eyebrow="Privs"
          title="Privs da Ocean"
          description="Base visual para conversas privadas, grupos e trocas que nascem de Flows, comunidades, salas e Date."
          stats={[{ label: "abertas", value: "4" }, { label: "nao lidas", value: "12" }, { label: "grupos", value: "2" }, { label: "online", value: "8" }]}
          items={conversations}
        />
      </PageCard>
    </AppShell>
  );
}
