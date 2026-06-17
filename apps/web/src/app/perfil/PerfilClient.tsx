"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import type { UserGamification } from "@ocean/shared";

import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileHighlights } from "@/components/profile/ProfileHighlights";
import { useProfile } from "@/components/profile/ProfileProvider";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import {
  OceanProfile,
  updateProfile,
  getErrorMessage,
} from "@/lib/profiles/ensure-profile";
import {
  getProfileContentStats,
  listContentsByAuthorId,
  listContentsByIds,
  type ProfileContent,
} from "@/lib/services/contents.service";
import {
  getEquippedAura,
  type PublicEquippedAura,
} from "@/lib/services/auras.service";
import {
  getEquippedBadge,
  type PublicEquippedBadge,
} from "@/lib/services/badges.service";
import { getMyGamification } from "@/lib/services/gamification.service";
import { listSavedContentsByCurrentUser } from "@/lib/services/saved.service";
import { listWavedContentsByUser } from "@/lib/services/waves.service";
import { uploadAvatar } from "@/lib/storage/avatars";
import { createClient, getSupabaseConfigError } from "@/lib/supabase/client";
import { defaultTheme, isThemeId, type ThemeId } from "@/lib/themes";
import styles from "./page.module.css";

type ProfileForm = {
  display_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  theme: ThemeId;
  aura: string;
};

type ProfileStats = {
  flows: number;
  dahoras: number;
  fas: number;
  seletos: number;
  engage: string;
};

function getDateIntentLabel(value?: string | null) {
  const labels: Record<string, string> = {
    amizade: "Amizades e conexoes",
    date: "Date com calma",
    networking: "Networking criativo",
    comunidade: "Comunidades e roles",
  };

  return value ? labels[value] ?? value : "Ainda nao informado";
}

type ProfileTab = "Criações" | "Waves" | "Salvos";

const profileTabs: ProfileTab[] = ["Criações", "Waves", "Salvos"];

function getContentTitle(content: ProfileContent) {
  return content.text?.trim() || (content.content_type === "flow" ? "Flow sem legenda" : "Criação sem legenda");
}

function getContentMeta(content: ProfileContent) {
  if (content.media_type === "video") return "Vídeo";
  if (content.media_type === "image") return "Foto";
  return content.content_type === "flow" ? "Flow" : "Criação";
}

function profileToForm(profile: OceanProfile): ProfileForm {
  return {
    display_name: profile.display_name ?? "",
    username: profile.username ?? "",
    avatar_url: profile.avatar_url ?? "",
    bio: profile.bio ?? "",
    theme: isThemeId(profile.theme) ? profile.theme : defaultTheme,
    aura: profile.aura ?? "starter",
  };
}

