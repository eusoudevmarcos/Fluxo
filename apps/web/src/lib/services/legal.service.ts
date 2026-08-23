import type { SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_LEGAL_VERSIONS } from "@/lib/legal/legal-versions";

export type LegalAcceptance = {
  id: string;
  user_id: string;
  terms_version: string;
  privacy_version: string;
  community_version: string;
  content_license_version: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export async function getCurrentLegalAcceptance(
  supabase: SupabaseClient,
): Promise<LegalAcceptance | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("terms_version", CURRENT_LEGAL_VERSIONS.terms_version)
    .eq("privacy_version", CURRENT_LEGAL_VERSIONS.privacy_version)
    .eq("community_version", CURRENT_LEGAL_VERSIONS.community_version)
    .eq("content_license_version", CURRENT_LEGAL_VERSIONS.content_license_version)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data as LegalAcceptance | null;
}

export async function hasAcceptedCurrentLegalVersions(supabase: SupabaseClient) {
  return Boolean(await getCurrentLegalAcceptance(supabase));
}

export async function acceptCurrentLegalVersions(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Entre na Fluxo para aceitar os documentos.");
  }

  const userAgent =
    typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 500);

  const { data, error } = await supabase
    .from("legal_acceptances")
    .upsert(
      {
        user_id: userData.user.id,
        ...CURRENT_LEGAL_VERSIONS,
        user_agent: userAgent,
      },
      {
        onConflict:
          "user_id,terms_version,privacy_version,community_version,content_license_version",
      },
    )
    .select("*")
    .single();

  if (error) throw error;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      legal_terms_accepted: true,
      legal_terms_accepted_at: new Date().toISOString(),
      legal_terms_version: CURRENT_LEGAL_VERSIONS.terms_version,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userData.user.id);

  if (profileError) throw profileError;

  return data as LegalAcceptance;
}
