import { OCEAN_THEMES } from "@ocean/design-tokens";

export const oceanMobileTheme = OCEAN_THEMES.find((theme) => theme.id === "night-flow") ?? OCEAN_THEMES[2];

export const oceanTypography = {
  // TODO: carregar Comfortaa/Expo Font quando a implementacao mobile real comecar.
  fontFamily: "System",
  fontFamilyRegular: "System",
  fontFamilyMedium: "System",
  fontFamilySemiBold: "System",
  fontFamilyBold: "System",
};