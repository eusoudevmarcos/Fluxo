import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { PublicProfileClient } from "./PublicProfileClient";

type PublicProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;

  return (
    <AppShell>
      <PageCard>
        <PublicProfileClient username={username} />
      </PageCard>
    </AppShell>
  );
}
