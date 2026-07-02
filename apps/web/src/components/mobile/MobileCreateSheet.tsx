"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import {
  HiCamera,
  HiHeart,
  HiLockClosed,
  HiPhotograph,
  HiPlay,
  HiSparkles,
  HiX,
} from "react-icons/hi";

import { createContent, type ContentType, type MediaType } from "@/lib/services/contents.service";
import { uploadContentMedia } from "@/lib/services/media.service";
import { saveContent } from "@/lib/services/saved.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./MobileCreateSheet.module.css";

type MobileCreateSheetProps = {
  isOpen: boolean;
  onClose: () => void;
};

type CreateMode = "creation" | "flow" | "moments";
type Destination = CreateMode | "privs" | "favorites";

type SelectedMedia = {
  file: File;
  mediaType: Exclude<MediaType, "none">;
};

const modes: Array<{ id: CreateMode; label: string }> = [
  { id: "flow", label: "Flow" },
  { id: "moments", label: "Vibes" },
  { id: "creation", label: "Texto" },
];

function getMediaType(file: File): SelectedMedia["mediaType"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

function getContentType(destination: Destination): ContentType {
  return destination === "flow" || destination === "moments" ? "flow" : "post";
}

export function MobileCreateSheet({ isOpen, onClose }: MobileCreateSheetProps) {
  const supabase = useMemo(() => createClient(), []);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<CreateMode>("flow");
  const [destination, setDestination] = useState<Destination>("flow");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const hasDraft = Boolean(text.trim() || selectedMedia);

  if (!isOpen) return null;

  function changeMode(nextMode: CreateMode) {
    setMode(nextMode);
    setDestination(nextMode);
    setNotice("");
    setError("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setNotice("");
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const mediaType = getMediaType(file);
    if (!mediaType) {
      setError("Escolha uma foto ou vídeo.");
      return;
    }

    setSelectedMedia({ file, mediaType });
  }

  function reset() {
    setText("");
    setSelectedMedia(null);
    setMode("flow");
    setDestination("flow");
    setNotice("");
    setError("");
  }

  function closeSheet() {
    reset();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!hasDraft) {
      setError("Escreva algo ou escolha uma mídia.");
      return;
    }

    if (destination === "privs") {
      setNotice("Envio no Privs entra na próxima rodada.");
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedMedia = selectedMedia
        ? await uploadContentMedia(supabase, selectedMedia.file)
        : null;
      const content = await createContent(supabase, {
        text: text.trim(),
        media_url: uploadedMedia?.publicUrl,
        media_type: uploadedMedia?.mediaType ?? "none",
        content_type: getContentType(destination),
        gamification_action:
          destination === "moments"
            ? "create_moments"
            : destination === "flow"
              ? "create_flow"
              : "daily_activity",
      });

      if (destination === "favorites") {
        await saveContent(supabase, content.id);
      }

      window.dispatchEvent(new Event("ocean-content-created"));
      closeSheet();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Não foi possível dropar agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={closeSheet}>
      <form className={styles.sheet} onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
        <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" onChange={handleFileChange} />
        <input ref={photoRef} type="file" accept="image/*" onChange={handleFileChange} />
        <input ref={videoRef} type="file" accept="video/*" onChange={handleFileChange} />

        <header>
          <div>
            <strong>Drop</strong>
            <span>Flow, Vibes, foto, vídeo, texto ou câmera.</span>
          </div>
          <button type="button" onClick={closeSheet} aria-label="Fechar">
            <HiX />
          </button>
        </header>

        <div className={styles.modeTabs}>
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? styles.activeMode : ""}
              onClick={() => changeMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.quickActions}>
          <button type="button" onClick={() => cameraRef.current?.click()}>
            <HiCamera />
            Câmera
          </button>
          <button type="button" onClick={() => photoRef.current?.click()}>
            <HiPhotograph />
            Foto
          </button>
          <button type="button" onClick={() => videoRef.current?.click()}>
            <HiPlay />
            Vídeo
          </button>
        </div>

        <textarea
          placeholder="O que vai dropar hoje?"
          rows={3}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
            setNotice("");
          }}
        />

        {selectedMedia && (
          <div className={styles.selected}>
            <span>
              {selectedMedia.mediaType === "video" ? "Vídeo" : "Foto"} selecionado: {selectedMedia.file.name}
            </span>
            <button type="button" onClick={() => setSelectedMedia(null)}>
              Remover
            </button>
          </div>
        )}

        {hasDraft && (
          <div className={styles.destinations}>
            <strong>Dropar em</strong>
            <div>
              <button type="button" className={destination === "creation" ? styles.activeMode : ""} onClick={() => setDestination("creation")}>
                <HiPhotograph />
                Wave
              </button>
              <button type="button" className={destination === "flow" ? styles.activeMode : ""} onClick={() => setDestination("flow")}>
                <HiPlay />
                Flow
              </button>
              <button type="button" className={destination === "moments" ? styles.activeMode : ""} onClick={() => setDestination("moments")}>
                <HiSparkles />
                Vibes
              </button>
              <button type="button" className={destination === "privs" ? styles.activeMode : ""} onClick={() => setDestination("privs")}>
                <HiLockClosed />
                Privs
              </button>
              <button type="button" className={destination === "favorites" ? styles.activeMode : ""} onClick={() => setDestination("favorites")}>
                <HiHeart />
                Favoritos
              </button>
            </div>
          </div>
        )}

        {notice && <p className={styles.notice}>{notice}</p>}
        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.createButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Dropando..." : "Drop"}
        </button>
      </form>
    </div>
  );
}
