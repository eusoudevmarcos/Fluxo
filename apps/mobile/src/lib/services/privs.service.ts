import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type PrivProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type PrivConversation = {
  id: string;
  conversation_type: "direct" | "group";
  updated_at: string;
  last_read_at: string | null;
  other_members: PrivProfile[];
  title: string;
  subtitle: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type PrivMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "system";
  created_at: string;
  sender: PrivProfile | null;
};

type ConversationRow = {
  id: string;
  conversation_type: "direct" | "group";
  updated_at: string;
};

type ConversationMembershipRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  user_id: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "system";
  created_at: string;
};

async function getCurrentUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Entre na Fluxo para usar o Privs.");
  return data.user.id;
}

async function getProfilesByUserId(supabase: SupabaseClient, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueUserIds.length) return new Map<string, PrivProfile>();

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,avatar_url")
    .in("user_id", uniqueUserIds);

  if (error) throw error;

  return new Map(((data ?? []) as PrivProfile[]).map((profile) => [profile.user_id, profile]));
}

function getProfileName(profile?: PrivProfile | null) {
  return profile?.display_name || profile?.username || "Fluxo User";
}

function formatConversation(
  currentUserId: string,
  membership: ConversationMembershipRow,
  conversation: ConversationRow,
  members: PrivProfile[],
  messages: MessageRow[],
): PrivConversation {
  const otherMembers = members.filter((member) => member.user_id !== currentUserId);
  const title =
    conversation.conversation_type === "group"
      ? otherMembers.map(getProfileName).join(", ") || "Grupo Fluxo"
      : getProfileName(otherMembers[0]);
  const subtitle =
    conversation.conversation_type === "group"
      ? `${members.length} membros`
      : otherMembers[0]?.username
        ? `~${otherMembers[0].username}`
        : "Privs";
  const latestMessage = messages[0] ?? null;
  const lastReadAt = membership.last_read_at ? new Date(membership.last_read_at).getTime() : 0;

  return {
    id: conversation.id,
    conversation_type: conversation.conversation_type,
    updated_at: conversation.updated_at,
    last_read_at: membership.last_read_at,
    other_members: otherMembers,
    title,
    subtitle,
    avatar_url: otherMembers[0]?.avatar_url ?? null,
    last_message: latestMessage?.body ?? null,
    last_message_at: latestMessage?.created_at ?? null,
    unread_count: messages.filter(
      (message) =>
        message.sender_id !== currentUserId &&
        new Date(message.created_at).getTime() > lastReadAt,
    ).length,
  };
}

export async function listMyConversations(supabase: SupabaseClient): Promise<PrivConversation[]> {
  const currentUserId = await getCurrentUserId(supabase);

  const { data: membershipsData, error: membershipsError } = await supabase
    .from("priv_conversation_members")
    .select("conversation_id,last_read_at")
    .eq("user_id", currentUserId)
    .order("joined_at", { ascending: false });

  if (membershipsError) throw membershipsError;

  const memberships = (membershipsData ?? []) as ConversationMembershipRow[];
  const conversationIds = memberships.map((membership) => membership.conversation_id);

  if (!conversationIds.length) return [];

  const [conversationsResult, membersResult, messagesResult] = await Promise.all([
    supabase.from("priv_conversations").select("id,conversation_type,updated_at").in("id", conversationIds),
    supabase
      .from("priv_conversation_members")
      .select("conversation_id,user_id")
      .in("conversation_id", conversationIds),
    supabase
      .from("priv_messages")
      .select("id,conversation_id,sender_id,body,message_type,created_at")
      .in("conversation_id", conversationIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (conversationsResult.error) throw conversationsResult.error;
  if (membersResult.error) throw membersResult.error;
  if (messagesResult.error) throw messagesResult.error;

  const memberRows = (membersResult.data ?? []) as ConversationMemberRow[];
  const messageRows = (messagesResult.data ?? []) as MessageRow[];
  const conversationsById = new Map(
    ((conversationsResult.data ?? []) as ConversationRow[]).map((conversation) => [
      conversation.id,
      conversation,
    ]),
  );
  const profiles = await getProfilesByUserId(supabase, memberRows.map((member) => member.user_id));

  const membersByConversation = new Map<string, PrivProfile[]>();
  const messagesByConversation = new Map<string, MessageRow[]>();

  for (const member of memberRows) {
    const profile = profiles.get(member.user_id);
    if (!profile) continue;
    membersByConversation.set(member.conversation_id, [
      ...(membersByConversation.get(member.conversation_id) ?? []),
      profile,
    ]);
  }

  for (const message of messageRows) {
    messagesByConversation.set(message.conversation_id, [
      ...(messagesByConversation.get(message.conversation_id) ?? []),
      message,
    ]);
  }

  return memberships
    .map((membership) => {
      const conversation = conversationsById.get(membership.conversation_id);
      if (!conversation) return null;

      return formatConversation(
        currentUserId,
        membership,
        conversation,
        membersByConversation.get(membership.conversation_id) ?? [],
        messagesByConversation.get(membership.conversation_id) ?? [],
      );
    })
    .filter((conversation): conversation is PrivConversation => Boolean(conversation))
    .sort((a, b) => {
      const aTime = new Date(a.last_message_at ?? a.updated_at).getTime();
      const bTime = new Date(b.last_message_at ?? b.updated_at).getTime();
      return bTime - aTime;
    });
}

export async function getConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<PrivMessage[]> {
  const { data, error } = await supabase
    .from("priv_messages")
    .select("id,conversation_id,sender_id,body,message_type,created_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(80);

  if (error) throw error;

  const rows = (data ?? []) as MessageRow[];
  const profiles = await getProfilesByUserId(supabase, rows.map((message) => message.sender_id));

  return rows.map((message) => ({
    ...message,
    sender: profiles.get(message.sender_id) ?? null,
  }));
}

export async function getOrCreateDirectConversation(
  supabase: SupabaseClient,
  otherUserId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
    other_user_id: otherUserId,
  });

  if (error) throw error;

  return String(data);
}

export async function sendPrivMessage(
  supabase: SupabaseClient,
  conversationId: string,
  body: string,
) {
  const { data, error } = await supabase.rpc("send_priv_message", {
    conversation_id: conversationId,
    body,
  });

  if (error) throw error;

  return data as MessageRow;
}

export async function markConversationRead(supabase: SupabaseClient, conversationId: string) {
  const { error } = await supabase.rpc("mark_conversation_read", {
    conversation_id: conversationId,
  });

  if (error) throw error;
}

export function subscribeToConversation(
  supabase: SupabaseClient,
  conversationId: string,
  callback: () => void,
): RealtimeChannel {
  const channelId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return supabase
    .channel(`privs:${conversationId}:${channelId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "priv_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => callback(),
    )
    .subscribe();
}
