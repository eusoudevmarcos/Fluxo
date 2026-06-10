import { AppShell } from "@/components/layout/AppShell";
import { OceanEcosystem } from "@/components/ecosystem/OceanEcosystem";
import { PageCard } from "@/components/ui/PageCard";

export default function MaisPage() {
  return (
    <AppShell>
      <PageCard>
        <OceanEcosystem />
      </PageCard>
    </AppShell>
  );
}
