"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HiBell, HiChatAlt2, HiCurrencyDollar } from "react-icons/hi";
import { IoMoonOutline } from "react-icons/io5";

import { useProfile } from "@/components/profile/ProfileProvider";
import { ensureMyCoinWallet } from "@/lib/services/coin.service";
import { createClient } from "@/lib/supabase/client";
import { defaultTheme, isThemeId, publicThemes, type ThemeId } from "@/lib/themes";
import styles from "./TopActions.module.css";

function getInitial(name?: string | null) {
  return (name || "Fluxo").trim().charAt(0).toUpperCase() || "W";
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
  const supabase = useMemo(() => createClient(), []);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    ensureMyCoinWallet(supabase)
      .then((wallet) => {
        if (isMounted) setCoinBalance(wallet.balance);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleThemeCycle() {
    if (isSavingTheme) return;

    const currentTheme = isThemeId(profile?.theme) ? profile.theme : defaultTheme;
    // Alterna so entre os temas abertos; o exclusivo e escolhido no perfil por quem desbloqueou.
    const currentIndex = publicThemes.findIndex((theme) => theme.id === currentTheme);
    const nextTheme =
      publicThemes[(currentIndex + 1) % publicThemes.length]?.id ?? defaultTheme;

    window.dispatchEvent(
      new CustomEvent("ocean-theme-change", { detail: { theme: nextTheme } }),
    );

    if (!profile?.user_id) return;

    setIsSavingTheme(true);

    try {
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
        aria-label="Alternar tema da Fluxo"
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

      <Link className={styles.walletBadge} href="/carteira" aria-label="Fluxo Coin">
        <HiCurrencyDollar />
        <span>{(coinBalance ?? 0).toLocaleString("pt-BR")} OC</span>
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
