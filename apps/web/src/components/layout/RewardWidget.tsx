"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HiCheck, HiLightningBolt, HiSparkles } from "react-icons/hi";
import type { UserGamification, UserMissionProgress } from "@ocean/shared";

import { getMyGamification } from "@/lib/services/gamification.service";
import { getMyMissionProgress } from "@/lib/services/missions.service";
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
  const [missions, setMissions] = useState<UserMissionProgress[]>([]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getMyGamification(supabase).catch(() => null),
      getMyMissionProgress(supabase).catch(() => []),
    ]).then(([nextGamification, nextMissions]) => {
      if (!isMounted) return;
      setGamification(nextGamification);
      setMissions(nextMissions);
    });

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const level = gamification?.level ?? 12;
  const xpCurrent = gamification?.xp_current_level ?? 3250;
  const xpNext = gamification?.xp_next_level ?? 5000;
  const xpPercent = Math.min(100, Math.round((xpCurrent / Math.max(1, xpNext)) * 100));
  const mainMission =
    missions.find((mission) => mission.mission?.slug === "weekly_join_5_communities") ??
    missions[0];
  const missionCurrent = mainMission?.current_value ?? 2;
  const missionTarget = mainMission?.target_value ?? 3;
  const missionPercent = Math.min(
    100,
    Math.round((missionCurrent / Math.max(1, missionTarget)) * 100),
  );
  const missionTitle = mainMission?.mission?.title ?? "Dropar 3 flows esta semana";
  const missionXp = mainMission?.mission?.xp_reward ?? 250;

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
          {xpCurrent.toLocaleString("pt-BR")} / {xpNext.toLocaleString("pt-BR")} XP
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
          +{missionXp} XP
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
