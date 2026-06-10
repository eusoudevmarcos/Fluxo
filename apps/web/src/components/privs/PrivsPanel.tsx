"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HiArrowLeft,
  HiChatAlt2,
  HiChevronRight,
  HiMusicNote,
  HiPaperAirplane,
  HiPencilAlt,
  HiPhotograph,
  HiSearch,
  HiX,
} from "react-icons/hi";

import { useProfile } from "@/components/profile/ProfileProvider";
import {
  getConversationMessages,
  getOrCreateDirectConversation,
  listMyConversations,
  listPrivSuggestions,
  markConversationRead,
  sendPrivMessage,
  subscribeToConversation,
  type PrivConversation,
  type PrivMessage,
  type PrivProfile,
} from "@/lib/services/privs.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./PrivsPanel.module.css";

type PrivsPanelProps = {
  onClose: () => void;
};

function getInitial(name?: string | null) {
  return (name || "Ocean").trim().replace("#", "").charAt(0).toUpperCase() || "O";
}

function getProfileName(profile?: PrivProfile | null) {
  return profile?.display_name || profile?.username || "Ocean User";
}

function formatTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function PrivsPanel({ onClose }: PrivsPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useProfile();
  const [conversations, setConversations] = useState<PrivConversation[]>([]);
  const [suggestions, setSuggestions] = useState<PrivProfile[]>([]);
  const [messages, setMessages] = useState<PrivMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "conversation">("list");
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "groups">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const activeConversation = conversations.find((item) => item.id === activeId) ?? null;

  async function refreshConversations(nextActiveId = activeId) {
    setError("");

    try {
      const nextConversations = await listMyConversations(supabase);
      setConversations(nextConversations);

      if (!nextActiveId && nextConversations[0]) {
        setActiveId(nextConversations[0].id);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar seus Privs.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshMessages(conversationId = activeId) {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    try {
      const nextMessages = await getConversationMessages(supabase, conversationId);
      setMessages(nextMessages);
      await markConversationRead(supabase, conversationId).catch(() => undefined);
      await refreshConversations(conversationId);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar a conversa.",
      );
    }
  }

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      listMyConversations(supabase).catch((loadError) => {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar seus Privs.",
          );
        }
        return [];
      }),
      listPrivSuggestions(supabase).catch(() => []),
    ]).then(([nextConversations, nextSuggestions]) => {
      if (!isMounted) return;
      setConversations(nextConversations);
      setSuggestions(nextSuggestions);
      setActiveId(nextConversations[0]?.id ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshMessages(activeId);
    }, 0);

    const channel = subscribeToConversation(supabase, activeId, () => {
      void refreshMessages(activeId);
    });

    return () => {
      window.clearTimeout(timeoutId);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, supabase]);

  const visibleConversations = conversations.filter((conversation) => {
    const matchesTab =
      activeTab === "unread"
        ? conversation.unread_count > 0
        : activeTab === "groups"
          ? conversation.conversation_type === "group"
          : true;
    const matchesSearch = `${conversation.title} ${conversation.subtitle}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    return matchesTab && matchesSearch;
  });

  const visibleSuggestions = suggestions.filter((suggestion) =>
    `${suggestion.display_name ?? ""} ${suggestion.username ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  function openConversation(id: string) {
    setActiveId(id);
    setMobileView("conversation");
    setNotice("");
    setError("");
  }

  async function startConversation(profile: PrivProfile) {
    setError("");
    setNotice("");

    try {
      const conversationId = await getOrCreateDirectConversation(supabase, profile.user_id);
      await refreshConversations(conversationId);
      setActiveId(conversationId);
      setMobileView("conversation");
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Não foi possível iniciar essa conversa.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (!text || !activeId || isSending) return;

    setIsSending(true);
    setError("");
    setNotice("");

    try {
      await sendPrivMessage(supabase, activeId, text);
      setDraft("");
      await refreshMessages(activeId);
      await refreshConversations(activeId);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Não foi possível enviar a mensagem.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className={styles.panel} aria-label="Privs">
      <header className={styles.header}>
        {mobileView === "conversation" && (
          <button
            className={styles.mobileBack}
            type="button"
            onClick={() => setMobileView("list")}
            aria-label="Voltar para conversas"
          >
            <HiArrowLeft />
          </button>
        )}

        <div>
          <strong>
            <HiChatAlt2 />
            {mobileView === "conversation" && activeConversation
              ? activeConversation.title
              : "Privs"}
          </strong>
          {mobileView === "conversation" && activeConversation ? (
            <span>{activeConversation.subtitle}</span>
          ) : (
            <span>Conversas privadas da Ocean</span>
          )}
        </div>

        <button type="button" onClick={onClose} aria-label="Fechar Privs">
          <HiX />
        </button>
      </header>

      <div className={`${styles.listScreen} ${mobileView === "conversation" ? styles.mobileHidden : ""}`}>
        <div className={styles.musicStatus}>
          <span aria-hidden="true" />
          <HiMusicNote />
          <p>Ouvindo agora: <strong>Good Days — SZA</strong></p>
          <HiChevronRight />
        </div>

        <label className={styles.search}>
          <HiSearch />
          <input
            placeholder="Buscar conversas"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <kbd>⌘K</kbd>
        </label>

        <div className={styles.tabs}>
          <button
            type="button"
            className={activeTab === "all" ? styles.activeTab : ""}
            onClick={() => setActiveTab("all")}
          >
            Todas
          </button>
          <button
            type="button"
            className={activeTab === "unread" ? styles.activeTab : ""}
            onClick={() => setActiveTab("unread")}
          >
            Não lidas
          </button>
          <button
            type="button"
            className={activeTab === "groups" ? styles.activeTab : ""}
            onClick={() => setActiveTab("groups")}
          >
            Grupos
          </button>
        </div>

        {isLoading && <p className={styles.notice}>Carregando Privs...</p>}
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.list}>
          {visibleConversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className={conversation.id === activeId ? styles.activeConversation : ""}
              onClick={() => openConversation(conversation.id)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {conversation.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={conversation.avatar_url} alt="" />
                ) : (
                  getInitial(conversation.title)
                )}
                <i />
              </span>
              <span className={styles.copy}>
                <strong>{conversation.title}</strong>
                <small>{conversation.last_message ?? "Comece uma conversa no Privs."}</small>
              </span>
              <span className={styles.meta}>
                <small>{formatTime(conversation.last_message_at ?? conversation.updated_at)}</small>
                {conversation.unread_count > 0 && <em>{conversation.unread_count}</em>}
              </span>
            </button>
          ))}
        </div>

        {!isLoading && !visibleConversations.length && (
          <p className={styles.notice}>Comece uma conversa no Privs.</p>
        )}

        <div className={styles.suggestions}>
          <strong>
            <HiPencilAlt />
            Nova conversa
          </strong>
          {visibleSuggestions.length ? (
            visibleSuggestions.map((profile) => (
              <button
                type="button"
                key={profile.user_id}
                onClick={() => startConversation(profile)}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    getInitial(getProfileName(profile))
                  )}
                </span>
                <span className={styles.copy}>
                  <strong>{getProfileName(profile)}</strong>
                  <small>{profile.username ? `~${profile.username}` : "Perfil Ocean"}</small>
                </span>
              </button>
            ))
          ) : (
            <small>Convide alguém para começar uma conversa.</small>
          )}
        </div>

        {notice && <p className={styles.notice}>{notice}</p>}
      </div>

      <div className={`${styles.chat} ${mobileView === "list" ? styles.mobileChatHidden : ""}`}>
        {activeConversation ? (
          <>
            <div className={styles.chatEmpty}>
              <span className={styles.chatAvatar}>
                {activeConversation.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeConversation.avatar_url} alt="" />
                ) : (
                  getInitial(activeConversation.title)
                )}
              </span>
              <strong>{activeConversation.title}</strong>
              <span>Privs básico ativo. Realtime com fallback por atualização.</span>
            </div>

            <div className={styles.messages}>
              {!messages.length && (
                <p className={styles.notice}>Envie a primeira mensagem.</p>
              )}

              {messages.map((message) => {
                const isMine = message.sender_id === user?.id;

                return (
                  <div
                    className={isMine ? styles.sentMessage : styles.receivedMessage}
                    key={message.id}
                  >
                    {!isMine && <small>{getProfileName(message.sender)}</small>}
                    <p>{message.body}</p>
                    <time>{formatTime(message.created_at)}</time>
                  </div>
                );
              })}
            </div>

            <form className={styles.composer} onSubmit={handleSubmit}>
              <button
                type="button"
                aria-label="Mídia em Privs"
                onClick={() => setNotice("Mídia em Privs entra na próxima rodada.")}
              >
                <HiPhotograph />
              </button>
              <input
                placeholder="Digite uma mensagem..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" aria-label="Enviar mensagem" disabled={isSending}>
                <HiPaperAirplane />
              </button>
            </form>
          </>
        ) : (
          <p className={styles.notice}>Selecione ou inicie uma conversa.</p>
        )}
      </div>
    </section>
  );
}
