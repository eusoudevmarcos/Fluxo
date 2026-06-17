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
import { getPublicProfileByUsername } from "@/lib/services/profiles.service";
import { listWavedContentsByUser } from "@/lib/services/waves.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type PublicProfileClientProps = {
  username: string;
};

type PublicTab = "Criações" | "Waves";

const publicTabs: PublicTab[] = ["Criações", "Waves"];

function normalizeRouteUsername(value: string) {
  return decodeURIComponent(value).replace(/^~/, "").trim().toLowerCase();
}

function getContentTitle(content: ProfileContent) {
  return content.text?.trim() || (content.content_type === "flow" ? "Flow sem legenda" : "Criação sem legenda");
}

function getContentMeta(content: ProfileContent) {
  if (content.media_type === "video") return "Vídeo";
  if (content.media_type === "image") return "Foto";
  return content.content_type === "flow" ? "Flow" : "Criação";
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
  const [activeTab, setActiveTab] = useState<PublicTab>("Criações");
  const [contents, setContents] = useState<ProfileContent[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContents, setIsLoadingContents] = useState(false);

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
          const [profileStats, nextAura, nextBadge, gamificationResult] = await Promise.all([
            getProfileContentStats(supabase, nextProfile.user_id),
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
            setGamification(
              gamificationResult.error ? null : (gamificationResult.data as UserGamification | null),
            );
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

  useEffect(() => {
    if (!profile) return;

    let isMounted = true;

    async function loadContents() {
      if (!profile) return;

      setIsLoadingContents(true);
      setError("");

      try {
        const nextContents =
          activeTab === "Criações"
            ? await listContentsByAuthorId(supabase, profile.user_id)
            : await listContentsByIds(
                supabase,
                (await listWavedContentsByUser(supabase, profile.user_id)).map(
                  (wave) => wave.content_id,
                ),
              );

        if (isMounted) {
          setContents(nextContents);
        }
      } catch (contentsError) {
        if (isMounted) {
          setError(
            contentsError instanceof Error
              ? contentsError.message
              : "Não foi possível carregar as criações.",
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
        <h1>Esse flow ainda não existe.</h1>
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

      <section className={styles.actions}>
        <button
          type="button"
          onClick={() => setMessage("Fãs reais entram na próxima rodada.")}
        >
          Ser fã
        </button>
      </section>

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
            {activeTab === "Criações"
              ? "Nenhuma criação pública ainda."
              : "Nenhuma Wave por enquanto."}
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


