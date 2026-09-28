// Versoes vigentes dos documentos legais, compartilhadas entre web e mobile. Mudar qualquer uma
// faz todo mundo aceitar de novo (legal_acceptances guarda o aceite por versao).
export const LEGAL_TERMS_VERSION = "2026-09-beta-2";
export const LEGAL_PRIVACY_VERSION = "2026-09-beta-2";
export const LEGAL_COMMUNITY_VERSION = "2026-09-beta-2";
export const LEGAL_CONTENT_LICENSE_VERSION = "2026-09-beta-2";

export const CURRENT_LEGAL_VERSIONS = {
  terms_version: LEGAL_TERMS_VERSION,
  privacy_version: LEGAL_PRIVACY_VERSION,
  community_version: LEGAL_COMMUNITY_VERSION,
  content_license_version: LEGAL_CONTENT_LICENSE_VERSION,
} as const;
