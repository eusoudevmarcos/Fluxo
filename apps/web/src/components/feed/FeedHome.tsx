"use client";

import { useEffect, useMemo, useState } from "react";

import { useProfile } from "@/components/profile/ProfileProvider";
import {
  listFeedContents,
  type FeedContent,
} from "@/lib/services/contents.service";
import { createClient } from "@/lib/supabase/client";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";
import { SwagCarousel } from "./SwagCarousel";
import styles from "./FeedHome.module.css";

export function FeedHome() {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useProfile();
  const [contents, setContents] = useState<FeedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function refreshFeed() {
    setError("");

    try {
      const nextContents = await listFeedContents(supabase, user?.id);
      setContents(nextContents);
    } catch (feedError) {
      setError(
        feedError instanceof Error
          ? feedError.message
          : "Não foi possível carregar o feed.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      refreshFeed();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    window.addEventListener("ocean-content-created", refreshFeed);

    return () => {
      window.removeEventListener("ocean-content-created", refreshFeed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function updateContent(nextContent: FeedContent) {
    setContents((currentContents) =>
      currentContents.map((content) =>
        content.id === nextContent.id ? nextContent : content,
      ),
    );
  }

  function removeContent(contentId: string) {
    setContents((currentContents) =>
      currentContents.filter((content) => content.id !== contentId),
    );
  }

  return (
    <div className={styles.feed}>
      <nav className={styles.mobileTabs} aria-label="Experiência mobile">
        <button className={styles.mobileTabActive} type="button">Flow</button>
        <button type="button">Moments</button>
        <button type="button">Discover</button>
      </nav>

      <PostComposer onCreated={refreshFeed} />

      <SwagCarousel />

      {isLoading && <p className={styles.notice}>Carregando flows...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!isLoading && !error && !contents.length && (
        <section className={styles.empty}>
          <strong>Seu flow ainda está calmo.</strong>
          <span>Crie a primeira criação para movimentar a Wave.</span>
        </section>
      )}

      {contents.map((content) => (
        <PostCard
          content={content}
          key={content.id}
          onChange={updateContent}
          onDelete={removeContent}
        />
      ))}
    </div>
  );
}
