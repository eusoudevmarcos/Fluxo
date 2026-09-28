import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import { ensureMyCoinWallet } from "../lib/services/coin.service";
import {
  ensureMyGamification,
  getLevelTitle,
  type UserGamification,
} from "../lib/services/gamification.service";
import {
  getMyMissionProgress,
  listActiveMissions,
  type MissionDefinition,
  type UserMissionProgress,
} from "../lib/services/missions.service";

type MissionsScreenProps = {
  onBack: () => void;
  onOpenWallet: () => void;
  onOpenInvites: () => void;
};

type MissionGroup = "daily" | "weekly" | "other";

function missionGroup(mission: MissionDefinition): MissionGroup {
  if (mission.cadence === "daily") return "daily";
  if (mission.cadence === "weekly") return "weekly";
  return "other";
}

function getProgressForMission(mission: MissionDefinition, progress: UserMissionProgress[]) {
  return progress.find((item) => item.mission_id === mission.id);
}

export function MissionsScreen({ onBack, onOpenWallet, onOpenInvites }: MissionsScreenProps) {
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [missions, setMissions] = useState<MissionDefinition[]>([]);
  const [progress, setProgress] = useState<UserMissionProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadMissions = useCallback(async () => {
    const supabase = createMobileSupabaseClient();
    const [nextGamification, nextWallet, nextMissions, nextProgress] = await Promise.all([
      ensureMyGamification(supabase),
      ensureMyCoinWallet(supabase),
      listActiveMissions(supabase),
      getMyMissionProgress(supabase),
    ]);

    setGamification(nextGamification);
    setCoinBalance(nextWallet.balance);
    setMissions(nextMissions);
    setProgress(nextProgress);
  }, []);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setErrorMessage("");
    loadMissions()
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Não foi possível carregar suas missões.",
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadMissions]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ffc400" size="large" />
      </View>
    );
  }

  const xpCurrent = gamification?.xp_current_level ?? 0;
  const xpNext = gamification?.xp_next_level ?? 1000;
  const xpPercent = Math.min(100, Math.round((xpCurrent / Math.max(1, xpNext)) * 100));
  const dailyMissions = missions.filter((mission) => missionGroup(mission) === "daily");
  const weeklyMissions = missions.filter((mission) => missionGroup(mission) === "weekly");
  const otherMissions = missions.filter((mission) => missionGroup(mission) === "other");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Missões & Recompensas</Text>
        <View style={styles.backButton} />
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <View style={styles.levelCard}>
        <View style={styles.crystal}>
          <Text style={styles.crystalIcon}>✦</Text>
        </View>
        <View style={styles.levelInfo}>
          <Text style={styles.levelLabel}>Nível {gamification?.level ?? 1}</Text>
          <Text style={styles.levelTitle}>{getLevelTitle(gamification)}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${xpPercent}%` }]} />
          </View>
        </View>
        <Pressable onPress={onOpenWallet} style={styles.levelStats}>
          <Text style={styles.levelStatText}>
            {xpCurrent.toLocaleString("pt-BR")} / {xpNext.toLocaleString("pt-BR")} XP
          </Text>
          <Text style={styles.walletLink}>{coinBalance.toLocaleString("pt-BR")} OC ›</Text>
        </Pressable>
      </View>

      <Pressable onPress={onOpenInvites} style={styles.inviteBanner}>
        <Text style={styles.inviteBannerTitle}>Convidar amigos</Text>
        <Text style={styles.inviteBannerText}>
          Traga amigos com seu convite, avance missões e concorra ao selo Pioneiro Azul ›
        </Text>
      </Pressable>

      <MissionSection missions={dailyMissions} progress={progress} title="Missões de hoje" />
      <MissionSection missions={weeklyMissions} progress={progress} title="Missões da semana" />
      {otherMissions.length > 0 && (
        <MissionSection missions={otherMissions} progress={progress} title="Desafios especiais" />
      )}
    </ScrollView>
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {missions.length ? (
        missions.map((mission) => {
          const missionProgress = getProgressForMission(mission, progress);
          const current = missionProgress?.current_value ?? 0;
          const target = missionProgress?.target_value ?? mission.target_value;
          const percent = Math.min(100, Math.round((current / Math.max(1, target)) * 100));

          return (
            <View key={mission.id} style={styles.mission}>
              <Text style={styles.missionIcon}>⚡</Text>
              <View style={styles.missionBody}>
                <Text style={styles.missionTitle}>{mission.title}</Text>
                <Text style={styles.missionDescription}>
                  {mission.description || "Avance seu flow e ganhe recompensas."}
                </Text>
                <View style={styles.missionBar}>
                  <View style={[styles.missionBarFill, { width: `${percent}%` }]} />
                </View>
              </View>
              <View style={styles.missionMeta}>
                <Text style={styles.missionProgress}>
                  {current}/{target}
                  {missionProgress?.is_completed ? " ✓" : ""}
                </Text>
                <Text style={styles.missionReward}>+{mission.xp_reward} XP</Text>
                {mission.coin_reward > 0 && (
                  <Text style={styles.missionReward}>+{mission.coin_reward} OC</Text>
                )}
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyText}>Missões aparecem aqui em breve.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#030711",
    flex: 1,
  },
  centered: {
    alignItems: "center",
    backgroundColor: "#030711",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    gap: 18,
    paddingBottom: 118,
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backButton: {
    minWidth: 28,
    padding: 4,
  },
  backText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    padding: 12,
  },
  levelCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  crystal: {
    alignItems: "center",
    backgroundColor: "#3154ff",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  crystalIcon: {
    color: "#ffffff",
    fontSize: 20,
  },
  levelInfo: {
    flex: 1,
    gap: 6,
  },
  levelLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
  },
  levelTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  progressBar: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    height: 6,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "#ffc400",
    borderRadius: 999,
    height: "100%",
  },
  levelStats: {
    alignItems: "flex-end",
    gap: 4,
  },
  levelStatText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "800",
  },
  walletLink: {
    color: "#ffc400",
    fontSize: 12,
    fontWeight: "900",
  },
  inviteBanner: {
    backgroundColor: "rgba(30,136,255,0.12)",
    borderColor: "rgba(30,136,255,0.35)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  inviteBannerTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  inviteBannerText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  mission: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  missionIcon: {
    color: "#ffc400",
    fontSize: 18,
  },
  missionBody: {
    flex: 1,
    gap: 6,
  },
  missionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  missionDescription: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 12,
  },
  missionBar: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    height: 5,
    overflow: "hidden",
  },
  missionBarFill: {
    backgroundColor: "#3154ff",
    borderRadius: 999,
    height: "100%",
  },
  missionMeta: {
    alignItems: "flex-end",
    gap: 3,
  },
  missionProgress: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  missionReward: {
    color: "#8edbff",
    fontSize: 11,
    fontWeight: "900",
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    paddingVertical: 8,
  },
});
