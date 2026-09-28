import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "dahora"
  | "comment"
  | "wave"
  | "follow"
  | "mission_reward"
  | "coin_gift"
  | "seal_granted"
  | "invite_accepted"
  | "creator_application_reviewed";

export type AppNotification = {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  content_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
  actor: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

// Notificacoes sao criadas pelo banco (triggers de wave/comentario/fa, missoes, selos,
// convites -- migrations 043+); o app so le e marca como lidas.
export async function listMyNotifications(supabase: SupabaseClient, limit = 50) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,actor_id,content_id,body,read_at,created_at")
    .eq("recipient_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = (data ?? []) as Omit<AppNotification, "actor">[];
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];

  let actors = new Map<string, AppNotification["actor"]>();
  if (actorIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id,username,display_name,avatar_url")
      .in("user_id", actorIds);

    if (profilesError) throw profilesError;

    actors = new Map(
      ((profiles ?? []) as ({ user_id: string } & NonNullable<AppNotification["actor"]>)[]).map(
        ({ user_id, ...profile }) => [user_id, profile],
      ),
    );
  }

  return rows.map((row) => ({
    ...row,
    actor: row.actor_id ? actors.get(row.actor_id) ?? null : null,
  }));
}

export async function countMyUnreadNotifications(supabase: SupabaseClient) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userData.user.id)
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

export async function markAllNotificationsRead(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
}

export function describeNotification(notification: AppNotification) {
  const name = notification.actor?.display_name || notification.actor?.username || "Alguém";

  switch (notification.type) {
    case "wave":
      return { icon: "🌊", text: `${name} deu uma Wave no seu post` };
    case "dahora":
      return { icon: "✦", text: `${name} achou seu post da hora` };
    case "comment":
      return {
        icon: "💬",
        text: notification.body ? `${name} comentou: ${notification.body}` : `${name} comentou no seu post`,
      };
    case "follow":
      return { icon: "♚", text: `${name} agora é seu fã` };
    case "invite_accepted":
      return { icon: "✉", text: `${name} entrou na Fluxo com o seu convite!` };
    case "mission_reward":
      return {
        icon: "⚡",
        text: notification.body ? `Missão concluída: ${notification.body}` : "Missão concluída!",
      };
    case "seal_granted":
      return {
        icon: "🏅",
        text: notification.body ? `Novo selo: ${notification.body}` : "Você ganhou um novo selo!",
      };
    case "coin_gift":
      return { icon: "🎁", text: `${name} te enviou Fluxo Coin` };
    case "creator_application_reviewed":
      return { icon: "✦", text: notification.body || "Sua inscrição Prime Influencer foi revisada." };
    default:
      return { icon: "•", text: notification.body || "Nova notificação" };
  }
}
