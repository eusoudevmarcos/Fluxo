"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HiLockClosed } from "react-icons/hi";

import { createClient } from "@/lib/supabase/client";
import { defaultTheme, isThemeId, themes, type ThemeId } from "@/lib/themes";
import styles from "./ThemeSwitcher.module.css";

type ThemeSwitcherProps = {
  currentTheme?: string | null;
  onThemeChange?: (themeId: ThemeId) => void;
};

// Temas exclusivos desbloqueados pela pessoa (user_theme_unlocks, migration 054). Sem a tabela,
// nenhum exclusivo fica liberado; o banco tambem barra o salvamento.
async function loadUnlockedThemes() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Set<string>();

  const { data, error } = await supabase
    .from("user_theme_unlocks")
    .select("theme_id")
    .eq("user_id", userData.user.id);

  if (error) return new Set<string>();
  return new Set(((data ?? []) as { theme_id: string }[]).map((row) => row.theme_id));
}

export function ThemeSwitcher({
  currentTheme,
  onThemeChange,
}: ThemeSwitcherProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    isThemeId(currentTheme) ? currentTheme : defaultTheme,
  );
  const [unlockedThemes, setUnlockedThemes] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    loadUnlockedThemes().then((unlocked) => {
      if (isMounted) setUnlockedThemes(unlocked);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleThemeChange(themeId: ThemeId) {
    const previousTheme = selectedTheme;
    setSelectedTheme(themeId);
    setMessage("");
    window.dispatchEvent(
      new CustomEvent("ocean-theme-change", { detail: { theme: themeId } }),
    );

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!userData.user) {
        throw new Error("Usuário não autenticado.");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          theme: themeId,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userData.user.id);

      if (error) {
        throw error;
      }

      onThemeChange?.(themeId);
      setMessage("Tema atualizado.");
    } catch (error) {
      // Volta o visual para o tema anterior se o banco recusou (ex: exclusivo nao desbloqueado).
      setSelectedTheme(previousTheme);
      window.dispatchEvent(
        new CustomEvent("ocean-theme-change", { detail: { theme: previousTheme } }),
      );
      setMessage(
        error instanceof Error ? error.message : "Não foi possível salvar o tema.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.switcher} aria-label="Temas oficiais">
      <div className={styles.header}>
        <h2>Temas oficiais</h2>
        <span>{isSaving ? "Salvando..." : message}</span>
      </div>

      <div className={styles.grid}>
        {themes.map((theme) => {
          const isLocked = theme.exclusive && !unlockedThemes.has(theme.id);

          if (isLocked) {
            return (
              <div key={theme.id} className={styles.locked}>
                <strong>
                  <HiLockClosed aria-hidden /> {theme.name}
                </strong>
                <span>{theme.description}</span>
                <Link className={styles.unlockLink} href="/criadores">
                  Como desbloquear
                </Link>
              </div>
            );
          }

          return (
            <button
              key={theme.id}
              type="button"
              className={selectedTheme === theme.id ? styles.active : ""}
              disabled={isSaving}
              onClick={() => handleThemeChange(theme.id)}
            >
              <strong>{theme.name}</strong>
              <span>{theme.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
