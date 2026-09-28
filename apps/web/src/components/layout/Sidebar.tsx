"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HiAcademicCap,
  HiBadgeCheck,
  HiBell,
  HiCheck,
  HiCurrencyDollar,
  HiHeart,
  HiHome,
  HiLightningBolt,
  HiPlay,
  HiSearch,
  HiShoppingBag,
  HiSparkles,
  HiUser,
  HiUserAdd,
  HiUserGroup,
  HiVideoCamera,
  HiViewGrid,
} from "react-icons/hi";

import { OceanLogo } from "@/components/brand/OceanLogo";
import {
  listPeopleSuggestions,
  searchProfiles,
  toggleFollowProfile,
  type PublicProfileSummary,
} from "@/lib/services/profiles.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./Sidebar.module.css";

const menuItems = [
  { id: "home", href: "/", label: "Início", icon: <HiHome /> },
  { id: "discover", href: "/discover", label: "Discover", icon: <HiSearch /> },
  { id: "moments", href: "/moments", label: "Vibes", icon: <HiLightningBolt /> },
  { id: "flows", href: "/flows", label: "Flows", icon: <HiPlay /> },
  { id: "communities", href: "/comunidades", label: "Comunidades", icon: <HiUserGroup /> },
  { id: "invites", href: "/convites", label: "Convidar amigos", icon: <HiUserAdd /> },
  { id: "creators", href: "/criadores", label: "Prime Influencer", icon: <HiBadgeCheck /> },
  { id: "stream", href: "/stream", label: "Fluxo Stream", icon: <HiVideoCamera /> },
  { id: "academy", href: "/academy", label: "Fluxo Academy", icon: <HiAcademicCap /> },
  { id: "shop", href: "/shop", label: "Fluxo Shop", icon: <HiShoppingBag /> },
  { id: "coin", href: "/carteira", label: "Fluxo Coin", icon: <HiCurrencyDollar /> },
  { id: "date", href: "/date", label: "Date", icon: <HiHeart /> },
  { id: "notifications", href: "/notificacoes", label: "Notificações", icon: <HiBell /> },
  { id: "badges", href: "/selos", label: "Selos", icon: <HiSparkles /> },
  { id: "profile", href: "/perfil", label: "Perfil", icon: <HiUser /> },
  { id: "more", href: "/mais", label: "Mais", icon: <HiViewGrid /> },
];

function getDisplayName(profile: PublicProfileSummary) {
  return profile.display_name || profile.username || "Fluxo User";
}

function getInitial(profile: PublicProfileSummary) {
  return getDisplayName(profile).trim().charAt(0).toUpperCase() || "W";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PublicProfileSummary[]>([]);
  const [results, setResults] = useState<PublicProfileSummary[]>([]);
  const [pendingUserId, setPendingUserId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let isMounted = true;

    listPeopleSuggestions(supabase, 4)
      .then((profiles) => {
        if (isMounted) setSuggestions(profiles);
      })
      .catch((error) => {
        if (isMounted) {
          setNotice(error instanceof Error ? error.message : "Não foi possível carregar sugestões.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    const searchTerm = query.trim();
    let isMounted = true;

    if (searchTerm.length < 2) {
      queueMicrotask(() => {
        if (!isMounted) return;
        setResults([]);
        setIsSearching(false);
      });

      return () => {
        isMounted = false;
      };
    }

    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;

      setIsSearching(true);

      searchProfiles(supabase, searchTerm, 5)
        .then((profiles) => {
          if (isMounted) setResults(profiles);
        })
        .catch((error) => {
          if (isMounted) {
            setNotice(error instanceof Error ? error.message : "Não foi possível buscar pessoas.");
          }
        })
        .finally(() => {
          if (isMounted) setIsSearching(false);
        });
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [query, supabase]);

  function updateProfileState(userId: string, isFollowing: boolean) {
    const update = (profile: PublicProfileSummary) =>
      profile.user_id === userId ? { ...profile, is_following: isFollowing } : profile;

    setSuggestions((current) => current.map(update));
    setResults((current) => current.map(update));
  }

  async function handleToggleFollow(profile: PublicProfileSummary) {
    setPendingUserId(profile.user_id);
    setNotice("");

    try {
      const isFollowing = await toggleFollowProfile(
        supabase,
        profile.user_id,
        profile.is_following,
      );
      updateProfileState(profile.user_id, isFollowing);
      setNotice(
        isFollowing
          ? `Você agora é fã de @${profile.username}.`
          : `Você deixou de ser fã de @${profile.username}.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível atualizar esse perfil.");
    } finally {
      setPendingUserId("");
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchTerm = query.trim();

    router.push(searchTerm ? `/discover?q=${encodeURIComponent(searchTerm)}` : "/discover");
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <OceanLogo />
      </div>

      <form className={styles.search} onSubmit={handleSearchSubmit}>
        <HiSearch />
        <input
          aria-label="Buscar pessoas na Fluxo"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pessoas"
          value={query}
        />
        {query.trim().length >= 2 && (
          <div className={styles.searchResults}>
            {isSearching && <p>Buscando...</p>}
            {!isSearching && !results.length && <p>Nenhum perfil encontrado.</p>}
            {!isSearching &&
              results.map((profile) => (
                <div className={styles.searchResult} key={profile.user_id}>
                  <Link href={`/u/${profile.username}`}>
                    <span className={styles.smallAvatar}>
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
                  {profile.can_follow && (
                    <button
                      aria-label={
                        profile.is_following
                          ? `Deixar de ser fã de @${profile.username}`
                          : `Ser fã de @${profile.username}`
                      }
                      disabled={pendingUserId === profile.user_id}
                      onClick={() => handleToggleFollow(profile)}
                      title={profile.is_following ? "Fã" : "Ser fã"}
                      type="button"
                    >
                      {profile.is_following ? <HiCheck /> : <HiUserAdd />}
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </form>

      <nav className={styles.menu} aria-label="Menu principal">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={isActive ? styles.active : ""}
            >
              <span className={styles.menuIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <section className={styles.followBox}>
        <div className={styles.followHeader}>
          <strong>Seletos para conhecer</strong>
          <Link href="/discover">Ver todos</Link>
        </div>

        {suggestions.map((person) => (
          <div className={styles.followItem} key={person.user_id}>
            <Link className={styles.avatar} href={`/u/${person.username}`}>
              {person.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={person.avatar_url} alt="" />
              ) : (
                getInitial(person)
              )}
            </Link>

            <div>
              <strong>{getDisplayName(person)}</strong>
              <span title={`@${person.username}`}>
                {person.suggestion_detail ?? `@${person.username}`}
              </span>
            </div>

            {person.can_follow && (
              <button
                disabled={pendingUserId === person.user_id}
                type="button"
                onClick={() => handleToggleFollow(person)}
              >
                {person.is_following ? "Fã" : "Ser fã"}
              </button>
            )}
          </div>
        ))}
        {!suggestions.length && !notice && (
          <p className={styles.empty}>Nenhuma sugestão por enquanto.</p>
        )}
        {notice && <p className={styles.notice}>{notice}</p>}
      </section>
    </aside>
  );
}
