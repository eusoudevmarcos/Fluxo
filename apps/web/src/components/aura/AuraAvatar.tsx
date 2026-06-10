"use client";

import type { CSSProperties, ReactNode } from "react";

import styles from "./AuraAvatar.module.css";

export type EquippedAura = {
  user_id?: string;
  aura_slug?: string | null;
  aura_name?: string | null;
  rarity?: string | null;
  visual_config?: Record<string, unknown> | null;
  color_primary?: string | null;
  color_secondary?: string | null;
} | null;

type AuraAvatarProps = {
  src?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg";
  aura?: EquippedAura;
  fallback?: ReactNode;
  className?: string;
};

function getAuraClass(aura?: EquippedAura) {
  if (!aura?.rarity) return "";

  if (aura.rarity === "rare") return styles.rare;
  if (aura.rarity === "epic") return styles.epic;
  if (aura.rarity === "secret") return styles.secret;
  if (aura.rarity === "legendary") return styles.legendary;
  if (aura.rarity === "special") return styles.special;
  if (aura.rarity === "milenar") return styles.milenar;

  return styles.common;
}

export function AuraAvatar({
  src,
  alt = "",
  size = "md",
  aura,
  fallback,
  className,
}: AuraAvatarProps) {
  const cssVars = aura
    ? ({
        "--aura-primary": aura.color_primary || undefined,
        "--aura-secondary": aura.color_secondary || undefined,
      } as CSSProperties)
    : undefined;

  return (
    <span
      className={[
        styles.avatar,
        styles[size],
        aura ? styles.withAura : "",
        getAuraClass(aura),
        className ?? "",
      ].join(" ")}
      style={cssVars}
      title={aura?.aura_name ? `Aura equipada: ${aura.aura_name}` : undefined}
    >
      <span className={styles.inner}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} />
        ) : (
          <span className={styles.fallback}>{fallback}</span>
        )}
      </span>
    </span>
  );
}
