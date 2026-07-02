import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export const COMMUNITY_ROOM_CHAT_SETUP_MESSAGE =
  "As salas de chat precisam da migração Supabase de mensagens para enviar.";

export type RoomChatProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type CommunityRoomMessage = {
  id: string;
  room_id: string;
  community_id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "system";
  created_at: string;
  sender: RoomChatProfile | null;
};

type RoomMessageRow = {
  id: string;
  room_id: string;
  community_id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "system";
  created_at: string;
};

export function isCommunityRoomChatSetupError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message?.toLowerCase() ?? "";

  return (
    maybeError.code === "PGRST202" ||
    maybeError.code === "PGRST205" ||
    message.includes("community_room_messages") ||
    message.includes("community_room_presence") ||
    message.includes("join_community_room") ||
    message.includes("leave_community_room") ||
    message.includes("salas de chat precisam") ||
    message.includes("schema cache")
  );
}

function toRoomChatError(error: unknown) {
  if (isCommunityRoomChatSetupError(error)) {
    return new Error(COMMUNITY_ROOM_CHAT_SETUP_MESSAGE);
  }

  return error;
}

async function getCurrentUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Entre na Wave para conversar na sala.");
  return data.user.id;
}

async function getProfilesByUserId(supabase: SupabaseClient, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (!uniqueUserIds.length) {
    return new Map<string, RoomChatProfile>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,avatar_url")
    .in("user_id", uniqueUserIds);

  if (error) throw error;

  return new Map(
    ((data ?? []) as RoomChatProfile[]).map((profile) => [profile.user_id, profile]),
  );
}

export async function listRoomMessages(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase
    .from("community_room_messages")
    .select("id,room_id,community_id,sender_id,body,message_type,created_at")
    .eq("room_id", roomId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw toRoomChatError(error);

  const rows = (data ?? []) as RoomMessageRow[];
  const profiles = await getProfilesByUserId(
    supabase,
    rows.map((message) => message.sender_id),
  );

  return rows.map((message) => ({
    ...message,
    sender: profiles.get(message.sender_id) ?? null,
  })) as CommunityRoomMessage[];
}

export async function sendRoomMessage(
  supabase: SupabaseClient,
  roomId: string,
  communityId: string,
  body: string,
) {
  const senderId = await getCurrentUserId(supabase);
  const text = body.trim();

  if (!text) {
    throw new Error("Escreva uma mensagem para enviar.");
  }

  const { data, error } = await supabase
    .from("community_room_messages")
    .insert({
      room_id: roomId,
      community_id: communityId,
      sender_id: senderId,
      body: text,
    })
    .select("id,room_id,community_id,sender_id,body,message_type,created_at")
    .single();

  if (error) throw toRoomChatError(error);

  return data as RoomMessageRow;
}

export async function joinRoomPresence(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase.rpc("join_community_room", {
    room_id: roomId,
  });

  if (error) {
    if (isCommunityRoomChatSetupError(error)) return null;
    throw error;
  }

  return data;
}

export async function leaveRoomPresence(supabase: SupabaseClient, roomId: string) {
  const { error } = await supabase.rpc("leave_community_room", {
    room_id: roomId,
  });

  if (error) {
    if (isCommunityRoomChatSetupError(error)) return;
    throw error;
  }
}

export async function getRoomPresenceCount(supabase: SupabaseClient, roomId: string) {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("community_room_presence")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .is("left_at", null)
    .gte("last_seen_at", cutoff);

  if (error) {
    if (isCommunityRoomChatSetupError(error)) return 0;
    throw error;
  }

  return count ?? 0;
}

export function subscribeToRoomMessages(
  supabase: SupabaseClient,
  roomId: string,
  callback: () => void,
): RealtimeChannel {
  return supabase
    .channel(`community-room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "community_room_messages",
        filter: `room_id=eq.${roomId}`,
      },
      () => callback(),
    )
    .subscribe();
}
