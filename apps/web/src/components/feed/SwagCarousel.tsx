"use client";

import { useEffect, useMemo, useState } from "react";
import { HiChevronRight, HiPlay, HiPlus, HiX } from "react-icons/hi";

import { BadgeIcon, type EquippedBadge } from "@/components/badges/BadgeIcon";
import { listActiveFlows, type FlowPreview } from "@/lib/services/contents.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./SwagCarousel.module.css";

function getDisplayName(flow: FlowPreview) {
  return flow.author?.display_name || flow.author?.username || "Wave";
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "W";
}

function getFounderBadge(userId?: string, label = "Fundador Wave"): EquippedBadge {
  return {
    user_id: userId,
    badge_slug: "badge-founder",
    badge_name: label || "Fundador Wave",
    category: "founder",
    rarity: "milenar",
    color_primary: "#ffd01a",
    color_secondary: "#ff9a1f",
    visual_config: {},
  };
}

const suggestedFlows = [
  { name: "Lucas R.", time: "2 h atrÃ¡s", tone: "surf" },
  { name: "Marina Costa", time: "4 h atrÃ¡s", tone: "sunset" },
  { name: "Pedro Alves", time: "5 h atrÃ¡s", tone: "city" },
  { name: "Ana Clara", time: "7 h atrÃ¡s", tone: "sport" },
  { name: "Thiago Mendes", time: "9 h atrÃ¡s", tone: "stage" },
  { name: "Rafa Souza", time: "12 h atrÃ¡s", tone: "night" },
];

export function SwagCarousel() {
  const supabase = useMemo(() => createClient(), []);
  const [flows, setFlows] = useState<FlowPreview[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<FlowPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  function openFlowCreate() {
    window.dispatchEvent(new Event("ocean-open-flow-create"));
  }

  useEffect(() => {
    let isMounted = true;

    async function loadFlows() {
      setError("");

      try {
        const nextFlows = await listActiveFlows(supabase);

        if (isMounted) {
          setFlows(nextFlows);
        }
      } catch (flowError) {
        if (isMounted) {
          setError(
            flowError instanceof Error
              ? flowError.message
              : "NÃ£o foi possÃ­vel carregar os Flows.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadFlows();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return (
    <>
      <section className={styles.flows} aria-label="Flows ativos">
        <div className={styles.header}>
          <div>
            <strong>Flows dos seus seletos</strong>
            {!isLoading && !error && !flows.length && (
              <span>SugestÃµes para vocÃª sentir o ritmo da Wave.</span>
            )}
          </div>
          <button type="button">Ver todos</button>
        </div>

        <div className={styles.track}>
          <button
            className={`${styles.swagCard} ${styles.createFlowCard}`}
            type="button"
            onClick={openFlowCreate}
          >
            <div className={styles.swagImage}>
              <HiPlus />
            </div>
            <strong>Criar flow</strong>
          </button>

          {isLoading && <p className={styles.notice}>Carregando Flows...</p>}
          {!isLoading && error && <p className={styles.error}>{error}</p>}

          {!isLoading && !error && flows.length > 0 && flows.map((flow) => {
            const displayName = getDisplayName(flow);
            const flowBadge =
              flow.author?.equipped_badge ??
              (flow.author?.is_founder
                ? getFounderBadge(flow.author.user_id, flow.author.official_label ?? "Fundador Wave")
                : null);

            return (
              <button
                key={flow.id}
                className={styles.swagCard}
                type="button"
                onClick={() => setSelectedFlow(flow)}
              >
                <div className={styles.swagImage}>
                  {flow.media_url ? (
                    flow.media_type === "video" ? (
                      <video src={flow.media_url} muted preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={flow.media_url} alt="" />
                    )
                  ) : (
                    <span className={styles.initial}>{getInitial(displayName)}</span>
                  )}
                  <span className={styles.badge}>FLOW</span>
                </div>

                <strong>
                  <BadgeIcon badge={flowBadge} size="xs" />
                  {displayName}
                </strong>
              </button>
            );
          })}

          {!isLoading && !error && !flows.length && suggestedFlows.map((flow) => (
            <button
              key={flow.name}
              className={`${styles.swagCard} ${styles.suggestedCard}`}
              type="button"
              onClick={openFlowCreate}
            >
              <div className={styles.swagImage}>
                <span className={`${styles.suggestionArt} ${styles[flow.tone]}`} />
                <span className={styles.badge}>FLOW</span>
              </div>
              <strong>{flow.name}</strong>
              <small>{flow.time}</small>
            </button>
          ))}

          <button className={styles.nextButton} type="button" aria-label="Ver mais Flows">
            <HiChevronRight />
          </button>
        </div>
      </section>

      {selectedFlow && (
        <div
          className={styles.viewerBackdrop}
          role="presentation"
          onClick={() => setSelectedFlow(null)}
        >
          <article
            className={styles.viewer}
            role="dialog"
            aria-modal="true"
            aria-label="Visualizar Flow"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div className={styles.viewerAvatar}>
                {selectedFlow.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedFlow.author.avatar_url} alt="" />
                ) : (
                  <span>{getInitial(getDisplayName(selectedFlow))}</span>
                )}
              </div>
              <div>
                <strong>
                  <BadgeIcon
                    badge={
                      selectedFlow.author?.equipped_badge ??
                      (selectedFlow.author?.is_founder
                        ? getFounderBadge(
                            selectedFlow.author.user_id,
                            selectedFlow.author.official_label ?? "Fundador Wave",
                          )
                        : null)
                    }
                    size="sm"
                  />
                  {getDisplayName(selectedFlow)}
                </strong>
                {selectedFlow.author?.username && <span>~{selectedFlow.author.username}</span>}
              </div>
              <button type="button" onClick={() => setSelectedFlow(null)}>
                <HiX />
              </button>
            </header>

            <div className={styles.viewerMedia}>
              {selectedFlow.media_url ? (
                selectedFlow.media_type === "video" ? (
                  <video src={selectedFlow.media_url} controls autoPlay />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedFlow.media_url} alt="" />
                )
              ) : (
                <div className={styles.textFlow}>
                  <HiPlay />
                  <p>{selectedFlow.text || "Flow sem legenda"}</p>
                </div>
              )}
            </div>

            {selectedFlow.media_url && selectedFlow.text && <p>{selectedFlow.text}</p>}
          </article>
        </div>
      )}
    </>
  );
}
