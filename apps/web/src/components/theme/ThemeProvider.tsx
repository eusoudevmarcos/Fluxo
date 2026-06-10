"use client";

import { useEffect } from "react";

import {
  defaultTheme,
  getThemeClass,
  isThemeId,
  themes,
  type ThemeId,
} from "@/lib/themes";
import { createClient, getSupabaseConfigError } from "@/lib/supabase/client";

const themeClasses = themes.map((theme) => getThemeClass(theme.id));

function applyTheme(themeId: ThemeId) {
  document.body.classList.remove(...themeClasses);
  document.body.classList.add(getThemeClass(themeId));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let isMounted = true;

    async function loadTheme() {
      if (getSupabaseConfigError()) {
        applyTheme(defaultTheme);
        return;
      }

      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user) {
          applyTheme(defaultTheme);
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("theme")
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (isMounted) {
          applyTheme(isThemeId(data?.theme) ? data.theme : defaultTheme);
        }
      } catch {
        if (isMounted) {
          applyTheme(defaultTheme);
        }
      }
    }

    function handleThemeChange(event: Event) {
      const nextTheme = (event as CustomEvent<{ theme: string }>).detail?.theme;

      if (isThemeId(nextTheme)) {
        applyTheme(nextTheme);
      }
    }

    loadTheme();
    window.addEventListener("ocean-theme-change", handleThemeChange);

    return () => {
      isMounted = false;
      window.removeEventListener("ocean-theme-change", handleThemeChange);
    };
  }, []);

  return children;
}
