import type { SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Push chega pela Expo Push API, disparada pelo banco (migration 056). Observacao: no Android o
// Expo Go nao recebe push remoto desde o SDK 53 -- testar com build de desenvolvimento/EAS.

let registeredToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(supabase: SupabaseClient) {
  if (!Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Fluxo",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== "granted" && current.canAskAgain) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }

  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  const { error } = await supabase.rpc("register_push_token", {
    input_token: token,
    input_platform: Platform.OS,
  });

  // Migration 056 ainda nao aplicada: segue sem push.
  if (error && error.code !== "42883" && error.code !== "PGRST202") throw error;

  registeredToken = token;
  return token;
}

// Ao sair da conta o aparelho deixa de receber pushes dela.
export async function unregisterPushNotifications(supabase: SupabaseClient) {
  if (!registeredToken) return;
  await supabase.rpc("unregister_push_token", { input_token: registeredToken });
  registeredToken = null;
}

// Toque numa notificacao push (app em segundo plano ou fechado).
export function addPushTapListener(onTap: () => void) {
  const subscription = Notifications.addNotificationResponseReceivedListener(() => onTap());
  return () => subscription.remove();
}
