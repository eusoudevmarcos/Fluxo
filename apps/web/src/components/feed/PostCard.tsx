"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  HiBookmark,
  HiChatAlt2,
  HiDotsHorizontal,
  HiEmojiHappy,
  HiEye,
  HiFire,
  HiRefresh,
} from "react-icons/hi";

import { AuraAvatar } from "@/components/aura/AuraAvatar";
import { BadgeIcon, type EquippedBadge } from "@/components/badges/BadgeIcon";
import { useProfile } from "@/components/profile/ProfileProvider";
import {
  createComment,
  deleteComment,
  listCommentsByContentId,
  type CommentWithAuthor,
} from "@/lib/services/comments.service";
import {
  deleteContent,
  setCommentsEnabled,
  type FeedContent,
} from "@/lib/services/contents.service";
import { toggleDahora } from "@/lib/services/dahoras.service";
import { registerPresence } from "@/lib/services/presences.service";
import { toggleSaved } from "@/lib/services/saved.service";
import { getMyStickerPacks, getPackStickers } from "@/lib/services/stickers.service";
import { toggleWave } from "@/lib/services/waves.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./PostCard.module.css";

type PostCardProps = {
  content: FeedContent;
  onChange?: (content: FeedContent) => void;
  onDelete?: (contentId: string) => void;
};

function formatCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(".", ",")}k`;
  }

  return String(value);
}

function formatTime(value: string) {
  const createdAt = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;

  return `${Math.floor(diffHours / 24)} d`;
}

function getInitial(name?: string | null) {
  return (name || "O").trim().charAt(0).toUpperCase() || "O";
}

function getFounderBadge(userId?: string, label = "Fundador Ocean"): EquippedBadge {
  return {
    user_id: userId,
    badge_slug: "badge-founder",
    badge_name: label || "Fundador Ocean",
    category: "founder",
    rarity: "milenar",
    color_primary: "#ffd01a",
    color_secondary: "#ff9a1f",
    visual_config: {},
  };
}

export function PostCard({ content, onChange, onDelete }: PostCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useProfile();
  const [isTogglingDahora, setIsTogglingDahora] = useState(false);
  const [isTogglingWave, setIsTogglingWave] = useState(false);
  const [isTogglingSaved, setIsTogglingSaved] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isManagingPost, setIsManagingPost] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);
  const [stickers, setStickers] = useState<Array<{ label: string; value: string }>>([]);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const hasRegisteredPresence = useRef(false);
  const authorName = content.author?.display_name || "Ocean User";
  const username = content.author?.username || "ocean";
  const avatarUrl = content.author?.avatar_url;
  const equippedAura = content.author?.equipped_aura ?? null;
  const isFounder = Boolean(content.author?.is_founder);
  const officialLabel = content.author?.official_label;
  const authorBadge =
    content.author?.equipped_badge ??
    (isFounder ? getFounderBadge(content.author?.user_id, officialLabel ?? "Fundador Ocean") : null);
  const authorHref = content.author?.username ? `/u/${content.author.username}` : null;
  const isAuthor = user?.id === content.author_id;

  useEffect(() => {
    if (!user || hasRegisteredPresence.current) return;

    hasRegisteredPresence.current = true;
    registerPresence(supabase, content.id)
      .then((count) => onChange?.({ ...content, presence_count: count }))
      .catch(() => {
        hasRegisteredPresence.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.id, supabase, user?.id]);

  async function handleDahora() {
    setError("");
    setIsTogglingDahora(true);

    try {
      const state = await toggleDahora(supabase, content.id);
      onChange?.({
        ...content,
        dahora_count: state.count,
        has_dahora: state.has_dahora,
      });
    } catch (dahoraError) {
      setError(
        dahoraError instanceof Error
          ? dahoraError.message
          : "Não foi possível marcar Dahora.",
      );
    } finally {
      setIsTogglingDahora(false);
    }
  }

  async function handleWave() {
    setError("");
    setIsTogglingWave(true);

    try {
      const state = await toggleWave(supabase, content.id);
      onChange?.({
        ...content,
        wave_count: state.count,
        has_waved: state.has_waved,
      });
    } catch (waveError) {
      setError(
        waveError instanceof Error ? waveError.message : "Não foi possível fazer Wave.",
      );
    } finally {
      setIsTogglingWave(false);
    }
  }

  async function handleSaved() {
    setError("");
    setIsTogglingSaved(true);

    try {
      const state = await toggleSaved(supabase, content.id);
      onChange?.({ ...content, is_saved: state.is_saved });
    } catch (savedError) {
      setError(
        savedError instanceof Error ? savedError.message : "Não foi possível salvar.",
      );
    } finally {
      setIsTogglingSaved(false);
    }
  }

  async function loadComments() {
    setCommentError("");
    setIsLoadingComments(true);

    try {
      const nextComments = await listCommentsByContentId(supabase, content.id);
      setComments(nextComments);
    } catch (commentsError) {
      setCommentError(
        commentsError instanceof Error
          ? commentsError.message
          : "Não foi possível carregar os comentários.",
      );
    } finally {
      setIsLoadingComments(false);
    }
  }

  async function toggleComments() {
    const nextOpen = !isCommentsOpen;
    setIsCommentsOpen(nextOpen);

    if (nextOpen && !comments.length) {
      await loadComments();
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentError("");

    const nextText = commentText.trim();
    if (!nextText) {
      setCommentError("Escreva um comentário antes de enviar.");
      return;
    }

    if (nextText.length > 500) {
      setCommentError("Seu comentário pode ter no máximo 500 caracteres.");
      return;
    }

    setIsSendingComment(true);

    try {
      await createComment(supabase, content.id, nextText);
      setCommentText("");
      await loadComments();
      onChange?.({ ...content, comments_count: content.comments_count + 1 });
    } catch (commentCreateError) {
      setCommentError(
        commentCreateError instanceof Error
          ? commentCreateError.message
          : "Não foi possível comentar agora.",
      );
    } finally {
      setIsSendingComment(false);
    }
  }

  async function handleStickerPicker() {
    const nextOpen = !isStickerPickerOpen;
    setIsStickerPickerOpen(nextOpen);
    setCommentError("");

    if (!nextOpen || stickers.length || isLoadingStickers) {
      return;
    }

    setIsLoadingStickers(true);

    try {
      const packs = await getMyStickerPacks(supabase);
      const firstPackSlug = (packs[0] as { pack?: { slug?: string } } | undefined)?.pack
        ?.slug;

      if (!firstPackSlug) {
        setCommentError("Complete missões para desbloquear stickers.");
        return;
      }

      const packStickers = await getPackStickers(supabase, firstPackSlug);
      setStickers(
        packStickers.map((sticker) => ({
          label: sticker.name,
          value: `:${sticker.emotion}:`,
        })),
      );
    } catch {
      setStickers([
        { label: "Rindo", value: "😄" },
        { label: "Admirado", value: "✨" },
        { label: "Tirando onda", value: "🌊" },
        { label: "Medo", value: "😳" },
        { label: "Estressado", value: "💢" },
      ]);
    } finally {
      setIsLoadingStickers(false);
    }
  }

  function insertSticker(value: string) {
    setCommentText((current) => `${current}${current ? " " : ""}${value}`);
    setIsStickerPickerOpen(false);
  }

  async function handleDeleteComment(commentId: string) {
    setCommentError("");

    try {
      await deleteComment(supabase, commentId);
      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId),
      );
      onChange?.({
        ...content,
        comments_count: Math.max(0, content.comments_count - 1),
      });
    } catch (commentDeleteError) {
      setCommentError(
        commentDeleteError instanceof Error
          ? commentDeleteError.message
          : "Não foi possível apagar o comentário.",
      );
    }
  }

  async function handleDeletePost() {
    setIsOptionsOpen(false);

    if (!window.confirm("Essa criação será removida da Ocean.")) {
      return;
    }

    setError("");
    setIsManagingPost(true);

    try {
      await deleteContent(supabase, content.id);
      onDelete?.(content.id);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível concluir agora. Tente novamente.",
      );
    } finally {
      setIsManagingPost(false);
    }
  }

  async function handleCommentsEnabledChange(enabled: boolean) {
    setIsOptionsOpen(false);
    setError("");
    setIsManagingPost(true);

    try {
      const nextContent = await setCommentsEnabled(supabase, content.id, enabled);
      onChange?.({
        ...content,
        comments_enabled: nextContent.comments_enabled,
      });
    } catch (commentsError) {
      setError(
        commentsError instanceof Error
          ? commentsError.message
          : "Não foi possível concluir agora. Tente novamente.",
      );
    } finally {
      setIsManagingPost(false);
    }
  }

  async function handleCopyLink() {
    setIsOptionsOpen(false);

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/feed?content=${content.id}`);
    } catch {
      setError("Não foi possível copiar o link agora.");
    }
  }

  function handleTodoAction() {
    setIsOptionsOpen(false);
    setError("Bloqueio, denúncia e preferências entram na próxima rodada de segurança.");
  }

  return (
    <article className={styles.post}>
      <header className={styles.header}>
        {authorHref ? (
          <Link className={styles.avatar} href={authorHref}>
            <AuraAvatar
              aura={equippedAura}
              fallback={getInitial(authorName)}
              size="md"
              src={avatarUrl}
            />
          </Link>
        ) : (
          <div className={styles.avatar}>
            <AuraAvatar
              aura={equippedAura}
              fallback={getInitial(authorName)}
              size="md"
              src={avatarUrl}
            />
          </div>
        )}

        <div>
          {authorHref ? (
            <Link className={styles.authorLink} href={authorHref}>
              <strong>
                <BadgeIcon badge={authorBadge} size="sm" />
                {authorName}
              </strong>
              <span>~{username} - {formatTime(content.created_at)}</span>
            </Link>
          ) : (
            <>
              <strong>
                <BadgeIcon badge={authorBadge} size="sm" />
                {authorName}
              </strong>
              <span>~{username} - {formatTime(content.created_at)}</span>
            </>
          )}
        </div>

        <div className={styles.optionsWrap}>
          <button
            className={styles.moreButton}
            type="button"
            aria-label="Mais opcoes"
            disabled={isManagingPost}
            onClick={() => setIsOptionsOpen((current) => !current)}
          >
            <HiDotsHorizontal />
          </button>

          {isOptionsOpen && (
            <div className={styles.optionsMenu}>
              {isAuthor ? (
                <>
                  <button type="button" onClick={handleDeletePost}>
                    Apagar criação
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCommentsEnabledChange(!content.comments_enabled)}
                  >
                    {content.comments_enabled
                      ? "Bloquear comentários"
                      : "Liberar comentários"}
                  </button>
                  <button type="button" onClick={handleCopyLink}>
                    Copiar link
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={handleTodoAction}>
                    Denunciar
                  </button>
                  <button type="button" onClick={handleTodoAction}>
                    Não quero ver isso
                  </button>
                </>
              )}
              <button type="button" onClick={() => setIsOptionsOpen(false)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      </header>

      {content.text && <p className={styles.text}>{content.text}</p>}

      <div className={styles.meta}>
        <span>{content.content_type === "flow" ? "Flow" : "Criação"}</span>
      </div>

      {content.media_url && (
        <div className={styles.media}>
          {content.media_type === "video" ? (
            <video src={content.media_url} controls preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={content.media_url} alt="" />
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <button type="button" onClick={toggleComments}>
          <HiChatAlt2 />
          {formatCount(content.comments_count)}
        </button>
        <button
          type="button"
          className={content.has_waved ? styles.waveActive : ""}
          disabled={isTogglingWave}
          onClick={handleWave}
        >
          <HiRefresh />
          Wave {formatCount(content.wave_count)}
        </button>
        <button
          type="button"
          className={content.has_dahora ? styles.dahoraActive : ""}
          disabled={isTogglingDahora}
          onClick={handleDahora}
        >
          <HiFire />
          Dahora {formatCount(content.dahora_count)}
        </button>
        <span className={styles.presenceCount}>
          <HiEye />
          Presença {formatCount(content.presence_count)}
        </span>
        <button
          type="button"
          aria-label={content.is_saved ? "Remover dos salvos" : "Salvar"}
          className={content.is_saved ? styles.savedActive : ""}
          disabled={isTogglingSaved}
          onClick={handleSaved}
        >
          <HiBookmark />
          {content.is_saved ? "Salvo" : "Salvar"}
        </button>
      </footer>

      {error && <p className={styles.error}>{error}</p>}

      {isCommentsOpen && (
        <section className={styles.comments}>
          {isLoadingComments && <p className={styles.commentNotice}>Carregando comentários...</p>}

          {!isLoadingComments && !comments.length && (
            <p className={styles.commentNotice}>Seja o primeiro a comentar nesse flow.</p>
          )}

          {comments.map((comment) => {
            const commentAuthor = comment.author?.display_name || "Ocean User";
            const commentUsername = comment.author?.username || "ocean";
            const canDelete = user?.id === comment.author_id || isAuthor;
            const commentBadge =
              comment.author?.equipped_badge ??
              (comment.author?.is_founder
                ? getFounderBadge(comment.author.user_id, comment.author.official_label ?? "Fundador Ocean")
                : null);

            return (
              <article className={styles.comment} key={comment.id}>
                <div className={styles.commentAvatar}>
                  <AuraAvatar
                    aura={comment.author?.equipped_aura ?? null}
                    fallback={getInitial(commentAuthor)}
                    size="xs"
                    src={comment.author?.avatar_url}
                  />
                </div>

                <div>
                  <header>
                    <strong>
                      <BadgeIcon badge={commentBadge} size="xs" />
                      {commentAuthor}
                    </strong>
                    <span>~{commentUsername} - {formatTime(comment.created_at)}</span>
                  </header>
                  <p>{comment.text}</p>
                </div>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Apagar este comentário?")) {
                        handleDeleteComment(comment.id);
                      }
                    }}
                  >
                    Apagar comentário
                  </button>
                )}
              </article>
            );
          })}

          {content.comments_enabled ? (
            <form className={styles.commentForm} onSubmit={handleCommentSubmit}>
              <textarea
                maxLength={500}
                placeholder="Comente nesse flow..."
                rows={2}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <button type="submit" disabled={isSendingComment}>
                {isSendingComment ? "Comentando..." : "Comentar"}
              </button>
              <div className={styles.stickerWrap}>
                <button
                  aria-label="Abrir stickers"
                  type="button"
                  onClick={handleStickerPicker}
                >
                  <HiEmojiHappy />
                  Sticker
                </button>

                {isStickerPickerOpen && (
                  <div className={styles.stickerPopover}>
                    {isLoadingStickers ? (
                      <span>Carregando stickers...</span>
                    ) : stickers.length ? (
                      stickers.map((sticker) => (
                        <button
                          key={`${sticker.label}-${sticker.value}`}
                          type="button"
                          onClick={() => insertSticker(sticker.value)}
                        >
                          <strong>{sticker.value}</strong>
                          <span>{sticker.label}</span>
                        </button>
                      ))
                    ) : (
                      <span>Complete missões para desbloquear stickers.</span>
                    )}
                  </div>
                )}
              </div>
            </form>
          ) : (
            <p className={styles.commentNotice}>Comentários bloqueados pelo autor.</p>
          )}

          {commentError && <p className={styles.error}>{commentError}</p>}
        </section>
      )}
    </article>
  );
}
