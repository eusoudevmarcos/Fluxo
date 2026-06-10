"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { defaultTheme, isThemeId, themes, type ThemeId } from "@/lib/themes";
import styles from "./ThemeSwitcher.module.css";

type ThemeSwitcherProps = {
  currentTheme?: string | null;
  onThemeChange?: (themeId: ThemeId) => void;
};

export function ThemeSwitcher({
  currentTheme,
  onThemeChange,
}: ThemeSwitcherProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    isThemeId(currentTheme) ? currentTheme : defaultTheme,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleThemeChange(themeId: ThemeId) {
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
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={selectedTheme === theme.id ? styles.active : ""}
            onClick={() => handleThemeChange(theme.id)}
          >
            <strong>{theme.name}</strong>
            <span>{theme.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
