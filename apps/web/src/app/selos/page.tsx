"use client";

import { useEffect, useMemo, useState } from "react";
import { HiCheck, HiLockClosed, HiSparkles } from "react-icons/hi";

import { BadgeIcon } from "@/components/badges/BadgeIcon";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import {
  equipBadge,
  getMyBadges,
  getVerificationEligibility,
  listBadgeDefinitions,
  type BadgeDefinition,
  type UserBadge,
  type VerificationEligibility,
} from "@/lib/services/badges.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

const categoryLabels: Record<string, string> = {
  verification: "Verificados",
  gamification: "Gamificacao",
  engagement: "Engajamento",
  founder: "Fundador",
};

const rarityLabels: Record<string, string> = {
  common: "Comum",
  special: "Especial",
  rare: "Raro",
  epic: "Epico",
  legendary: "Lendario",
  milenar: "Milenar",
};

const categoryOrder = ["verification", "gamification", "engagement", "founder"];

function getBadgeStatus(badge: BadgeDefinition) {
  if (badge.slug === "verified-basic") {
    return "Disponivel para compra futuramente";
  }

  if (badge.category === "verification") {
    return "Desbloqueado por criterios";
  }

  return badge.unlock_type === "founder" ? "Liberacao manual" : "Conquista Fluxo";
}

export default function SelosPage() {
  return (
    <AppShell>
      <PageCard>
        <SelosContent />
      </PageCard>
    </AppShell>
  );
}

function SelosContent() {
  const supabase = useMemo(() => createClient(), []);
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [myBadges, setMyBadges] = useState<UserBadge[]>([]);
  const [eligibility, setEligibility] = useState<VerificationEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [equippingSlug, setEquippingSlug] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadBadges(showLoading = true) {
    if (showLoading) {
      setIsLoading(true);
    }

    setError("");

    try {
      const [nextBadges, nextMyBadges, nextEligibility] = await Promise.all([
        listBadgeDefinitions(supabase),
        getMyBadges(supabase),
        getVerificationEligibility(supabase),
      ]);

      setBadges(nextBadges);
      setMyBadges(nextMyBadges);
      setEligibility(nextEligibility);
    } catch {
      setError("Rode as migrations 034 a 036 para ativar o Sistema de Selos.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBadges(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function handleEquip(badge: BadgeDefinition) {
    setMessage("");
    setError("");
    setEquippingSlug(badge.slug);

    try {
      await equipBadge(supabase, badge.slug);
      setMessage(`${badge.name} equipado.`);
      await loadBadges(false);
    } catch (equipError) {
      setError(
        equipError instanceof Error
          ? equipError.message
          : "Não foi possível equipar esse selo.",
      );
    } finally {
      setEquippingSlug("");
    }
  }

  const ownedByBadgeId = new Map(myBadges.map((badge) => [badge.badge_id, badge]));
  const equippedBadge = myBadges.find((badge) => badge.is_equipped);
  const groupedBadges = categoryOrder
    .map((category) => ({
      category,
      badges: badges.filter((badge) => badge.category === category),
    }))
    .filter((group) => group.badges.length);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span>Identidade Fluxo</span>
          <h1>Sistema de Selos</h1>
          <p>Identidade, conquistas e reconhecimento social com medalhas discretas ao lado do nome.</p>
        </div>
        <div className={styles.preview}>
          <BadgeIcon
            badge={
              equippedBadge?.badge
                ? {
                    user_id: equippedBadge.user_id,
                    badge_slug: equippedBadge.badge.slug,
                    badge_name: equippedBadge.badge.name,
                    category: equippedBadge.badge.category,
                    rarity: equippedBadge.badge.rarity,
                    color_primary: equippedBadge.badge.color_primary,
                    color_secondary: equippedBadge.badge.color_secondary,
                    visual_config: equippedBadge.badge.visual_config,
                  }
                : null
            }
            size="lg"
          />
          <strong>{equippedBadge?.badge?.name ?? "Nenhum selo equipado"}</strong>
          <small>{myBadges.length} selos desbloqueados</small>
        </div>
      </header>

      {isLoading && <p className={styles.notice}>Carregando Selos...</p>}
      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.success}>{message}</p>}

      <section className={styles.eligibility}>
        <HiSparkles />
        <div>
          <strong>
            {eligibility?.eligible
              ? "Elegivel para verificacao"
              : "Verificacao por criterios"}
          </strong>
          <p>
            {eligibility
              ? `${eligibility.fans_count.toLocaleString("pt-BR")} fas • ${Math.round(eligibility.engagement_rate)}% engage medio`
              : "Fas 100K e engage medio entre 30% e 50% habilitam analise futura."}
          </p>
        </div>
      </section>

      {!isLoading && !error && groupedBadges.map((group) => (
        <section className={styles.section} key={group.category}>
          <header>
            <h2>{categoryLabels[group.category] ?? group.category}</h2>
          </header>

          <div className={styles.grid}>
            {group.badges.map((badge) => {
              const userBadge = ownedByBadgeId.get(badge.id);
              const unlocked = Boolean(userBadge);
              const equipped = Boolean(userBadge?.is_equipped);

              return (
                <article
                  className={[styles.badgeCard, unlocked ? styles.unlocked : styles.locked].join(" ")}
                  key={badge.id}
                >
                  <BadgeIcon
                    badge={{
                      badge_slug: badge.slug,
                      badge_name: badge.name,
                      category: badge.category,
                      rarity: badge.rarity,
                      color_primary: badge.color_primary,
                      color_secondary: badge.color_secondary,
                      visual_config: badge.visual_config,
                    }}
                    size="lg"
                  />

                  <div>
                    <span>{rarityLabels[badge.rarity] ?? badge.rarity}</span>
                    <h3>{badge.name}</h3>
                    <p>{badge.description || getBadgeStatus(badge)}</p>
                    <small>{getBadgeStatus(badge)}</small>
                  </div>

                  {unlocked ? (
                    <button
                      disabled={equipped || equippingSlug === badge.slug}
                      type="button"
                      onClick={() => handleEquip(badge)}
                    >
                      {equipped ? (
                        <>
                          <HiCheck /> Equipado
                        </>
                      ) : equippingSlug === badge.slug ? (
                        "Equipando..."
                      ) : (
                        "Equipar"
                      )}
                    </button>
                  ) : (
                    <em>
                      <HiLockClosed />
                      {badge.is_purchasable ? "Disponivel em breve" : "Bloqueado"}
                    </em>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className={styles.examples}>
        <h2>Onde aparecem</h2>
        {["No perfil", "Em um Drop", "Em um comentário"].map((label) => (
          <article key={label}>
            <BadgeIcon
              badge={{
                badge_slug: "verified-basic",
                badge_name: "Verificado",
                category: "verification",
                rarity: "common",
                color_primary: "#18d8ff",
                color_secondary: "#c9d6e8",
                visual_config: {},
              }}
              size="md"
            />
            <div>
              <strong>{label}</strong>
              <p>O selo fica pequeno ao lado do nome e não compete com a Aura do avatar.</p>
            </div>
          </article>
        ))}
      </section>

      <p className={styles.legalNotice}>
        Selos não são transferíveis. O uso indevido pode resultar em remoção.
      </p>
    </main>
  );
}
