"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { HiChatAlt2, HiFlag, HiShieldCheck, HiUserGroup } from "react-icons/hi";

import { CommunityRoomChat } from "@/components/community/CommunityRoomChat";
import { PostCard } from "@/components/feed/PostCard";
import { AppShell } from "@/components/layout/AppShell";
import {
  createCommunityContent,
  getCommunityBySlug,
  listCommunityContents,
  type Community,
} from "@/lib/services/communities.service";
import {
  getMembershipState,
  joinCommunity,
  leaveCommunity,
  type MembershipState,
} from "@/lib/services/community-members.service";
import { listCommunityRooms, type CommunityRoom } from "@/lib/services/community-rooms.service";
import type { FeedContent } from "@/lib/services/contents.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type CommunityPageProps = {
  params: Promise<{ slug: string }>;
};

type Tab = "criacoes" | "salas" | "regras";

export default function CommunityPage({ params }: CommunityPageProps) {
  const supabase = useMemo(() => createClient(), []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<MembershipState>({
    is_member: false,
    role: null,
  });
  const [rooms, setRooms] = useState<CommunityRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<CommunityRoom | null>(null);
  const [contents, setContents] = useState<FeedContent[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("criacoes");
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((nextParams) => setSlug(nextParams.slug));
  }, [params]);

  async function loadCommunity(nextSlug = slug) {
    if (!nextSlug) return;

    setError("");

    try {
      const nextCommunity = await getCommunityBySlug(supabase, nextSlug);
      setCommunity(nextCommunity);

      if (!nextCommunity) return;

      const { data: userData } = await supabase.auth.getUser();
      const nextUserId = userData.user?.id ?? null;

      const [nextMembership, nextRooms, nextContents] = await Promise.all([
        getMembershipState(supabase, nextCommunity.id),
        listCommunityRooms(supabase, nextCommunity.id),
        listCommunityContents(supabase, nextCommunity.id, nextUserId),
      ]);

      setCurrentUserId(nextUserId);
      setMembership(nextMembership);
      setRooms(nextRooms);
      setContents(nextContents);
    } catch (communityError) {
      setError(
        communityError instanceof Error
          ? communityError.message
          : "Não foi possível carregar a comunidade.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCommunity();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handleMembership() {
    if (!community) return;

    setIsJoining(true);
    setError("");

    try {
      if (membership.is_member) {
        await leaveCommunity(supabase, community.id);
        setMembership({ is_member: false, role: null });
        setCommunity((current) =>
          current
            ? { ...current, member_count: Math.max(0, (current.member_count ?? 1) - 1) }
            : current,
        );
      } else {
        await joinCommunity(supabase, community.id);
        setMembership({ is_member: true, role: "member" });
        setCommunity((current) =>
          current ? { ...current, member_count: (current.member_count ?? 0) + 1 } : current,
        );
      }
    } catch (membershipError) {
      setError(
        membershipError instanceof Error
          ? membershipError.message
          : "Não foi possível atualizar sua participação.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  async function handleCreateContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!community) return;
    if (!membership.is_member) {
      setError("Entre na comunidade para criar algo aqui.");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      await createCommunityContent(supabase, community.id, {
        text,
        content_type: "post",
      });
      setText("");
      const nextContents = await listCommunityContents(supabase, community.id, currentUserId);
      setContents(nextContents);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Não foi possível criar na comunidade.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function updateContent(nextContent: FeedContent) {
    setContents((current) =>
      current.map((content) => (content.id === nextContent.id ? nextContent : content)),
    );
  }

  function removeContent(contentId: string) {
    setContents((current) => current.filter((content) => content.id !== contentId));
  }

  if (isLoading) {
    return (
      <AppShell>
        <p className={styles.notice}>Carregando comunidade...</p>
      </AppShell>
    );
  }

  if (!community) {
    return (
      <AppShell>
        <section className={styles.notFound}>
          <h1>Essa comunidade ainda não existe.</h1>
          <p>Verifique o endereço ou descubra novas comunidades na Wave.</p>
          <Link href="/comunidades">Voltar para Comunidades</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className={styles.page}>
        <section className={styles.header}>
          <div className={styles.cover}>
            <span>{community.name.charAt(0)}</span>
          </div>

          <div className={styles.headerContent}>
            <div>
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
              <h1>{community.name}</h1>
              <p>{community.description}</p>
            </div>

            <div className={styles.stats}>
              <span>
                <HiUserGroup />
                {community.member_count ?? 0} membros
              </span>
              <span>{rooms.length} salas</span>
              <span>{community.category}</span>
              {community.is_local && community.city && community.state && (
                <span>{community.city}, {community.state}</span>
              )}
            </div>

            <div className={styles.actions}>
              <button type="button" disabled={isJoining} onClick={handleMembership}>
                {membership.is_member ? "Sair" : "Entrar"}
              </button>
              <button
                type="button"
                onClick={() => setNotice("Denúncias reais entram na próxima rodada de moderação.")}
              >
                <HiFlag />
                Denunciar comunidade
              </button>
            </div>
          </div>
        </section>

        {notice && <p className={styles.notice}>{notice}</p>}
        {error && <p className={styles.error}>{error}</p>}

        <nav className={styles.tabs} aria-label="Comunidade">
          <button
            type="button"
            className={activeTab === "criacoes" ? styles.activeTab : ""}
            onClick={() => setActiveTab("criacoes")}
          >
            Criações
          </button>
          <button
            type="button"
            className={activeTab === "salas" ? styles.activeTab : ""}
            onClick={() => setActiveTab("salas")}
          >
            Salas
          </button>
          <button
            type="button"
            className={activeTab === "regras" ? styles.activeTab : ""}
            onClick={() => setActiveTab("regras")}
          >
            Regras
          </button>
        </nav>

        {activeTab === "criacoes" && (
          <section className={styles.contentTab}>
            {membership.is_member ? (
              <form className={styles.composer} onSubmit={handleCreateContent}>
                <textarea
                  placeholder="Crie algo para essa comunidade..."
                  rows={3}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
                <button type="submit" disabled={isCreating}>
                  {isCreating ? "Criando..." : "Criar"}
                </button>
              </form>
            ) : (
              <p className={styles.notice}>Entre na comunidade para criar algo aqui.</p>
            )}

            {!contents.length && (
              <p className={styles.notice}>Nenhuma criação nessa comunidade ainda.</p>
            )}

            {contents.map((content) => (
              <PostCard
                key={content.id}
                content={content}
                onChange={updateContent}
                onDelete={removeContent}
              />
            ))}
          </section>
        )}

        {activeTab === "salas" && (
          selectedRoom ? (
            <CommunityRoomChat
              community={community}
              isMember={membership.is_member}
              room={selectedRoom}
              onClose={() => setSelectedRoom(null)}
            />
          ) : (
            <section className={styles.rooms}>
              {rooms.map((room) => (
                <article className={styles.room} key={room.id}>
                  <div>
                    <strong>{room.name}</strong>
                    <span>
                      {room.online_count}/{room.capacity}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoom(room);
                      setNotice("");
                    }}
                  >
                    <HiChatAlt2 />
                    Entrar na sala
                  </button>
                </article>
              ))}
            </section>
          )
        )}

        {activeTab === "regras" && (
          <section className={styles.rules}>
            <p>Respeite as regras da comunidade e a segurança da Wave.</p>
            <ul>
              {(community.rules?.length ? community.rules : ["Respeite os membros."]).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </AppShell>
  );
}

