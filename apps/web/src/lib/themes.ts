export const themes = [
  {
    id: "sunflow",
    name: "Sunflow",
    description: "Tema amarelo Wave, alto astral e padrao inicial.",
  },
  {
    id: "ocean-blue",
    name: "Wave Blue",
    description: "Base escura com azul oceano, premium e global.",
  },
  {
    id: "night-flow",
    name: "Night Flow",
    description: "Tema escuro com acentos azul e magenta, imersivo e focado.",
  },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export const defaultTheme: ThemeId = "sunflow";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function getThemeClass(themeId: ThemeId) {
  return `theme-${themeId}`;
}
