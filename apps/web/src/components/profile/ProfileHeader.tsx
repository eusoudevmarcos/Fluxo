import Link from "next/link";
import { HiEye, HiLocationMarker, HiPencilAlt, HiSparkles, HiSun } from "react-icons/hi";
import type { UserGamification } from "@ocean/shared";

import { AuraAvatar } from "@/components/aura/AuraAvatar";
import { BadgeIcon } from "@/components/badges/BadgeIcon";
import type { OceanProfile } from "@/lib/profiles/ensure-profile";
import type { PublicEquippedAura } from "@/lib/services/auras.service";
import type { PublicEquippedBadge } from "@/lib/services/badges.service";
import styles from "./ProfileHeader.module.css";

type ProfileStats = {
  flows: number;
  dahoras: number;
  fas: number;
  seletos: number;
  engage: string;
};

type ProfileHeaderProps = {
  profile: OceanProfile;
  onEdit?: () => void;
  stats?: ProfileStats;
  showPublicLink?: boolean;
  equippedAura?: PublicEquippedAura | null;
  equippedBadge?: PublicEquippedBadge | null;
  gamification?: UserGamification | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ProfileHeader({
  profile,
  onEdit,
  stats,
  showPublicLink = false,
  equippedAura,
  equippedBadge,
  gamification,
}: ProfileHeaderProps) {
  const displayName = profile.display_name || "Wave User";
  const username = profile.username || "ocean";
  const aura = equippedAura?.aura_name || profile.aura || "starter";
  const level = gamification?.level ?? 1;
  const xpCurrent = gamification?.xp_current_level ?? 0;
  const xpNext = gamification?.xp_next_level ?? 1000;
  const xpProgress = Math.min(100, Math.round((xpCurrent / Math.max(1, xpNext)) * 100));
  const flowId = username === "ocean" ? "1234" : username.slice(0, 4).toUpperCase();
  const location =
    profile.city && profile.state
      ? `${profile.city}, ${profile.state}`
      : profile.location_label;
  const visibleBadge =
    equippedBadge ??
    (gamification?.is_founder
      ? {
          user_id: profile.user_id,
          badge_slug: "badge-founder",
          badge_name: "Fundador",
          category: "founder",
          rarity: "milenar",
          color_primary: "#ffd01a",
          color_secondary: "#ff9a1f",
          visual_config: {},
        }
      : null);
  const displayStats = [
    { label: "Flows", value: String(stats?.flows ?? 0) },
    { label: "Dahoras", value: String(stats?.dahoras ?? 0) },
    { label: "Fãs", value: String(stats?.fas ?? 0) },
    { label: "Seletos", value: String(stats?.seletos ?? 0) },
    { label: "Engage", value: stats?.engage ?? "0%" },
  ];

  return (
    <section className={styles.header}>
      <div className={styles.cover} aria-hidden="true" />

      <div className={styles.hero}>
        <div className={styles.avatarWrap}>
          <AuraAvatar
            aura={equippedAura}
            fallback={getInitials(displayName)}
            size="lg"
            src={profile.avatar_url}
          />
        </div>

        <div className={styles.content}>
          <div className={styles.identity}>
            <h1>
              <BadgeIcon badge={visibleBadge} size="md" />
              {displayName}
              {gamification?.is_founder && <em>Fundador Wave</em>}
            </h1>
            <span>
              @{username}
              <b>Flow ID: {flowId}</b>
            </span>
          </div>

          <p>{profile.bio || "Complete sua ficha para aumentar sua presença na Wave."}</p>
        </div>
      </div>

      <div className={styles.profileChips}>
        <span className={styles.locationBadge}>
          <HiLocationMarker />
          {location || "Localização não informada"}
        </span>
        <span className={styles.themeBadge}>
          <HiSun />
          Tema: {profile.theme || "sunflow"}
        </span>
      </div>

      <div className={styles.meta}>
        <Link className={styles.levelPill} href="/missoes">
          <span className={styles.metaIcon}>
            <HiSparkles />
          </span>
          <strong>Nível {level}</strong>
          <i>
            <span style={{ width: `${xpProgress}%` }} />
          </i>
        </Link>
        <Link className={styles.auraPill} href="/auras">
          <span className={styles.metaIcon}>
            <HiSparkles />
          </span>
          <strong>Aura: {aura}</strong>
        </Link>
        {gamification?.is_founder && (
          <span className={styles.founderSeal}>
            <span className={styles.metaIcon}>
              <HiSparkles />
            </span>
            <strong>Fundador Wave</strong>
            <small>Perfil Oficial</small>
          </span>
        )}
      </div>

      {(onEdit || showPublicLink) && (
        <div className={styles.headerActions}>
          {onEdit && (
            <button type="button" onClick={onEdit}>
              <HiPencilAlt />
              Editar perfil
            </button>
          )}

          {showPublicLink && profile.username ? (
            <Link className={styles.secondaryButton} href={`/u/${profile.username}`}>
              <HiEye />
              Ver perfil público
            </Link>
          ) : showPublicLink ? (
            <button type="button" className={styles.secondaryButton}>
              <HiEye />
              Ver como público
            </button>
          ) : null}

          <Link className={styles.secondaryButton} href="/auras">
            <HiSparkles />
            Ver Auras
          </Link>
          <Link className={styles.secondaryButton} href="/missoes">
            <HiSparkles />
            Minhas Missões
          </Link>
        </div>
      )}

      <div className={styles.stats}>
        {displayStats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

