import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_LEGAL_VERSIONS } from "@ocean/shared";
import { Platform } from "react-native";

// Documentos legais ficam no site (mesma fonte do web).
export function getLegalDocumentUrl(slug: "termos" | "privacidade" | "diretrizes" | "conteudo-imagem") {
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, "");
  return webUrl ? `${webUrl}/legal/${slug}` : null;
}

export async function hasAcceptedCurrentLegalVersions(supabase: SupabaseClient) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("terms_version", CURRENT_LEGAL_VERSIONS.terms_version)
    .eq("privacy_version", CURRENT_LEGAL_VERSIONS.privacy_version)
    .eq("community_version", CURRENT_LEGAL_VERSIONS.community_version)
    .eq("content_license_version", CURRENT_LEGAL_VERSIONS.content_license_version)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

// Registra o aceite da versao vigente (mesma tabela do web). Insert simples: a tabela nao tem
// policy de update, e um aceite repetido da mesma versao ja basta.
export async function acceptCurrentLegalVersions(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para aceitar os documentos.");

  const { error } = await supabase.from("legal_acceptances").insert({
    user_id: userData.user.id,
    ...CURRENT_LEGAL_VERSIONS,
    user_agent: `fluxo-mobile/${Platform.OS}`,
  });

  if (error && error.code !== "23505") throw error;

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
}
