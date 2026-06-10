import type { SupabaseClient } from "@supabase/supabase-js";

export type CommunityRoom = {
  id: string;
  community_id: string;
  name: string;
  room_number: number;
  capacity: number;
  online_count: number;
  status: "open" | "full" | "closed";
  is_vip: boolean;
  created_at: string;
  updated_at: string;
};

export async function listCommunityRooms(
  supabase: SupabaseClient,
  communityId: string,
): Promise<CommunityRoom[]> {
  const { data, error } = await supabase
    .from("community_rooms")
    .select("id,community_id,name,room_number,capacity,online_count,status,is_vip,created_at,updated_at")
    .eq("community_id", communityId)
    .order("room_number", { ascending: true });

  if (error) throw error;

  return (data ?? []) as CommunityRoom[];
}

export async function getAvailableRoomsForCommunity(
  supabase: SupabaseClient,
  communityId: string,
) {
  const rooms = await listCommunityRooms(supabase, communityId);
  return rooms.filter((room) => room.status === "open" && room.online_count < room.capacity);
}

export async function createDefaultRoomsForCommunity(
  supabase: SupabaseClient,
  communityId: string,
  capacity = 200,
) {
  const rows = [1, 2, 3, 4, 5].map((roomNumber) => ({
    community_id: communityId,
    name: `Sala ${roomNumber}`,
    room_number: roomNumber,
    capacity,
    online_count: 0,
  }));

  const { error } = await supabase.from("community_rooms").upsert(rows, {
    onConflict: "community_id,room_number",
  });

  if (error) throw error;
}

export async function maybeCreateExtraRoomsIfFull(_communityId: string) {
  void _communityId;
  // TODO: criar +2 salas quando todas estiverem cheias e houver backend/realtime.
  return { created: false };
}
