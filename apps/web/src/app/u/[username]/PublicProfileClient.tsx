"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { UserGamification } from "@ocean/shared";

import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileHighlights } from "@/components/profile/ProfileHighlights";
import type { OceanProfile } from "@/lib/profiles/ensure-profile";
import {
  getEquippedAura,
  type PublicEquippedAura,
} from "@/lib/services/auras.service";
import {
  getEquippedBadge,
  type PublicEquippedBadge,
} from "@/lib/services/badges.service";
import {
  getProfileContentStats,
  listContentsByAuthorId,
  listContentsByIds,
  type ProfileContent,
} from "@/lib/services/contents.service";
import {
  getPublicProfileByUsername,
  getRelationshipState,
  getRelationshipStats,
  toggleFollowProfile,
  type RelationshipState,
} from "@/lib/services/profiles.service";
import { listWavedContentsByUser } from "@/lib/services/waves.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type PublicProfileClientProps = {
  username: string;
};

type PublicTab = "Drops" | "Vibes" | "Waves" | "Salvos";

const publicTabs: PublicTab[] = ["Drops", "Vibes", "Waves", "Salvos"];

function normalizeRouteUsername(value: string) {
  return decodeURIComponent(value).replace(/^~/, "").trim().toLowerCase();
}

function getContentTitle(content: ProfileContent) {
  return content.text?.trim() || (content.content_type === "flow" ? "Vibe sem legenda" : "Drop sem legenda");
}

function getContentMeta(content: ProfileContent) {
  if (content.media_type === "video") return "Vídeo";
  if (content.media_type === "image") return "Foto";
  return content.content_type === "flow" ? "Vibe" : "Drop";
}

