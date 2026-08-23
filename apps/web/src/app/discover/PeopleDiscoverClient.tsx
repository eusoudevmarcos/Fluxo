"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HiArrowRight, HiCheck, HiSearch, HiUserAdd } from "react-icons/hi";

import {
  listPeopleSuggestions,
  searchProfiles,
  toggleFollowProfile,
  type PublicProfileSummary,
} from "@/lib/services/profiles.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type PeopleDiscoverClientProps = {
  initialQuery?: string;
};

function getDisplayName(profile: PublicProfileSummary) {
  return profile.display_name || profile.username || "Fluxo User";
}

function getInitial(profile: PublicProfileSummary) {
  return getDisplayName(profile).trim().charAt(0).toUpperCase() || "W";
}

function getLocation(profile: PublicProfileSummary) {
  if (profile.city && profile.state) return `${profile.city}, ${profile.state}`;
  return profile.location_label || "Fluxo";
}

export function PeopleDiscoverClient({ initialQuery = "" }: PeopleDiscoverClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [people, setPeople] = useState<PublicProfileSummary[]>([]);
  const [pendingUserId, setPendingUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const searchTerm = submittedQuery.trim();

    queueMicrotask(() => {
      if (!isMounted) return;

      setIsLoading(true);
      setError("");

      const request = searchTerm
        ? searchProfiles(supabase, searchTerm, 18)
        : listPeopleSuggestions(supabase, 18);

      request
        .then((profiles) => {
          if (isMounted) setPeople(profiles);
        })
        .catch((requestError) => {
          if (isMounted) {
            setPeople([]);
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Não foi possível carregar pessoas.",
            );
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    });

    return () => {
      isMounted = false;
    };
  }, [submittedQuery, supabase]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchTerm = query.trim();

    setSubmittedQuery(searchTerm);
    router.replace(searchTerm ? `/discover?q=${encodeURIComponent(searchTerm)}` : "/discover", {
      scroll: false,
    });
  }

  function updateProfileState(userId: string, isFollowing: boolean) {
    setPeople((current) =>
      current.map((profile) =>
        profile.user_id === userId ? { ...profile, is_following: isFollowing } : profile,
      ),
    );
  }

  async function handleToggleFollow(profile: PublicProfileSummary) {
    setPendingUserId(profile.user_id);
    setMessage("");
    setError("");

    try {
      const isFollowing = await toggleFollowProfile(
        supabase,
        profile.user_id,
        profile.is_following,
      );
      updateProfileState(profile.user_id, isFollowing);
      setMessage(
        isFollowing
          ? `Você agora é fã de @${profile.username}.`
          : `Você deixou de ser fã de @${profile.username}.`,
      );
    } catch (followError) {
      setError(
        followError instanceof Error
          ? followError.message
          : "Não foi possível atualizar esse perfil.",
      );
    } finally {
      setPendingUserId("");
    }
  }

  return (
    <section className={styles.discover}>
      <header className={styles.header}>
        <span>Discover</span>
        <h1>Encontre pessoas na Fluxo</h1>
      </header>

      <form className={styles.searchPanel} onSubmit={handleSubmit}>
        <HiSearch />
        <input
          aria-label="Buscar pessoas"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome ou @username"
          value={query}
        />
        <button type="submit">Buscar</button>
      </form>

      {message && <p className={styles.success}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.sectionHeader}>
        <strong>{submittedQuery ? "Resultados" : "Seletos para conhecer"}</strong>
        {submittedQuery && <span>{people.length} perfis</span>}
      </div>

      {isLoading && <p className={styles.notice}>Carregando pessoas...</p>}

      {!isLoading && !people.length && (
        <p className={styles.notice}>Nenhum perfil encontrado.</p>
      )}

      {!isLoading && people.length > 0 && (
        <div className={styles.peopleGrid}>
          {people.map((profile) => (
            <article className={styles.personCard} key={profile.user_id}>
              <Link className={styles.identity} href={`/u/${profile.username}`}>
                <span className={styles.avatar}>
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    getInitial(profile)
                  )}
                </span>
                <span>
                  <strong>{getDisplayName(profile)}</strong>
                  <small>@{profile.username}</small>
                </span>
              </Link>

              <p>{profile.bio || getLocation(profile)}</p>

              <div className={styles.cardActions}>
                {profile.can_follow && (
                  <button
                    disabled={pendingUserId === profile.user_id}
                    onClick={() => handleToggleFollow(profile)}
                    type="button"
                  >
                    {profile.is_following ? <HiCheck /> : <HiUserAdd />}
                    {profile.is_following ? "Fã" : "Ser fã"}
                  </button>
                )}
                <Link href={`/u/${profile.username}`}>
                  Perfil
                  <HiArrowRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
