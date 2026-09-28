"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HiBadgeCheck, HiClock, HiColorSwatch, HiSparkles, HiXCircle } from "react-icons/hi";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { getErrorMessage } from "@/lib/profiles/ensure-profile";
import {
  CREATOR_MIN_FOLLOWERS,
  CREATOR_PLATFORMS,
  getMyCreatorApplication,
  getPrimeInfluencerCampaign,
  submitCreatorApplication,
  type CreatorApplication,
  type CreatorApplicationInput,
  type PrimeInfluencerCampaign,
} from "@/lib/services/creators.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

const emptyForm: CreatorApplicationInput = {
  platform: "instagram",
  handle: "",
  profile_url: "",
  followers_count: 0,
  niche: "",
  message: "",
};

function formFromApplication(application: CreatorApplication): CreatorApplicationInput {
  return {
    platform: application.platform,
    handle: application.handle,
    profile_url: application.profile_url ?? "",
    followers_count: application.followers_count,
    niche: application.niche ?? "",
    message: application.message ?? "",
  };
}

export default function CriadoresPage() {
  const supabase = useMemo(() => createClient(), []);
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [campaign, setCampaign] = useState<PrimeInfluencerCampaign | null>(null);
  const [form, setForm] = useState<CreatorApplicationInput>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [nextApplication, nextCampaign] = await Promise.all([
          getMyCreatorApplication(supabase),
          getPrimeInfluencerCampaign(supabase),
        ]);
        if (!isMounted) return;
        setApplication(nextApplication);
        setCampaign(nextCampaign);
        if (nextApplication) setForm(formFromApplication(nextApplication));
      } catch {
        if (isMounted) setError("Rode a migration 054 para ativar o programa Prime Influencer.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  function updateField<T extends keyof CreatorApplicationInput>(
    field: T,
    value: CreatorApplicationInput[T],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.followers_count < CREATOR_MIN_FOLLOWERS) {
      setError(
        `O programa é para criadores com pelo menos ${CREATOR_MIN_FOLLOWERS.toLocaleString("pt-BR")} seguidores.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const saved = await submitCreatorApplication(supabase, form);
      setApplication(saved);
      setIsEditing(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Não foi possível enviar sua inscrição."));
    } finally {
      setIsSaving(false);
    }
  }

  const spotsLeft = campaign ? Math.max(campaign.max_grants - campaign.granted_count, 0) : null;
  const showForm = !application || isEditing;

  return (
    <AppShell>
      <PageCard>
        <main className={styles.page}>
          <header className={styles.hero}>
            <span>Prime Influencer</span>
            <h1>Os primeiros criadores da Fluxo</h1>
            <p>
              Você cria conteúdo em outra rede? Os 5 mil primeiros criadores aprovados ganham o selo
              Prime Influencer para sempre e o tema exclusivo Prime Gold.
              {spotsLeft !== null && campaign?.is_active
                ? ` Restam ${spotsLeft.toLocaleString("pt-BR")} vagas.`
                : ""}
            </p>
          </header>

          <section className={styles.perks}>
            <div>
              <HiBadgeCheck aria-hidden />
              <strong>Selo Prime Influencer</strong>
              <small>Fica no seu perfil e no seu histórico de conquistas.</small>
            </div>
            <div>
              <HiColorSwatch aria-hidden />
              <strong>Tema Prime Gold</strong>
              <small>Visual exclusivo em preto e ouro, só para os Prime.</small>
            </div>
            <div>
              <HiSparkles aria-hidden />
              <strong>Mais alcance</strong>
              <small>Missões de criador e prioridade nas sugestões de quem seguir.</small>
            </div>
          </section>

          {isLoading && <p className={styles.notice}>Carregando...</p>}
          {error && <p className={styles.error}>{error}</p>}

          {!isLoading && application && !isEditing && (
            <section className={styles.card}>
              <h2>Sua inscrição</h2>

              {application.status === "pending" && (
                <>
                  <p className={styles.status}>
                    <HiClock aria-hidden /> Em análise
                  </p>
                  <p className={styles.muted}>
                    Para provar que o perfil é seu, coloque este código na bio do seu{" "}
                    {CREATOR_PLATFORMS.find((platform) => platform.id === application.platform)?.label}{" "}
                    (@{application.handle}) até a aprovação. Depois pode tirar.
                  </p>
                  <div className={styles.codeBox}>
                    <strong>{application.verification_code}</strong>
                  </div>
                </>
              )}

              {application.status === "approved" && (
                <>
                  <p className={styles.status}>
                    <HiBadgeCheck aria-hidden /> Aprovada
                  </p>
                  <p className={styles.muted}>
                    {application.rewards_granted
                      ? "Selo Prime Influencer e tema Prime Gold liberados. Escolha o tema no seu perfil."
                      : "Você está na lista! O selo e o tema serão liberados em breve, na ordem de aprovação."}
                  </p>
                </>
              )}

              {application.status === "rejected" && (
                <>
                  <p className={styles.status}>
                    <HiXCircle aria-hidden /> Não aprovada desta vez
                  </p>
                  {application.review_note && (
                    <p className={styles.muted}>{application.review_note}</p>
                  )}
                  <button className={styles.primary} type="button" onClick={() => setIsEditing(true)}>
                    Atualizar e reenviar
                  </button>
                </>
              )}

              {application.status === "pending" && (
                <button className={styles.secondary} type="button" onClick={() => setIsEditing(true)}>
                  Editar inscrição
                </button>
              )}
            </section>
          )}

          {!isLoading && showForm && (
            <form className={styles.card} onSubmit={handleSubmit}>
              <h2>Quero ser Prime Influencer</h2>
              <p className={styles.muted}>
                Para maiores de 18 anos, com pelo menos{" "}
                {CREATOR_MIN_FOLLOWERS.toLocaleString("pt-BR")} seguidores em outra rede.
              </p>

              <div className={styles.fieldGrid}>
                <label>
                  Rede principal
                  <select
                    value={form.platform}
                    onChange={(event) =>
                      updateField("platform", event.target.value as CreatorApplicationInput["platform"])
                    }
                  >
                    {CREATOR_PLATFORMS.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Seu @ nessa rede
                  <input
                    required
                    value={form.handle}
                    onChange={(event) => updateField("handle", event.target.value)}
                    placeholder="@seuperfil"
                  />
                </label>
                <label>
                  Seguidores
                  <input
                    required
                    min={0}
                    type="number"
                    value={form.followers_count || ""}
                    onChange={(event) => updateField("followers_count", Number(event.target.value))}
                    placeholder="Ex: 15000"
                  />
                </label>
                <label>
                  Nicho
                  <input
                    value={form.niche}
                    onChange={(event) => updateField("niche", event.target.value)}
                    placeholder="Ex: humor, games, moda, música"
                  />
                </label>
              </div>

              <label>
                Link do perfil
                <input
                  type="url"
                  value={form.profile_url}
                  onChange={(event) => updateField("profile_url", event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label>
                O que você vai criar na Fluxo? (opcional)
                <textarea
                  maxLength={600}
                  rows={4}
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                />
              </label>

              <div className={styles.actions}>
                {application && (
                  <button className={styles.secondary} type="button" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </button>
                )}
                <button className={styles.primary} disabled={isSaving} type="submit">
                  {isSaving ? "Enviando..." : "Enviar inscrição"}
                </button>
              </div>
            </form>
          )}
        </main>
      </PageCard>
    </AppShell>
  );
}