export function PublicProfileClient({ username }: PublicProfileClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<OceanProfile | null>(null);
  const [equippedAura, setEquippedAura] = useState<PublicEquippedAura | null>(null);
  const [equippedBadge, setEquippedBadge] = useState<PublicEquippedBadge | null>(null);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [stats, setStats] = useState({
    flows: 0,
    dahoras: 0,
    fas: 0,
    seletos: 0,
    engage: "0%",
  });
  const [relationship, setRelationship] = useState<RelationshipState>({
    isFollowing: false,
    canFollow: false,
  });
  const [activeTab, setActiveTab] = useState<PublicTab>("Drops");
  const [contents, setContents] = useState<ProfileContent[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContents, setIsLoadingContents] = useState(false);
  const [isUpdatingRelationship, setIsUpdatingRelationship] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setError("");

      try {
        const nextProfile = await getPublicProfileByUsername(
          supabase,
          normalizeRouteUsername(username),
        );

        if (!isMounted) return;

        setProfile(nextProfile);

        if (nextProfile) {
          const [
            profileStats,
            relationshipStats,
            relationshipState,
            nextAura,
            nextBadge,
            gamificationResult,
          ] = await Promise.all([
            getProfileContentStats(supabase, nextProfile.user_id),
            getRelationshipStats(supabase, nextProfile.user_id),
            getRelationshipState(supabase, nextProfile.user_id),
            getEquippedAura(supabase, nextProfile.user_id).catch(() => null),
            getEquippedBadge(supabase, nextProfile.user_id).catch(() => null),
            supabase
              .from("user_gamification")
              .select("*")
              .eq("user_id", nextProfile.user_id)
              .maybeSingle(),
          ]);
          if (isMounted) {
            setEquippedAura(nextAura);
            setEquippedBadge(nextBadge);
            setRelationship(relationshipState);
            setGamification(
              gamificationResult.error ? null : (gamificationResult.data as UserGamification | null),
            );
            setStats({
              flows: profileStats.contentCount,
              dahoras: profileStats.dahorasReceived,
              fas: relationshipStats.fans,
              seletos: relationshipStats.seletos,
              engage: profileStats.contentCount
                ? `${Math.min(100, Math.round((profileStats.dahorasReceived / profileStats.contentCount) * 10))}%`
                : "0%",
            });
          }
        }
      } catch (profileError) {
        if (isMounted) {
          setError(
            profileError instanceof Error
              ? profileError.message
              : "Não foi possível carregar esse perfil.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [supabase, username]);

  async function handleToggleFan() {
    if (!profile) return;

    setIsUpdatingRelationship(true);
    setMessage("");
    setError("");

    try {
      const isFollowing = await toggleFollowProfile(
        supabase,
        profile.user_id,
        relationship.isFollowing,
      );
      setRelationship((current) => ({ ...current, isFollowing }));
      setStats((current) => ({
        ...current,
        fas: Math.max(0, current.fas + (isFollowing ? 1 : -1)),
      }));
      setMessage(
        isFollowing
          ? `Você agora é fã de @${profile.username}.`
          : `Você deixou de ser fã de @${profile.username}.`,
      );
    } catch (relationshipError) {
      setError(
        relationshipError instanceof Error
          ? relationshipError.message
          : "Não foi possível atualizar esse perfil.",
      );
    } finally {
      setIsUpdatingRelationship(false);
    }
  }

  useEffect(() => {
    if (!profile) return;

    let isMounted = true;

    async function loadContents() {
      if (!profile) return;

      setIsLoadingContents(true);
      setError("");

      try {
        const nextContents =
          activeTab === "Drops"
            ? (await listContentsByAuthorId(supabase, profile.user_id)).filter(
                (content) => content.content_type !== "flow",
              )
            : activeTab === "Vibes"
              ? (await listContentsByAuthorId(supabase, profile.user_id)).filter(
                  (content) => content.content_type === "flow",
                )
              : activeTab === "Waves"
                ? await listContentsByIds(
                supabase,
                (await listWavedContentsByUser(supabase, profile.user_id)).map(
                  (wave) => wave.content_id,
                ),
              )
                : [];

        if (isMounted) {
          setContents(nextContents);
        }
      } catch (contentsError) {
        if (isMounted) {
          setError(
            contentsError instanceof Error
              ? contentsError.message
              : "Não foi possível carregar os Drops.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingContents(false);
        }
      }
    }

    loadContents();

    return () => {
      isMounted = false;
    };
  }, [activeTab, profile, supabase]);

  if (isLoading) {
    return <p className={styles.notice}>Carregando perfil...</p>;
  }

  if (!profile) {
    return (
      <section className={styles.notFound}>
        <h1>Esse Flow ID ainda não existe.</h1>
        <p>Verifique o Flow ID ou descubra novos perfis na Wave.</p>
        <Link href="/">Voltar para Wave</Link>
      </section>
    );
  }

  return (
    <div className={styles.profile}>
      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.success}>{message}</p>}

      <ProfileHeader
        equippedAura={equippedAura}
        equippedBadge={equippedBadge}
        gamification={gamification}
        profile={profile}
        stats={stats}
      />

      <ProfileHighlights />

      {relationship.canFollow && (
        <section className={styles.actions}>
          <button
            disabled={isUpdatingRelationship}
            type="button"
            onClick={handleToggleFan}
          >
            {isUpdatingRelationship
              ? "Atualizando..."
              : relationship.isFollowing
                ? "Deixar de ser fã"
                : "Ser fã"}
          </button>
        </section>
      )}

      <section className={styles.profileContent}>
        <div className={styles.tabs}>
          {publicTabs.map((tab) => (
            <button
              className={activeTab === tab ? styles.activeTab : ""}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoadingContents && <p className={styles.notice}>Carregando {activeTab.toLowerCase()}...</p>}

        {!isLoadingContents && !contents.length && (
          <p className={styles.notice}>
            {activeTab === "Drops"
              ? "Nenhum Drop público ainda."
              : activeTab === "Vibes"
                ? "Nenhuma Vibe por enquanto."
                : activeTab === "Waves"
                  ? "Nenhuma Wave por enquanto."
                  : "Nada salvo visível por enquanto."}
          </p>
        )}

        {!!contents.length && (
          <div className={styles.tiles}>
            {contents.map((content) => (
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
    </div>
  );
}


