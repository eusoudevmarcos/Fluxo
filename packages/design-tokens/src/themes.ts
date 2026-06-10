export type OceanThemeToken = {
  id: "sunflow" | "ocean-blue" | "night-flow";
  name: string;
  bg: string;
  card: string;
  text: string;
  muted: string;
  primary: string;
  primaryHover: string;
  accent: string;
  border: string;
};

export const OCEAN_THEMES = [
  {
    id: "sunflow",
    name: "Sunflow",
    bg: "#020617",
    card: "#090d12",
    text: "#f8fafc",
    muted: "#a7a7ad",
    primary: "#ffc700",
    primaryHover: "#ffb800",
    accent: "#ffc700",
    border: "rgba(255,199,0,0.15)",
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    bg: "#020817",
    card: "#071426",
    text: "#f8fafc",
    muted: "#9ab1c6",
    primary: "#0ea5e9",
    primaryHover: "#38bdf8",
    accent: "#38bdf8",
    border: "rgba(56,189,248,0.16)",
  },
  {
    id: "night-flow",
    name: "Night Flow",
    bg: "#020617",
    card: "#080e1d",
    text: "#f8fafc",
    muted: "#a5b0c2",
    primary: "#0ea5e9",
    primaryHover: "#38bdf8",
    accent: "#d946ef",
    border: "rgba(148,163,184,0.14)",
  },
] as const satisfies readonly OceanThemeToken[];