export function PerfilClient() {
  const {
    profile: shellProfile,
    isLoading: isShellProfileLoading,
    error: shellProfileError,
  } = useProfile();
  const configError = useMemo(() => getSupabaseConfigError(), []);
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<OceanProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [equippedAura, setEquippedAura] = useState<PublicEquippedAura | null>(null);
  const [equippedBadge, setEquippedBadge] = useState<PublicEquippedBadge | null>(null);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [stats, setStats] = useState<ProfileStats>({
    flows: 0,
    dahoras: 0,
    fas: 0,
    seletos: 0,
    engage: "0%",
  });
  const [isLoading, setIsLoading] = useState(!configError);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("Criações");
  const [profileContents, setProfileContents] = useState<ProfileContent[]>([]);
  const [isLoadingContents, setIsLoadingContents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") {
      return configError ?? "";
    }

    return new URLSearchParams(window.location.search).get("profile_error") ?? configError ?? "";
  });

  useEffect(() => {
    if (configError) {
      return;
    }

    if (isShellProfileLoading) {
      return;
    }

    let isMounted = true;

    async function loadProfile() {
      try {
        if (!shellProfile) {
          setError(shellProfileError || "Não foi possível carregar seu perfil.");
          setIsLoading(false);
          return;
        }

        if (isMounted) {
          setProfile(shellProfile);
          setForm(profileToForm(shellProfile));
          const [profileStats, nextAura, nextBadge, nextGamification] = await Promise.all([
            getProfileContentStats(supabase, shellProfile.user_id),
            getEquippedAura(supabase, shellProfile.user_id).catch(() => null),
            getEquippedBadge(supabase, shellProfile.user_id).catch(() => null),
            getMyGamification(supabase).catch(() => null),
          ]);
          if (isMounted) {
            setEquippedAura(nextAura);
            setEquippedBadge(nextBadge);
            setGamification(nextGamification);
            setStats({
              flows: profileStats.contentCount,
              dahoras: profileStats.dahorasReceived,
              fas: 0,
              seletos: 0,
              engage: profileStats.contentCount
                ? `${Math.min(100, Math.round((profileStats.dahorasReceived / profileStats.contentCount) * 10))}%`
                : "0%",
            });
          }
          setIsLoading(false);
        }
      } catch (profileError) {
          if (isMounted) {
            const message = getErrorMessage(
              profileError,
              "Não foi possível carregar seu perfil.",
            );

          setError(
            message,
          );
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [configError, isShellProfileLoading, shellProfile, shellProfileError, supabase]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let isMounted = true;

    async function loadProfileContents() {
      if (!profile) return;

      setIsLoadingContents(true);

      try {
        let nextContents: ProfileContent[] = [];

        if (activeTab === "Criações") {
          nextContents = await listContentsByAuthorId(supabase, profile.user_id);
        } else if (activeTab === "Waves") {
          const waves = await listWavedContentsByUser(supabase, profile.user_id);
          nextContents = await listContentsByIds(
            supabase,
            waves.map((wave) => wave.content_id),
          );
        } else {
          const saved = await listSavedContentsByCurrentUser(supabase);
          nextContents = await listContentsByIds(
            supabase,
            saved.map((item) => item.content_id),
          );
        }

        if (isMounted) {
          setProfileContents(nextContents);
        }
      } catch (contentsError) {
        if (isMounted) {
          setError(getErrorMessage(contentsError, "Não foi possível carregar suas criações."));
        }
      } finally {
        if (isMounted) {
          setIsLoadingContents(false);
        }
      }
    }

    loadProfileContents();

    return () => {
      isMounted = false;
    };
  }, [activeTab, profile, supabase]);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((currentForm) => {
      if (!currentForm) {
        return currentForm;
      }

      return {
        ...currentForm,
        [field]: field === "theme" && !isThemeId(value) ? currentForm.theme : value,
      };
    });
  }

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedAvatarFile(file);
    updateField("avatar_url", URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) {
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const avatarUrl = selectedAvatarFile ? await uploadAvatar(selectedAvatarFile) : form.avatar_url;
      const savedProfile = await updateProfile({ ...form, avatar_url: avatarUrl });
      setProfile(savedProfile);
      setForm(profileToForm(savedProfile));
      setIsEditing(false);
      setSelectedAvatarFile(null);
      setMessage("Perfil atualizado.");
    } catch (profileError) {
      setError(
        getErrorMessage(profileError, "Não foi possível salvar seu perfil."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.profile}>
          {isLoading && <p className={styles.notice}>Carregando perfil...</p>}
          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}

          {!isLoading && !profile && !configError && (
            <div className={styles.empty}>
              <p>Entre na Wave para criar e visualizar seu perfil.</p>
              <Link href="/auth">Entrar ou criar conta</Link>
            </div>
          )}

          {profile && form && (
            <>
              <ProfileHeader
                profile={profile}
                equippedAura={equippedAura}
                equippedBadge={equippedBadge}
                gamification={gamification}
                showPublicLink
                stats={stats}
                onEdit={() => setIsEditing(true)}
              />

              <ProfileHighlights />

              <section className={styles.profileDetails}>
                <div className={styles.detailCard}>
                  <span>Ficha Wave</span>
                  <strong>{getDateIntentLabel(profile.date_intent)}</strong>
                  <p>{profile.looking_for || "Conte o que voce procura para melhorar conexoes no Date e no Flow."}</p>
                </div>

                <div className={styles.detailCard}>
                  <span>Vibe</span>
                  <strong>{profile.vibe || "Ainda nao definida"}</strong>
                  <p>
                    {profile.city && profile.state
                      ? `${profile.city}, ${profile.state}`
                      : profile.location_label || "Adicione sua localização para ativar recomendações melhores."}
                  </p>
                </div>

                <div className={styles.detailCard}>
                  <span>Interesses</span>
                  <div className={styles.interests}>
                    {(profile.interests?.length ? profile.interests : ["Flow", "Moments", "Wave"]).map((interest) => (
                      <span key={interest}>{interest}</span>
                    ))}
                  </div>
                </div>
              </section>

              <section className={styles.profileContent}>
                <div className={styles.tabs}>
                  {profileTabs.map((tab) => (
                    <button
                      className={activeTab === tab ? styles.activeTab : ""}
                      type="button"
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {isLoadingContents && <p className={styles.notice}>Carregando {activeTab.toLowerCase()}...</p>}

                {!isLoadingContents && !profileContents.length && (
                  <p className={styles.notice}>
                    {activeTab === "Criações"
                      ? "Nenhuma criação ainda."
                      : activeTab === "Waves"
                        ? "Nenhuma Wave por enquanto."
                        : "Nada salvo ainda."}
                  </p>
                )}

                {!!profileContents.length && (
                  <div className={styles.tiles}>
                    {profileContents.map((content) => (
                      <article key={content.id}>
                        <div>
                          {content.media_url ? (
                            content.media_type === "video" ? (
                              <video src={content.media_url} preload="metadata" muted />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={content.media_url} alt="" />
                            )
                          ) : null}
                        </div>
                        <strong>{getContentTitle(content)}</strong>
                        <span>{getContentMeta(content)}</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {isEditing && (
                <form className={styles.form} onSubmit={handleSubmit}>
                  <div className={styles.formHeader}>
                    <h2>Editar perfil</h2>
                    <button type="button" onClick={() => setIsEditing(false)}>
                      Cancelar
                    </button>
                  </div>

                  <label>
                    Nome no perfil
                    <input
                      type="text"
                      value={form.display_name}
                      onChange={(event) =>
                        updateField("display_name", event.target.value)
                      }
                      required
                    />
                  </label>

                  <label>
                    Flow ID
                    <input
                      type="text"
                      value={form.username}
                      onChange={(event) => updateField("username", event.target.value)}
                      required
                    />
                  </label>

                  <label className={styles.fileButton}>
                    Selecionar nova foto
                    <input type="file" accept="image/*" onChange={handleAvatarFileChange} />
                  </label>

                  <label>
                    Avatar URL
                    <input
                      type="url"
                      value={form.avatar_url}
                      onChange={(event) =>
                        updateField("avatar_url", event.target.value)
                      }
                      placeholder="https://..."
                    />
                  </label>

                  <label>
                    Bio
                    <textarea
                      value={form.bio}
                      onChange={(event) => updateField("bio", event.target.value)}
                      maxLength={180}
                      rows={4}
                      placeholder="Conte um pouco sobre seu flow."
                    />
                  </label>

                  <label>
                    Aura
                    <input
                      type="text"
                      value={form.aura}
                      onChange={(event) => updateField("aura", event.target.value)}
                    />
                  </label>

                  <button type="submit" disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar perfil"}
                  </button>
                </form>
              )}

              <ThemeSwitcher
                currentTheme={profile.theme}
                onThemeChange={(theme) => {
                  setProfile((currentProfile) =>
                    currentProfile ? { ...currentProfile, theme } : currentProfile,
                  );
                  setForm((currentForm) =>
                    currentForm ? { ...currentForm, theme } : currentForm,
                  );
                }}
              />
            </>
          )}
    </div>
  );
}

