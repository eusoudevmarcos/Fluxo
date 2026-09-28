import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

import { normalizeInviteCode } from "./services/invites.service";

// Codigo de convite recebido por link (fluxo://c/CODIGO ou https://<site>/c/CODIGO) guardado
// ate o fim do onboarding -- no meio ha login/cadastro e o app pode ser fechado.
const PENDING_INVITE_KEY = "fluxo:pending-invite-code";

export function extractInviteCode(url: string | null | undefined) {
  if (!url) return null;
  // Cobre fluxo://c/CODIGO e https://<site>/c/CODIGO.
  const match = url.match(/\/c\/([A-Za-z0-9]{4,12})(?:[/?#]|$)/);
  return match ? normalizeInviteCode(match[1]) : null;
}

export async function savePendingInviteCode(code: string) {
  await AsyncStorage.setItem(PENDING_INVITE_KEY, normalizeInviteCode(code)).catch(() => undefined);
}

export async function readPendingInviteCode() {
  return (await AsyncStorage.getItem(PENDING_INVITE_KEY).catch(() => null)) ?? "";
}

export async function clearPendingInviteCode() {
  await AsyncStorage.removeItem(PENDING_INVITE_KEY).catch(() => undefined);
}

// Escuta o link que abriu o app (e links recebidos com o app aberto). Retorna a funcao de
// limpeza do listener.
export function listenForInviteLinks() {
  const handleUrl = (url: string | null) => {
    const code = extractInviteCode(url);
    if (code) void savePendingInviteCode(code);
  };

  void Linking.getInitialURL().then(handleUrl).catch(() => undefined);
  const subscription = Linking.addEventListener("url", (event) => handleUrl(event.url));

  return () => subscription.remove();
}
