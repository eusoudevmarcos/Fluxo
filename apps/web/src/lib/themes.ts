export const themes = [
  {
    id: "sunflow",
    name: "Sunflow",
    description: "Tema amarelo Fluxo, alto astral e padrao inicial.",
    exclusive: false,
  },
  {
    id: "ocean-blue",
    name: "Fluxo Blue",
    description: "Base escura com azul oceano, premium e global.",
    exclusive: false,
  },
  {
    id: "night-flow",
    name: "Night Flow",
    description: "Tema escuro com acentos azul e magenta, imersivo e focado.",
    exclusive: false,
  },
  {
    // Exclusivo dos Prime Influencers (migration 054 bloqueia no banco quem nao desbloqueou).
    id: "prime-gold",
    name: "Prime Gold",
    description: "Preto profundo com ouro e champagne. Exclusivo dos Prime Influencers.",
    exclusive: true,
  },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export const defaultTheme: ThemeId = "sunflow";

// Temas que qualquer pessoa pode usar (ex: o botao que alterna temas no topo).
export const publicThemes = themes.filter((theme) => !theme.exclusive);

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function getThemeClass(themeId: ThemeId) {
  return `theme-${themeId}`;
}
