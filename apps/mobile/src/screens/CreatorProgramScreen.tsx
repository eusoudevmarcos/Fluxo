import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  CREATOR_MIN_FOLLOWERS,
  CREATOR_PLATFORMS,
  getMyCreatorApplication,
  getPrimeInfluencerCampaign,
  submitCreatorApplication,
  type CreatorApplication,
  type CreatorApplicationInput,
  type PrimeInfluencerCampaign,
} from "../lib/services/creators.service";

type CreatorProgramScreenProps = {
  onBack: () => void;
};

const EMPTY_FORM: CreatorApplicationInput = {
  platform: "instagram",
  handle: "",
  profile_url: "",
  followers_count: 0,
  niche: "",
  message: "",
};

function platformLabel(platform: string) {
  return CREATOR_PLATFORMS.find((item) => item.id === platform)?.label ?? platform;
}

export function CreatorProgramScreen({ onBack }: CreatorProgramScreenProps) {
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [campaign, setCampaign] = useState<PrimeInfluencerCampaign | null>(null);
  const [form, setForm] = useState<CreatorApplicationInput>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const supabase = createMobileSupabaseClient();

    Promise.all([getMyCreatorApplication(supabase), getPrimeInfluencerCampaign(supabase)])
      .then(([nextApplication, nextCampaign]) => {
        if (!isMounted) return;
        setApplication(nextApplication);
        setCampaign(nextCampaign);
        if (nextApplication) {
          setForm({
            platform: nextApplication.platform,
            handle: nextApplication.handle,
            profile_url: nextApplication.profile_url ?? "",
            followers_count: nextApplication.followers_count,
            niche: nextApplication.niche ?? "",
            message: nextApplication.message ?? "",
          });
        }
      })
      .catch(() => {
        if (isMounted) setErrorMessage("Rode a migration 054 para ativar o programa Prime Influencer.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateForm(patch: Partial<CreatorApplicationInput>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit() {
    setErrorMessage("");

    if (!form.handle.trim()) {
      setErrorMessage("Informe seu @ na rede social.");
      return;
    }

    if (form.followers_count < CREATOR_MIN_FOLLOWERS) {
      setErrorMessage(
        `O programa é para criadores com pelo menos ${CREATOR_MIN_FOLLOWERS.toLocaleString("pt-BR")} seguidores.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const saved = await submitCreatorApplication(createMobileSupabaseClient(), form);
      setApplication(saved);
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível enviar.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#f0c75e" size="large" />
      </View>
    );
  }

  const spotsLeft = campaign ? Math.max(campaign.max_grants - campaign.granted_count, 0) : null;
  const showForm = !application || isEditing;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Prime Influencer</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>PRIMEIROS CRIADORES DA FLUXO</Text>
          <Text style={styles.heroTitle}>Selo Prime Influencer + tema Prime Gold</Text>
          <Text style={styles.muted}>
            Os 5 mil primeiros criadores aprovados ganham o selo para sempre, o tema exclusivo e
            mais alcance nas sugestões.
            {spotsLeft !== null && campaign?.is_active
              ? ` Restam ${spotsLeft.toLocaleString("pt-BR")} vagas.`
              : ""}
          </Text>
        </View>

        {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        {application && !isEditing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sua inscrição</Text>

            {application.status === "pending" && (
              <>
                <Text style={styles.status}>⏳ Em análise</Text>
                <Text style={styles.muted}>
                  Para provar que o perfil é seu, coloque este código na bio do seu{" "}
                  {platformLabel(application.platform)} (@{application.handle}) até a aprovação.
                  Depois pode tirar.
                </Text>
                <Pressable
                  onPress={() => void Share.share({ message: application.verification_code })}
                  style={styles.codeBox}
                >
                  <Text style={styles.code}>{application.verification_code}</Text>
                  <Text style={styles.codeHint}>Toque para copiar/compartilhar</Text>
                </Pressable>
                <Pressable onPress={() => setIsEditing(true)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Editar inscrição</Text>
                </Pressable>
              </>
            )}

            {application.status === "approved" && (
              <>
                <Text style={styles.status}>✓ Aprovada</Text>
                <Text style={styles.muted}>
                  {application.rewards_granted
                    ? "Selo Prime Influencer e tema Prime Gold liberados."
                    : "Você está na lista! O selo e o tema serão liberados em breve, na ordem de aprovação."}
                </Text>
              </>
            )}

            {application.status === "rejected" && (
              <>
                <Text style={styles.status}>✕ Não aprovada desta vez</Text>
                {!!application.review_note && (
                  <Text style={styles.muted}>{application.review_note}</Text>
                )}
                <Pressable onPress={() => setIsEditing(true)} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Atualizar e reenviar</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {showForm && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quero ser Prime Influencer</Text>
            <Text style={styles.muted}>
              Para maiores de 18 anos, com pelo menos{" "}
              {CREATOR_MIN_FOLLOWERS.toLocaleString("pt-BR")} seguidores em outra rede.
            </Text>

            <Text style={styles.label}>Rede principal</Text>
            <View style={styles.chipRow}>
              {CREATOR_PLATFORMS.map((platform) => (
                <Pressable
                  key={platform.id}
                  onPress={() => updateForm({ platform: platform.id })}
                  style={[styles.chip, form.platform === platform.id && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, form.platform === platform.id && styles.chipTextActive]}
                  >
                    {platform.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Seu @ nessa rede</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => updateForm({ handle: value })}
              placeholder="@seuperfil"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={form.handle}
            />

            <Text style={styles.label}>Seguidores</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) =>
                updateForm({ followers_count: Number(value.replace(/\D/g, "")) || 0 })
              }
              placeholder="Ex: 15000"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={form.followers_count ? String(form.followers_count) : ""}
            />

            <Text style={styles.label}>Nicho</Text>
            <TextInput
              onChangeText={(value) => updateForm({ niche: value })}
              placeholder="Ex: humor, games, moda, música"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={form.niche}
            />

            <Text style={styles.label}>Link do perfil</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={(value) => updateForm({ profile_url: value })}
              placeholder="https://..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={form.profile_url}
            />

            <Text style={styles.label}>O que você vai criar na Fluxo? (opcional)</Text>
            <TextInput
              maxLength={600}
              multiline
              onChangeText={(value) => updateForm({ message: value })}
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={[styles.input, styles.textArea]}
              value={form.message}
            />

            <Pressable disabled={isSaving} onPress={handleSubmit} style={styles.primaryButton}>
              {isSaving ? (
                <ActivityIndicator color="#140f05" />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar inscrição</Text>
              )}
            </Pressable>
            {application && (
              <Pressable onPress={() => setIsEditing(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#030711",
    flex: 1,
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#030711",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    gap: 14,
    paddingBottom: 118,
    paddingHorizontal: 20,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
    paddingTop: 56,
  },
  backButton: {
    minWidth: 28,
    padding: 4,
  },
  backText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  hero: {
    backgroundColor: "rgba(212,165,55,0.1)",
    borderColor: "rgba(212,165,55,0.35)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  heroEyebrow: {
    color: "#f0c75e",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  muted: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    padding: 12,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  status: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  codeBox: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 2,
    padding: 12,
  },
  code: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
  },
  codeHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  label: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: "#d4a537",
    borderColor: "#d4a537",
  },
  chipText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#140f05",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#d4a537",
    borderRadius: 16,
    marginTop: 6,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#140f05",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
