"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HiArrowRight, HiCheck, HiSearch, HiUserAdd } from "react-icons/hi";

import {
  getMyNearbySettings,
  listPeopleSuggestions,
  searchProfiles,
  setNearbyVisibility,
  toggleFollowProfile,
  updateMyLocation,
  type NearbySettings,
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

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Seu navegador não permite localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(
      new Error("Permita a localização no navegador para ver pessoas próximas."),
    ), { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
  });
}

async function isGeolocationAlreadyGranted() {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state === "granted";
  } catch {
    return false;
  }
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
  const [nearby, setNearby] = useState<NearbySettings | null>(null);
  const [isUpdatingNearby, setIsUpdatingNearby] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadNearby() {
      const settings = await getMyNearbySettings(supabase).catch(() => null);
      if (!isMounted) return;
      setNearby(settings);

      // Quem ja ligou "pessoas proximas" tem a posicao renovada ao abrir o Discover, sem novo
      // pedido de permissao (o servidor limita a uma atualizacao a cada 10 minutos).
      if (settings?.nearby_visible && (await isGeolocationAlreadyGranted())) {
        const position = await getCurrentPosition().catch(() => null);
        if (position) await updateMyLocation(supabase, position.coords).catch(() => undefined);
      }
    }

    void loadNearby();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleToggleNearby() {
    if (!nearby) return;
    setIsUpdatingNearby(true);
    setError("");
    setMessage("");

    try {
      if (nearby.nearby_visible) {
        await setNearbyVisibility(supabase, false);
        setNearby({ ...nearby, nearby_visible: false });
        setMessage("Você não aparece mais para pessoas próximas.");
      } else {
        const position = await getCurrentPosition();
        await updateMyLocation(supabase, position.coords);
        await setNearbyVisibility(supabase, true);
        setNearby({ ...nearby, nearby_visible: true, has_location: true });
        setMessage("Pronto! Agora você vê e aparece para pessoas próximas.");
      }
      setReloadKey((current) => current + 1);
    } catch (nearbyError) {
      setError(
        nearbyError instanceof Error ? nearbyError.message : "Não foi possível atualizar.",
      );
    } finally {
      setIsUpdatingNearby(false);
    }
  }

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
  }, [reloadKey, submittedQuery, supabase]);

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

      {!submittedQuery && nearby?.is_adult && (
        <div className={styles.nearbyCard}>
          <div>
            <strong>Pessoas perto de você</strong>
            <small>
              {nearby.nearby_visible
                ? "Ativado. Você vê e aparece para quem também ativou. Ninguém vê sua localização exata, só uma faixa de distância."
                : "Veja quem usa a Fluxo perto de você. Só aparece para quem também ativar, e nunca com a localização exata."}
            </small>
          </div>
          <button
            className={nearby.nearby_visible ? styles.secondary : ""}
            disabled={isUpdatingNearby}
            onClick={handleToggleNearby}
            type="button"
          >
            {isUpdatingNearby ? "Atualizando..." : nearby.nearby_visible ? "Desativar" : "Ativar"}
          </button>
        </div>
      )}

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

              {profile.suggestion_detail && (
                <span className={styles.reason}>{profile.suggestion_detail}</span>
              )}
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
