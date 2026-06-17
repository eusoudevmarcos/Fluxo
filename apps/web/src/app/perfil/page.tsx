import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { ensureProfileWithClient } from "@/lib/profiles/ensure-profile";
import { hasAcceptedCurrentLegalVersions } from "@/lib/services/legal.service";
import { getSupabaseConfigError } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { PerfilClient } from "./PerfilClient";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  if (getSupabaseConfigError()) {
    redirect("/auth?mode=login");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth?mode=login");
  }

  const [profile, hasLegalAcceptance] = await Promise.all([
    ensureProfileWithClient(supabase),
    hasAcceptedCurrentLegalVersions(supabase),
  ]);

  if (!hasLegalAcceptance) {
    redirect("/legal/accept");
  }

  if (!profile.onboarding_completed || !profile.profile_required_completed) {
    redirect("/onboarding");
  }

  return (
    <AppShell>
      <PageCard>
        <PerfilClient />
      </PageCard>
    </AppShell>
  );
}
