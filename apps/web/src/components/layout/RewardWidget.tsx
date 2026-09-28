"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HiCheck, HiLightningBolt, HiSparkles } from "react-icons/hi";
import type { MissionDefinition, UserGamification, UserMissionProgress } from "@ocean/shared";

import { ensureMyCoinWallet } from "@/lib/services/coin.service";
import { getMyGamification } from "@/lib/services/gamification.service";
import { getMyMissionProgress, listActiveMissions } from "@/lib/services/missions.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./RewardWidget.module.css";

const week = [
  { label: "Seg", done: true },
  { label: "Ter", done: true },
  { label: "Qua", done: true },
  { label: "Qui", done: true },
  { label: "Sex", done: true },
  { label: "Sáb", done: false },
  { label: "Dom", done: false },
];

export function RewardWidget() {
  const supabase = useMemo(() => createClient(), []);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [missions, setMissions] = useState<MissionDefinition[]>([]);
  const [progress, setProgress] = useState<UserMissionProgress[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getMyGamification(supabase).catch(() => null),
      listActiveMissions(supabase).catch(() => []),
      getMyMissionProgress(supabase).catch(() => []),
      ensureMyCoinWallet(supabase).catch(() => null),
    ]).then(([nextGamification, nextMissions, nextProgress, nextWallet]) => {
      if (!isMounted) return;
      setGamification(nextGamification);
      setMissions(nextMissions);
      setProgress(nextProgress);
      setCoinBalance(nextWallet?.balance ?? 0);
    });

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const level = gamification?.level ?? 12;
  const xpCurrent = gamification?.xp_current_level ?? 3250;
  const xpNext = gamification?.xp_next_level ?? 5000;
  const xpPercent = Math.min(100, Math.round((xpCurrent / Math.max(1, xpNext)) * 100));
  // Destaque: primeira missao sorteada (diarias vem primeiro) que ainda nao foi concluida.
  const progressFor = (mission: MissionDefinition) =>
    progress.find((item) => item.mission_id === mission.id);
  const mainMission =
    missions.find((mission) => !progressFor(mission)?.is_completed) ?? missions[0];
  const mainProgress = mainMission ? progressFor(mainMission) : undefined;
  const missionCurrent = mainProgress?.current_value ?? 0;
  const missionTarget = mainProgress?.target_value ?? mainMission?.target_value ?? 1;
  const missionPercent = Math.min(
    100,
    Math.round((missionCurrent / Math.max(1, missionTarget)) * 100),
  );
  const missionTitle = mainMission?.title ?? "Missões carregando...";
  const missionXp = mainMission?.xp_reward ?? 0;
  const missionCoin = mainMission?.coin_reward ?? 0;

  return (
    <section className={styles.rewardCard}>
      <header className={styles.header}>
        <strong>Missões & recompensas</strong>
        <Link href="/missoes">Ver todas</Link>
      </header>

      <div className={styles.level}>
        <span className={styles.crystal} aria-hidden="true">
          <HiSparkles />
        </span>
        <div>
          <small>Nível {level}</small>
          <strong>{gamification?.is_founder ? "Fundador Fluxo" : "Fluxeiro"}</strong>
        </div>
        <span className={styles.xp}>
          {xpCurrent.toLocaleString("pt-BR")} / {xpNext.toLocaleString("pt-BR")} XP ·{" "}
          {coinBalance.toLocaleString("pt-BR")} OC
        </span>
      </div>

      <div className={styles.progress} aria-label="Progresso do nível">
        <span style={{ width: `${xpPercent}%` }} />
      </div>

      <div className={styles.mission}>
        <HiLightningBolt />
        <div>
          <strong>{missionTitle}</strong>
          <div className={styles.missionBar}>
            <span style={{ width: `${missionPercent}%` }} />
          </div>
        </div>
        <small>
          {missionCurrent}/{missionTarget}
        </small>
        <em>
          <HiSparkles />
          +{missionXp} XP{missionCoin > 0 ? ` · +${missionCoin} OC` : ""}
        </em>
      </div>

      <div className={styles.streakHeader}>
        <span>Sequência de dias</span>
        <strong>{gamification?.streak_days ?? 6} dias</strong>
      </div>

      <div className={styles.week}>
        {week.map((day) => (
          <span key={day.label} className={day.done ? styles.done : ""}>
            <i>{day.done ? <HiCheck /> : ""}</i>
            <small>{day.label}</small>
          </span>
        ))}
      </div>
    </section>
  );
}
