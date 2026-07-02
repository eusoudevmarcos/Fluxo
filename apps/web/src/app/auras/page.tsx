"use client";

import { useEffect, useMemo, useState } from "react";
import { HiCheck, HiLockClosed, HiSparkles } from "react-icons/hi";
import type { AuraDefinition, UserAura, UserGamification } from "@ocean/shared";

import { AuraAvatar } from "@/components/aura/AuraAvatar";
import { AppShell } from "@/components/layout/AppShell";
import { useProfile } from "@/components/profile/ProfileProvider";
import { PageCard } from "@/components/ui/PageCard";
import {
  equipAura,
  getEquippedAura,
  getMyAuras,
  listAuraDefinitions,
  type PublicEquippedAura,
} from "@/lib/services/auras.service";
import { getMyGamification } from "@/lib/services/gamification.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

const rarityLabels: Record<string, string> = {
  common: "Comum",
  special: "Especial",
  rare: "Raro",
  epic: "Épico",
  secret: "Secreto",
  legendary: "Lendário",
  milenar: "Milenar",
};

function getInitial(name?: string | null) {
  return (name || "O").trim().charAt(0).toUpperCase() || "O";
}

export default function AurasPage() {
  return (
    <AppShell>
      <PageCard>
        <AurasContent />
      </PageCard>
    </AppShell>
  );
}

function AurasContent() {
  const supabase = useMemo(() => createClient(), []);
  const { profile, user } = useProfile();
  const [definitions, setDefinitions] = useState<AuraDefinition[]>([]);
  const [myAuras, setMyAuras] = useState<UserAura[]>([]);
  const [equippedAura, setEquippedAura] = useState<PublicEquippedAura | null>(null);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [equippingSlug, setEquippingSlug] = useState("");

  async function loadAuras(showLoading = true) {
    if (showLoading) {
      setIsLoading(true);
      setError("");
    }

    try {
      const [nextDefinitions, nextMyAuras, nextGamification] = await Promise.all([
        listAuraDefinitions(supabase),
        getMyAuras(supabase),
        getMyGamification(supabase).catch(() => null),
      ]);

      setDefinitions(nextDefinitions);
      setMyAuras(nextMyAuras);
      setGamification(nextGamification);

      if (user?.id) {
        setEquippedAura(await getEquippedAura(supabase, user.id).catch(() => null));
      }
    } catch {
      setError("Rode as migrations 026 a 033 para ativar sua coleção de Auras.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAuras(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.id]);

  async function handleEquip(aura: AuraDefinition) {
    setMessage("");
    setError("");
    setEquippingSlug(aura.slug);

    try {
      await equipAura(supabase, aura.slug);
      setMessage(`${aura.name} equipada.`);
      await loadAuras();
    } catch (equipError) {
      setError(
        equipError instanceof Error
          ? equipError.message
          : "Não foi possível equipar essa Aura.",
      );
    } finally {
      setEquippingSlug("");
    }
  }

  const ownedAuraIds = new Set(myAuras.map((aura) => aura.aura_id));
  const ownedCount = gamification?.has_all_auras ? definitions.length : ownedAuraIds.size;
  const displayName = profile?.display_name || "Wave User";

  return (
        <main className={styles.page}>
          <header className={styles.hero}>
            <div>
              <span>Auras colecionáveis</span>
              <h1>Suas Auras na Wave</h1>
              <p>Equipe uma Aura sutil no avatar e leve sua identidade para perfil, Drops e comentários.</p>
            </div>
            <div className={styles.preview}>
              <AuraAvatar
                aura={equippedAura}
                fallback={getInitial(displayName)}
                size="lg"
                src={profile?.avatar_url}
              />
              <strong>{equippedAura?.aura_name || "Nenhuma Aura equipada"}</strong>
              <small>{ownedCount} Auras desbloqueadas</small>
            </div>
          </header>

          {isLoading && <p className={styles.notice}>Carregando Auras...</p>}
          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}

          {!isLoading && !error && (
            <>
              <section className={styles.grid}>
                {definitions.map((aura) => {
                  const unlocked =
                    gamification?.has_all_auras ||
                    ownedAuraIds.has(aura.id);
                  const equipped = equippedAura?.aura_slug === aura.slug;

                  return (
                    <article
                      className={[
                        styles.auraCard,
                        unlocked ? styles.unlocked : styles.locked,
                      ].join(" ")}
                      key={aura.id}
                    >
                      <AuraAvatar
                        aura={{
                          aura_name: aura.name,
                          aura_slug: aura.slug,
                          color_primary: aura.color_primary,
                          color_secondary: aura.color_secondary,
                          rarity: aura.rarity,
                          visual_config: aura.visual_config,
                        }}
                        fallback={<HiSparkles />}
                        size="md"
                      />
                      <div>
                        <span>{rarityLabels[aura.rarity] ?? aura.rarity}</span>
                        <h2>{aura.name}</h2>
                        <p>{aura.description || "Aura colecionável da Wave."}</p>
                        <small>+{aura.xp_bonus_percent}% XP em missões</small>
                      </div>
                      {unlocked ? (
                        <button
                          type="button"
                          disabled={equipped || equippingSlug === aura.slug}
                          onClick={() => handleEquip(aura)}
                        >
                          {equipped ? (
                            <>
                              <HiCheck /> Equipada
                            </>
                          ) : equippingSlug === aura.slug ? (
                            "Equipando..."
                          ) : (
                            "Equipar"
                          )}
                        </button>
                      ) : (
                        <em>
                          <HiLockClosed />
                          Bloqueada
                        </em>
                      )}
                    </article>
                  );
                })}
              </section>

              <section className={styles.examples}>
                <header>
                  <h2>Veja suas Auras em todo o Wave</h2>
                </header>
                {["Perfil", "Drop", "Comentários"].map((label, index) => (
                  <article key={label}>
                    <AuraAvatar
                      aura={equippedAura}
                      fallback={getInitial(displayName)}
                      size={index === 0 ? "md" : "sm"}
                      src={profile?.avatar_url}
                    />
                    <div>
                      <strong>{label}</strong>
                      <p>A Aura aparece de forma discreta, acompanhando o avatar quadrado da Wave.</p>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
        </main>
  );
}
