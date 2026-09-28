"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HiCheck, HiLightningBolt, HiSparkles } from "react-icons/hi";
import type { MissionDefinition, UserGamification, UserMissionProgress } from "@ocean/shared";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/ui/PageCard";
import { ensureMyCoinWallet } from "@/lib/services/coin.service";
import { ensureMyGamification } from "@/lib/services/gamification.service";
import {
  getMyMissionProgress,
  listActiveMissions,
} from "@/lib/services/missions.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type MissionGroup = "daily" | "weekly" | "other";

function getLevelTitle(gamification?: UserGamification | null) {
  if (gamification?.is_founder) return "Fundador Fluxo";
  if ((gamification?.level ?? 1) >= 25) return "Fluxeiro Elite";
  if ((gamification?.level ?? 1) >= 10) return "Fluxeiro";
  return "Novo Flow";
}

function getProgressForMission(
  mission: MissionDefinition,
  progress: UserMissionProgress[],
) {
  return progress.find((item) => item.mission_id === mission.id);
}

function missionGroup(mission: MissionDefinition): MissionGroup {
  if (mission.cadence === "daily") return "daily";
  if (mission.cadence === "weekly") return "weekly";
  return "other";
}

export default function MissoesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [missions, setMissions] = useState<MissionDefinition[]>([]);
  const [progress, setProgress] = useState<UserMissionProgress[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadMissions() {
      setIsLoading(true);
      setError("");

      try {
        const [nextGamification, nextWallet, nextMissions, nextProgress] = await Promise.all([
          ensureMyGamification(supabase),
          ensureMyCoinWallet(supabase),
          listActiveMissions(supabase),
          getMyMissionProgress(supabase),
        ]);

        if (isMounted) {
          setGamification(nextGamification);
          setCoinBalance(nextWallet.balance);
          setMissions(nextMissions);
          setProgress(nextProgress);
        }
      } catch {
        if (isMounted) {
          setError("Rode as migrations 026 a 033 para ativar Missões, XP e Auras.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadMissions();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const xpCurrent = gamification?.xp_current_level ?? 0;
  const xpNext = gamification?.xp_next_level ?? 1000;
  const xpPercent = Math.min(100, Math.round((xpCurrent / Math.max(1, xpNext)) * 100));
  const dailyMissions = missions.filter((mission) => missionGroup(mission) === "daily");
  const weeklyMissions = missions.filter((mission) => missionGroup(mission) === "weekly");
  const secretMissions = missions.filter((mission) => missionGroup(mission) === "other");

  return (
    <AppShell>
      <PageCard>
        <main className={styles.page}>
          <header className={styles.hero}>
            <div>
              <span>Fluxo Aura</span>
              <h1>Missões & Recompensas</h1>
              <p>
                Todo dia você recebe 3 missões novas e toda semana mais 5, escolhidas para a sua
                fase na Fluxo. Ganhe XP, Fluxo Coin, Auras e, a cada missão semanal, mais um
                convite. Quem cumpre missões ganha alcance e aparece mais nas sugestões de quem
                seguir.
              </p>
            </div>
            <Link href="/auras">Ver minhas Auras</Link>
          </header>

          {isLoading && <p className={styles.notice}>Carregando missões...</p>}
          {error && <p className={styles.error}>{error}</p>}

          {!isLoading && !error && (
            <>
              <section className={styles.levelCard}>
                <span className={styles.crystal}>
                  <HiSparkles />
                </span>
                <div>
                  <small>Nível {gamification?.level ?? 1}</small>
                  <strong>{getLevelTitle(gamification)}</strong>
                  <div className={styles.progressBar} aria-label="Progresso do nível">
                    <span style={{ width: `${xpPercent}%` }} />
                  </div>
                </div>
                <em>
                  {xpCurrent.toLocaleString("pt-BR")} / {xpNext.toLocaleString("pt-BR")} XP
                  <br />
                  {coinBalance.toLocaleString("pt-BR")} OC
                </em>
              </section>

              <section className={styles.grid}>
                <MissionSection
                  missions={dailyMissions}
                  progress={progress}
                  title="Missões de hoje · renovam à meia-noite"
                />
                <MissionSection
                  missions={weeklyMissions}
                  progress={progress}
                  title="Missões da semana · renovam na segunda"
                />
              </section>

              <section className={styles.grid}>
                <InfoCard
                  items={[
                    "Nível 1-9: Aura Super Saiyajin Comum",
                    "Nível 10-24: Aura Super Saiyajin Blue",
                    "Nível 25-49: Aura Instinto Superior",
                    "500% da meta: Aura Ego Superior",
                  ]}
                  title="Níveis & Auras"
                />
                <InfoCard
                  items={[
                    "30 por mês: comuns",
                    "5 por mês: especiais",
                    "5 a cada 2 meses: raras",
                    "2 a cada 5 meses: secretas",
                  ]}
                  title="Drops mensais"
                />
              </section>

              <section className={styles.grid}>
                <InfoCard
                  items={["XP", "Selos", "Destaques", "Aura", "Stickers"]}
                  title="Recompensas extras"
                />
                <MissionSection
                  missions={secretMissions}
                  progress={progress}
                  title="Desafios especiais"
                />
              </section>
            </>
          )}
        </main>
      </PageCard>
    </AppShell>
  );
}

function MissionSection({
  title,
  missions,
  progress,
}: {
  title: string;
  missions: MissionDefinition[];
  progress: UserMissionProgress[];
}) {
  return (
    <section className={styles.card}>
      <header>
        <h2>{title}</h2>
      </header>
      <div className={styles.missionList}>
        {missions.length ? (
          missions.map((mission) => {
            const missionProgress = getProgressForMission(mission, progress);
            const current = missionProgress?.current_value ?? 0;
            const target = missionProgress?.target_value ?? mission.target_value;
            const percent = Math.min(100, Math.round((current / Math.max(1, target)) * 100));

            return (
              <article key={mission.id} className={styles.mission}>
                <HiLightningBolt />
                <div>
                  <strong>{mission.title}</strong>
                  <p>{mission.description || "Avance seu flow e ganhe recompensas."}</p>
                  <div className={styles.progressBar}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <small>
                  {current}/{target}
                  {missionProgress?.is_completed ? <HiCheck /> : null}
                </small>
                <em>
                  +{mission.xp_reward} XP
                  {mission.coin_reward > 0 && (
                    <>
                      <br />
                      +{mission.coin_reward} OC
                    </>
                  )}
                </em>
              </article>
            );
          })
        ) : (
          <p className={styles.notice}>Missões aparecem aqui depois das migrations.</p>
        )}
      </div>
    </section>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className={styles.card}>
      <header>
        <h2>{title}</h2>
      </header>
      <ul className={styles.infoList}>
        {items.map((item) => (
          <li key={item}>
            <HiSparkles />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
