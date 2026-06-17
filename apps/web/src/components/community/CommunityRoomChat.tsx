"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HiArrowLeft, HiPaperAirplane, HiRefresh } from "react-icons/hi";

import type { Community } from "@/lib/services/communities.service";
import type { CommunityRoom } from "@/lib/services/community-rooms.service";
import {
  getRoomPresenceCount,
  joinRoomPresence,
  leaveRoomPresence,
  listRoomMessages,
  sendRoomMessage,
  subscribeToRoomMessages,
  type CommunityRoomMessage,
} from "@/lib/services/community-room-chat.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./CommunityRoomChat.module.css";

type CommunityRoomChatProps = {
  community: Community;
  room: CommunityRoom;
  isMember: boolean;
  onClose: () => void;
};

function getDisplayName(message: CommunityRoomMessage) {
  return message.sender?.display_name || message.sender?.username || "Wave User";
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "O";
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommunityRoomChat({
  community,
  room,
  isMember,
  onClose,
}: CommunityRoomChatProps) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<CommunityRoomMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [presenceCount, setPresenceCount] = useState(room.online_count);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function refreshMessages() {
    setError("");

    try {
      const nextMessages = await listRoomMessages(supabase, room.id);
      setMessages(nextMessages);
      const nextPresence = await getRoomPresenceCount(supabase, room.id).catch(
        () => room.online_count,
      );
      setPresenceCount(Math.max(room.online_count, nextPresence));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar a sala.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setCurrentUserId(data.user?.id ?? null);
      }
    });

    if (isMember) {
      joinRoomPresence(supabase, room.id).catch(() => undefined);
    }

    const timeoutId = window.setTimeout(() => {
      void refreshMessages();
    }, 0);

    const channel = subscribeToRoomMessages(supabase, room.id, () => {
      void refreshMessages();
    });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      void supabase.removeChannel(channel);
      if (isMember) {
        leaveRoomPresence(supabase, room.id).catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, supabase, isMember]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (!text || isSending) return;

    if (!isMember) {
      setError("Entre na comunidade para conversar nessa sala.");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      await sendRoomMessage(supabase, room.id, community.id, text);
      setDraft("");
      await refreshMessages();
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
    <section className={styles.chat} aria-label={`Sala ${room.name}`}>
      <header className={styles.header}>
        <button type="button" onClick={onClose} aria-label="Voltar para salas">
          <HiArrowLeft />
        </button>
        <div>
          <strong>{room.name}</strong>
          <span>
            {presenceCount}/{room.capacity} online · {community.name}
          </span>
        </div>
        <button type="button" onClick={() => void refreshMessages()} aria-label="Atualizar sala">
          <HiRefresh />
        </button>
      </header>

      <div className={styles.messages}>
        {isLoading && <p className={styles.notice}>Carregando mensagens...</p>}
        {!isLoading && !messages.length && (
          <p className={styles.notice}>Seja a primeira pessoa a falar nessa sala.</p>
        )}

        {messages.map((message) => {
          const isMine = message.sender_id === currentUserId;
          const senderName = getDisplayName(message);

          return (
            <article
              className={isMine ? styles.ownMessage : styles.message}
              key={message.id}
            >
              {!isMine && <span>{getInitial(senderName)}</span>}
              <div>
                {!isMine && <strong>{senderName}</strong>}
                <p>{message.body}</p>
                <time>{formatTime(message.created_at)}</time>
              </div>
            </article>
          );
        })}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <form className={styles.composer} onSubmit={handleSubmit}>
        <input
          placeholder={isMember ? "Conversar na sala..." : "Entre na comunidade para falar"}
          value={draft}
          disabled={!isMember}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={!isMember || isSending} aria-label="Enviar">
          <HiPaperAirplane />
        </button>
      </form>
    </section>
  );
}
