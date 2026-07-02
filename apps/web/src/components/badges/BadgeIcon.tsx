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
      <svg
        className={styles.trident}
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M31.8 8c2.2 0 4 1.8 4 4v24.1c5.1-1.5 8.9-6.3 8.9-11.9v-8.4l-4 4-5.1-5.1L48.3 2 61 14.7l-5.1 5.1-4-4v8.4c0 9.6-6.9 17.7-16.1 19.5V54h8.6v7.2H19.2V54h8.7V43.8c-9.2-1.9-16.1-10-16.1-19.6v-8.4l-4 4-5.1-5.1L15.4 2l12.7 12.7-5.1 5.1-4-4v8.4c0 5.7 3.8 10.4 8.9 11.9V12c0-2.2 1.8-4 3.9-4Z" />
      </svg>
    </span>
  );
}
