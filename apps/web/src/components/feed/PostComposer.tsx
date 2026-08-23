"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  HiEmojiHappy,
  HiHeart,
  HiLightningBolt,
  HiLockClosed,
  HiMusicNote,
  HiPhotograph,
  HiPlay,
  HiSparkles,
  HiTag,
  HiUserAdd,
  HiX,
} from "react-icons/hi";

import { useProfile } from "@/components/profile/ProfileProvider";
import { createContent, type ContentType, type MediaType } from "@/lib/services/contents.service";
import { uploadContentMedia } from "@/lib/services/media.service";
import { saveContent } from "@/lib/services/saved.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./PostComposer.module.css";

type PostComposerProps = {
  onCreated?: () => void | Promise<void>;
};

type Destination = "creation" | "flow" | "moments" | "privs" | "favorites" | "edit";

type SelectedMedia = {
  file: File;
  previewUrl: string;
  mediaType: Exclude<MediaType, "none">;
};

function getInitial(name?: string | null) {
  return (name || "Fluxo").trim().charAt(0).toUpperCase() || "W";
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function getMediaTypeFromFile(file: File): SelectedMedia["mediaType"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

function getContentTypeForDestination(destination: Destination): ContentType {
  return destination === "flow" || destination === "moments" ? "flow" : "post";
}

const quickEmojis = [
  "\u{1F30A}",
  "\u{1F525}",
  "\u{2728}",
  "\u{1F499}",
  "\u{1F4AA}",
  "\u{1F3B5}",
  "\u{2600}\u{FE0F}",
  "\u{1F3C4}",
];

export function PostComposer({ onCreated }: PostComposerProps) {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const formRef = useRef<HTMLFormElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [destination, setDestination] = useState<Destination>("creation");
  const [isEmojiMenuOpen, setIsEmojiMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const displayName = profile?.display_name || "seu perfil";

  useEffect(() => {
    return () => {
      if (selectedMedia?.previewUrl) {
        URL.revokeObjectURL(selectedMedia.previewUrl);
      }
    };
  }, [selectedMedia?.previewUrl]);

  useEffect(() => {
    function openFlowCreate() {
      setDestination("flow");
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => mediaInputRef.current?.click(), 120);
    }

    window.addEventListener("ocean-open-flow-create", openFlowCreate);

    return () => {
      window.removeEventListener("ocean-open-flow-create", openFlowCreate);
    };
  }, []);

  function setMediaFromFile(file?: File) {
    setError("");
    setNotice("");

    if (!file) return;

    const mediaType = getMediaTypeFromFile(file);
    if (!mediaType) {
      setError("Escolha uma foto ou vídeo em formato suportado.");
      return;
    }

    setSelectedMedia((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return {
        file,
        mediaType,
        previewUrl: URL.createObjectURL(file),
      };
    });
    setIsEmojiMenuOpen(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setMediaFromFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function removeMedia() {
    setSelectedMedia((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return null;
    });
  }

  function resetComposer() {
    setText("");
    removeMedia();
    setDestination("creation");
    setIsEmojiMenuOpen(false);
    setNotice("");
    setError("");
  }

  function handleTodo(message: string) {
    setNotice(message);
    setError("");
  }

  function appendEmoji(emoji: string) {
    setText((current) => `${current}${emoji}`);
    setIsEmojiMenuOpen(false);
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const trimmedText = text.trim();

    if (!trimmedText && !selectedMedia) {
      setError("Escreva algo ou adicione uma mídia.");
      return;
    }

    if (destination === "privs") {
      setNotice("Envio no Privs entra na próxima rodada.");
      return;
    }

    if (destination === "edit") {
      setNotice("Editor de imagem e vídeo entra na próxima rodada.");
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedMedia = selectedMedia
        ? await uploadContentMedia(supabase, selectedMedia.file)
        : null;
      const savedContent = await createContent(supabase, {
        text: trimmedText,
        media_url: uploadedMedia?.publicUrl,
        media_type: uploadedMedia?.mediaType ?? "none",
        content_type: getContentTypeForDestination(destination),
        gamification_action:
          destination === "moments"
            ? "create_moments"
            : destination === "flow"
              ? "create_flow"
              : "daily_activity",
      });

      if (destination === "favorites") {
        await saveContent(supabase, savedContent.id);
      }

      resetComposer();
      await onCreated?.();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Não foi possível criar agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form ref={formRef} className={styles.composer} onSubmit={handleSubmit}>
      <input
        ref={mediaInputRef}
        className={styles.fileInput}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
      />

      <div className={styles.typeRail} aria-label="Tipo de Drop">
        <button
          type="button"
          className={destination === "flow" ? styles.typeActive : ""}
          onClick={() => setDestination("flow")}
        >
          <HiPlay />
          Flow
        </button>
        <button
          type="button"
          className={destination === "moments" ? styles.typeActive : ""}
          onClick={() => setDestination("moments")}
        >
          <HiLightningBolt />
          Vibes
        </button>
        <button
          type="button"
          onClick={() => {
            setDestination("creation");
            mediaInputRef.current?.click();
          }}
        >
          <HiPhotograph />
          Foto
        </button>
        <button
          type="button"
          onClick={() => {
            setDestination("moments");
            mediaInputRef.current?.click();
          }}
        >
          <HiPlay />
          Vídeo
        </button>
        <button
          type="button"
          className={destination === "creation" && !selectedMedia ? styles.typeActive : ""}
          onClick={() => setDestination("creation")}
        >
          <HiTag />
          Texto
        </button>
        <button
          type="button"
          aria-label="Mais opções de Drop"
          onClick={() => mediaInputRef.current?.click()}
        >
          +
        </button>
      </div>

      <div className={styles.createRow}>
        <div className={styles.avatar}>
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" />
          ) : (
            <span>{getInitial(displayName)}</span>
          )}
        </div>

        <textarea
          placeholder="O que vai dropar hoje?"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
            setNotice("");
          }}
          rows={2}
          maxLength={1000}
        />

        <button
          className={styles.iconButton}
          type="button"
          aria-label="Adicionar foto ou vídeo"
          title="Adicionar foto ou vídeo"
          onClick={() => {
            setDestination("creation");
            mediaInputRef.current?.click();
          }}
        >
          <HiPhotograph />
        </button>

        <button
          className={styles.iconButton}
          type="button"
          aria-label="Emojis e stickers"
          title="Emojis e stickers"
          onClick={() => setIsEmojiMenuOpen((current) => !current)}
        >
          <HiEmojiHappy />
        </button>

        <button
          className={styles.createButton}
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Dropando..." : "Drop"}
        </button>
      </div>

      {isEmojiMenuOpen && (
        <div className={styles.emojiMenu} aria-label="Emojis e stickers">
          <div className={styles.emojiGrid}>
            {quickEmojis.map((emoji) => (
              <button type="button" key={emoji} onClick={() => appendEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => handleTodo("Stickers exclusivos entram em breve.")}>
            Aura Drops
          </button>
          <button type="button" onClick={() => handleTodo("Reações rápidas entram em breve.")}>
            Reações
          </button>
        </div>
      )}

      {selectedMedia && (
        <section className={styles.mediaPreview} aria-label="Mídia selecionada">
          <div className={styles.previewFrame}>
            {selectedMedia.mediaType === "video" ? (
              <video src={selectedMedia.previewUrl} controls muted preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedMedia.previewUrl} alt="" />
            )}
          </div>

          <div className={styles.previewInfo}>
            <strong>Sua mídia está pronta</strong>
            <span>
              {selectedMedia.mediaType === "video" ? "Vídeo" : "Foto"} ·{" "}
              {selectedMedia.file.name} · {formatFileSize(selectedMedia.file.size)}
            </span>
          </div>

          <button type="button" onClick={removeMedia}>
            <HiX />
            Remover mídia
          </button>
        </section>
      )}

      {selectedMedia && (
        <section className={styles.destinationPanel}>
          <div className={styles.destinationHeader}>
            <strong>Onde vai dropar?</strong>
            <span>Escolha o destino visual antes de enviar.</span>
          </div>

          <div className={styles.destinationGrid}>
            <button
              type="button"
              className={destination === "creation" ? styles.destinationActive : ""}
              onClick={() => setDestination("creation")}
            >
              <HiPhotograph />
              Dropar na Fluxo
            </button>
            <button
              type="button"
              className={destination === "flow" ? styles.destinationActive : ""}
              onClick={() => setDestination("flow")}
            >
              <HiPlay />
              Dropar no Flow
            </button>
            <button
              type="button"
              className={destination === "moments" ? styles.destinationActive : ""}
              onClick={() => setDestination("moments")}
            >
              <HiLightningBolt />
              Dropar em Vibes
            </button>
            <button
              type="button"
              className={destination === "privs" ? styles.destinationActive : ""}
              onClick={() => setDestination("privs")}
            >
              <HiLockClosed />
              Enviar no Privs
            </button>
            <button
              type="button"
              className={destination === "edit" ? styles.destinationActive : ""}
              onClick={() => setDestination("edit")}
            >
              <HiSparkles />
              Aura Drop
            </button>
            <button
              type="button"
              className={destination === "favorites" ? styles.destinationActive : ""}
              onClick={() => setDestination("favorites")}
            >
              <HiHeart />
              Salvar nos Favoritos
            </button>
            <button type="button" onClick={() => handleTodo("Marcar pessoas entra em breve.")}>
              <HiUserAdd />
              Marcar pessoas
            </button>
            <button type="button" onClick={() => handleTodo("Músicas entram em breve.")}>
              <HiMusicNote />
              Adicionar música
            </button>
          </div>

          {destination === "moments" && (
            <div className={styles.momentsOptions}>
              <strong>Opções de Vibes</strong>
              <div>
                <button type="button" onClick={() => handleTodo("Escolher Vibe existente entra em breve.")}>
                  <HiTag />
                  Escolher Vibe existente
                </button>
                <button type="button" onClick={() => handleTodo("Criar nova Vibe entra em breve.")}>
                  <HiSparkles />
                  Criar nova Vibe
                </button>
              </div>
              <span>Duração sugerida: 1 min, 3 min, 5 min ou até 8 min.</span>
            </div>
          )}
        </section>
      )}

      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}

