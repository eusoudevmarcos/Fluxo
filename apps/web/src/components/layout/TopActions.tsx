"use client";

import Link from "next/link";
import { useState } from "react";
import { HiBell, HiChatAlt2, HiCurrencyDollar } from "react-icons/hi";
import { IoMoonOutline } from "react-icons/io5";

import { useProfile } from "@/components/profile/ProfileProvider";
import { createClient } from "@/lib/supabase/client";
import { defaultTheme, isThemeId, themes, type ThemeId } from "@/lib/themes";
import styles from "./TopActions.module.css";

function getInitial(name?: string | null) {
  return (name || "Ocean").trim().charAt(0).toUpperCase() || "O";
}

type TopActionsProps = {
  isPrivsOpen?: boolean;
  isNotificationsOpen?: boolean;
  onToggleNotifications?: () => void;
  onTogglePrivs?: () => void;
};

export function TopActions({
  isPrivsOpen = false,
  isNotificationsOpen = false,
  onToggleNotifications,
  onTogglePrivs,
}: TopActionsProps) {
  const { profile } = useProfile();
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  async function handleThemeCycle() {
    if (isSavingTheme) return;

    const currentTheme = isThemeId(profile?.theme) ? profile.theme : defaultTheme;
    const currentIndex = themes.findIndex((theme) => theme.id === currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length]?.id ?? defaultTheme;

    window.dispatchEvent(
      new CustomEvent("ocean-theme-change", { detail: { theme: nextTheme } }),
    );

    if (!profile?.user_id) return;

    setIsSavingTheme(true);

    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ theme: nextTheme as ThemeId, updated_at: new Date().toISOString() })
        .eq("user_id", profile.user_id);
    } finally {
      setIsSavingTheme(false);
    }
  }

  return (
    <div className={styles.topActions}>
      <button
        type="button"
        aria-label="Alternar tema da Ocean"
        disabled={isSavingTheme}
        title="Alternar tema"
        onClick={handleThemeCycle}
      >
        <IoMoonOutline />
      </button>

      <button
        type="button"
        className={`${styles.notification} ${isNotificationsOpen ? styles.activeAction : ""}`}
        aria-label={isNotificationsOpen ? "Fechar notificações" : "Abrir notificações"}
        aria-pressed={isNotificationsOpen}
        onClick={onToggleNotifications}
      >
        <HiBell />
        <span>3</span>
      </button>

      <button
        type="button"
        className={isPrivsOpen ? styles.activeAction : ""}
        aria-label={isPrivsOpen ? "Fechar Privs" : "Abrir Privs"}
        aria-pressed={isPrivsOpen}
        onClick={onTogglePrivs}
      >
        <HiChatAlt2 />
      </button>

      <Link className={styles.walletBadge} href="/mais" aria-label="Ocean Coin">
        <HiCurrencyDollar />
        <span>0 OC</span>
      </Link>

      <Link className={styles.profileAvatar} href="/perfil" aria-label="Perfil">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" />
        ) : (
          <span>{getInitial(profile?.display_name)}</span>
        )}
        <i aria-hidden="true" />
      </Link>
    </div>
  );
}
