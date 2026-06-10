import styles from "./BadgeIcon.module.css";

export type EquippedBadge = {
  user_id?: string;
  badge_slug: string;
  badge_name: string;
  category: string;
  rarity: string;
  color_primary?: string | null;
  color_secondary?: string | null;
  visual_config?: Record<string, unknown> | null;
} | null;

type BadgeIconProps = {
  badge?: EquippedBadge;
  size?: "xs" | "sm" | "md" | "lg";
  title?: string;
  className?: string;
};

export function BadgeIcon({
  badge,
  size = "sm",
  title,
  className = "",
}: BadgeIconProps) {
  if (!badge) {
    return null;
  }

  const rarity = badge.rarity || "common";
  const category = badge.category || "gamification";

  return (
    <span
      aria-label={title ?? badge.badge_name}
      className={`${styles.badge} ${styles[size]} ${styles[rarity] ?? ""} ${styles[category] ?? ""} ${className}`}
      title={title ?? badge.badge_name}
    >
      <span className={styles.trident}>Ψ</span>
    </span>
  );
}
