import type { SupabaseClient } from "@supabase/supabase-js";

import { getEquippedAurasByUserIds, type PublicEquippedAura } from "./auras.service";
import { createDefaultRoomsForCommunity } from "./community-rooms.service";
import { joinCommunity } from "./community-members.service";
import { createContent, type FeedContent, type CreateContentInput } from "./contents.service";

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  is_official: boolean;
  is_local: boolean;
  city: string | null;
  state: string | null;
  country: string | null;
  owner_id: string | null;
  status: "active" | "paused" | "blocked";
  max_rooms: number;
  room_capacity: number;
  rules: string[] | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
  room_count?: number;
};

export type CreateCommunityInput = {
  name: string;
  description: string;
  category: string;
  is_local?: boolean;
  rules?: string[];
};

type CommunityContentRow = {
  id: string;
  author_id: string;
  content_type: "post" | "flow";
  text: string | null;
  media_url: string | null;
  media_type: "image" | "video" | "none";
  momentum_id: string | null;
  community_id: string | null;
  visibility: "public";
  comments_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  equipped_aura?: PublicEquippedAura | null;
};

type CountableRow = {
  content_id: string;
};

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function countByContentId(rows: CountableRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.content_id] = (acc[row.content_id] ?? 0) + 1;
    return acc;
  }, {});
}

async function addCommunityStats(
  supabase: SupabaseClient,
  communities: Community[],
): Promise<Community[]> {
  if (!communities.length) return [];

  const ids = communities.map((community) => community.id);
  const [membersResult, roomsResult] = await Promise.all([
    supabase
      .from("community_members")
      .select("community_id")
      .eq("status", "active")
      .in("community_id", ids),
    supabase
      .from("community_rooms")
      .select("community_id")
      .in("community_id", ids),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (roomsResult.error) throw roomsResult.error;

  const memberCounts = (membersResult.data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.community_id] = (acc[row.community_id] ?? 0) + 1;
    return acc;
  }, {});
  const roomCounts = (roomsResult.data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.community_id] = (acc[row.community_id] ?? 0) + 1;
    return acc;
  }, {});

  return communities.map((community) => ({
    ...community,
    member_count: memberCounts[community.id] ?? 0,
    room_count: roomCounts[community.id] ?? 0,
  }));
}

export async function listCommunities(supabase: SupabaseClient): Promise<Community[]> {
  const { data, error } = await supabase
    .from("communities")
    .select("id,slug,name,description,cover_url,category,is_official,is_local,city,state,country,owner_id,status,max_rooms,room_capacity,rules,created_at,updated_at")
    .eq("status", "active")
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return addCommunityStats(supabase, (data ?? []) as Community[]);
}

export async function getCommunityBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Community | null> {
  const { data, error } = await supabase
    .from("communities")
    .select("id,slug,name,description,cover_url,category,is_official,is_local,city,state,country,owner_id,status,max_rooms,room_capacity,rules,created_at,updated_at")
    .eq("slug", normalizeSlug(slug))
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [community] = await addCommunityStats(supabase, [data as Community]);
  return community ?? null;
}

export async function createCommunity(
  supabase: SupabaseClient,
  input: CreateCommunityInput,
): Promise<Community> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!userData.user) {
    throw new Error("Entre na Wave para criar uma comunidade.");
  }

  const name = input.name.trim();
  if (name.length < 3) {
    throw new Error("Nome da comunidade precisa ter pelo menos 3 caracteres.");
  }

  const baseSlug = normalizeSlug(name);
  const slug = `${baseSlug || "comunidade"}-${Date.now().toString(36)}`;
  const profileResult = input.is_local
    ? await supabase
        .from("profiles")
        .select("city,state,country")
        .eq("user_id", userData.user.id)
        .maybeSingle()
    : null;

  if (profileResult?.error) throw profileResult.error;

  const profileLocation = profileResult?.data as
    | { city: string | null; state: string | null; country: string | null }
    | null
    | undefined;
  const isLocal = Boolean(input.is_local && profileLocation?.city && profileLocation?.state);

  const { data, error } = await supabase
    .from("communities")
    .insert({
      slug,
      name,
      description: input.description.trim() || null,
      category: input.category.trim() || "Criada pela galera",
      is_local: isLocal,
      city: isLocal ? profileLocation?.city : null,
      state: isLocal ? profileLocation?.state : null,
      country: isLocal ? profileLocation?.country || "BR" : "BR",
      owner_id: userData.user.id,
      rules: input.rules?.length
        ? input.rules
        : ["Respeite os membros.", "Nada de ataques pessoais.", "Conteúdo ofensivo pode ser removido."],
    })
    .select("id,slug,name,description,cover_url,category,is_official,is_local,city,state,country,owner_id,status,max_rooms,room_capacity,rules,created_at,updated_at")
    .single();

  if (error) throw error;

  await joinCommunity(supabase, data.id, "owner");
  await createDefaultRoomsForCommunity(supabase, data.id, data.room_capacity ?? 200);

  return data as Community;
}

