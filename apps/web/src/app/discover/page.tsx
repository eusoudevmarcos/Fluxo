import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { PeopleDiscoverClient } from "./PeopleDiscoverClient";

type DiscoverPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params?.q) ? params?.q[0] : params?.q;

  return (
    <AppShell>
      <PageCard>
        <PeopleDiscoverClient initialQuery={rawQuery ?? ""} />
      </PageCard>
    </AppShell>
  );
}
