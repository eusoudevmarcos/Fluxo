"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { HiPlus, HiSearch, HiShieldCheck, HiUserGroup } from "react-icons/hi";

import { AppShell } from "@/components/layout/AppShell";
import {
  createCommunity,
  listCommunities,
  type Community,
} from "@/lib/services/communities.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

const filters = [
  "Todas",
  "Oficiais",
  "Da minha cidade",
  "Humor",
  "Games",
  "Música",
  "Filmes",
  "Tecnologia",
  "Relacionamentos",
];

function matchesFilter(
  community: Community,
  filter: string,
  profileCity?: string | null,
  profileState?: string | null,
) {
  if (filter === "Todas") return true;
  if (filter === "Oficiais") return community.is_official;
  if (filter === "Da minha cidade") {
    return Boolean(
      community.is_local &&
        profileCity &&
        profileState &&
        community.city?.toLowerCase() === profileCity.toLowerCase() &&
        community.state?.toLowerCase() === profileState.toLowerCase(),
    );
  }
  if (filter === "Filmes") return community.category === "Entretenimento";
  return community.category === filter;
}

export default function ComunidadesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [profileLocation, setProfileLocation] = useState<{
    city: string | null;
    state: string | null;
  }>({ city: null, state: null });
  const [filter, setFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Criada pela galera",
    is_local: false,
  });

  async function loadCommunities() {
    setError("");

    try {
      const [nextCommunities, userResult] = await Promise.all([
        listCommunities(supabase),
        supabase.auth.getUser(),
      ]);
      setCommunities(nextCommunities);

      if (userResult.data.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("city,state")
          .eq("user_id", userResult.data.user.id)
          .maybeSingle();

        setProfileLocation({
          city: profileData?.city ?? null,
          state: profileData?.state ?? null,
        });
      }
    } catch (communityError) {
      setError(
        communityError instanceof Error
          ? communityError.message
          : "Não foi possível carregar as comunidades.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCommunities();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);

    try {
      const community = await createCommunity(supabase, form);
      setCommunities((current) => [community, ...current]);
      setForm({ name: "", description: "", category: "Criada pela galera", is_local: false });
      setIsCreateOpen(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Não foi possível criar a comunidade.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCommunities = communities.filter((community) => {
    const matchesQuery =
      !normalizedQuery ||
      community.name.toLowerCase().includes(normalizedQuery) ||
      community.description?.toLowerCase().includes(normalizedQuery);

    return matchesQuery && matchesFilter(
      community,
      filter,
      profileLocation.city,
      profileLocation.state,
    );
  });

  return (
    <AppShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Comunidades</span>
            <h1>Encontre sua galera na Wave.</h1>
            <p>
              Comunidades com alma de Orkut, visual Wave e espaço para Criações,
              Salas e Regras.
            </p>
          </div>

          <button type="button" onClick={() => setIsCreateOpen((current) => !current)}>
            <HiPlus />
            Criar comunidade
          </button>
        </section>

        <section className={styles.controls}>
          <label>
            <HiSearch />
            <input
              placeholder="Buscar comunidade"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className={styles.filters}>
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? styles.activeFilter : ""}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {isCreateOpen && (
          <form className={styles.createBox} onSubmit={handleCreateCommunity}>
            <strong>Criar comunidade</strong>
            <input
              placeholder="Nome da comunidade"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <textarea
              placeholder="Descrição curta"
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
            <input
              placeholder="Categoria"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
            />
            <label className={styles.localOption}>
              <input
                type="checkbox"
                checked={form.is_local}
                disabled={!profileLocation.city || !profileLocation.state}
                onChange={(event) =>
                  setForm((current) => ({ ...current, is_local: event.target.checked }))
                }
              />
              <span>
                Comunidade local da minha cidade
                {profileLocation.city && profileLocation.state
                  ? ` (${profileLocation.city}, ${profileLocation.state})`
                  : " (complete cidade/estado no onboarding)"}
              </span>
            </label>
            <div>
              <button type="button" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={isCreating}>
                {isCreating ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {isLoading && <p className={styles.notice}>Carregando comunidades...</p>}

        {!isLoading && !visibleCommunities.length && (
          <p className={styles.notice}>Nenhuma comunidade encontrada agora.</p>
        )}

        <section className={styles.grid}>
          {visibleCommunities.map((community) => (
            <article className={styles.card} key={community.id}>
              <div className={styles.cover}>
                <span>{community.name.charAt(0)}</span>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardHeader}>
                  <strong>{community.name}</strong>
                  <div className={styles.badges}>
                    <span className={community.is_official ? styles.official : styles.communityMade}>
                      {community.is_official ? (
                        <>
                          <HiShieldCheck />
                          Oficial
                        </>
                      ) : (
                        "Criada pela galera"
                      )}
                    </span>
                    {community.is_local && <span className={styles.localBadge}>Local</span>}
                  </div>
                </div>

                <p>{community.description}</p>

                <div className={styles.meta}>
                  <span>{community.category}</span>
                  {community.is_local && community.city && community.state && (
                    <span>{community.city}, {community.state}</span>
                  )}
                  <span>
                    <HiUserGroup />
                    {community.member_count ?? 0} membros
                  </span>
                  <span>{community.room_count ?? 0} salas</span>
                </div>

                <Link href={`/comunidades/${community.slug}`}>Ver comunidade</Link>
              </div>
            </article>
          ))}
        </section>
      </main>
    </AppShell>
  );
}