export async function createCommunityContent(
  supabase: SupabaseClient,
  communityId: string,
  input: CreateContentInput,
) {
  return createContent(supabase, {
    ...input,
    community_id: communityId,
  });
}

export async function listCommunityContents(
  supabase: SupabaseClient,
  communityId: string,
  currentUserId?: string | null,
): Promise<FeedContent[]> {
  const { data, error } = await supabase
    .from("contents")
    .select("id,author_id,content_type,text,media_url,media_type,momentum_id,community_id,visibility,comments_enabled,created_at,updated_at")
    .eq("visibility", "public")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const contents = (data ?? []) as CommunityContentRow[];
  if (!contents.length) return [];

  const contentIds = contents.map((content) => content.id);
  const authorIds = [...new Set(contents.map((content) => content.author_id))];
  const [
    profilesResult,
    dahorasResult,
    commentsResult,
    wavesResult,
    presencesResult,
    myDahorasResult,
    myWavesResult,
    mySavedResult,
    equippedAuras,
  ] = await Promise.all([
    supabase.from("profiles").select("user_id,username,display_name,avatar_url").in("user_id", authorIds),
    supabase.from("dahoras").select("content_id").in("content_id", contentIds),
    supabase.from("comments").select("content_id").in("content_id", contentIds),
    supabase.from("waves").select("content_id").in("content_id", contentIds),
    supabase.from("presences").select("content_id").in("content_id", contentIds),
    currentUserId
      ? supabase.from("dahoras").select("content_id").eq("user_id", currentUserId).in("content_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    currentUserId
      ? supabase.from("waves").select("content_id").eq("user_id", currentUserId).in("content_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    currentUserId
      ? supabase.from("saved_contents").select("content_id").eq("user_id", currentUserId).in("content_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    getEquippedAurasByUserIds(supabase, authorIds),
  ]);

  const results = [
    profilesResult,
    dahorasResult,
    commentsResult,
    wavesResult,
    presencesResult,
    myDahorasResult,
    myWavesResult,
    mySavedResult,
  ];

  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      {
        ...profile,
        equipped_aura: equippedAuras.get(profile.user_id) ?? null,
      },
    ]),
  );
  const dahoraCounts = countByContentId((dahorasResult.data ?? []) as CountableRow[]);
  const commentCounts = countByContentId((commentsResult.data ?? []) as CountableRow[]);
  const waveCounts = countByContentId((wavesResult.data ?? []) as CountableRow[]);
  const presenceCounts = countByContentId((presencesResult.data ?? []) as CountableRow[]);
  const myDahoraIds = new Set(((myDahorasResult.data ?? []) as CountableRow[]).map((row) => row.content_id));
  const myWaveIds = new Set(((myWavesResult.data ?? []) as CountableRow[]).map((row) => row.content_id));
  const mySavedIds = new Set(((mySavedResult.data ?? []) as CountableRow[]).map((row) => row.content_id));

  return contents.map((content) => ({
    ...content,
    author: profiles.get(content.author_id) ?? null,
    dahora_count: dahoraCounts[content.id] ?? 0,
    comments_count: commentCounts[content.id] ?? 0,
    wave_count: waveCounts[content.id] ?? 0,
    presence_count: presenceCounts[content.id] ?? 0,
    has_dahora: myDahoraIds.has(content.id),
    has_waved: myWaveIds.has(content.id),
    is_saved: mySavedIds.has(content.id),
  }));
}
