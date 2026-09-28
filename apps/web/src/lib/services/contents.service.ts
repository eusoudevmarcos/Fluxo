import type { SupabaseClient } from "@supabase/supabase-js";

import { getEquippedAurasByUserIds, type PublicEquippedAura } from "./auras.service";
import { getEquippedBadgesByUserIds, type PublicEquippedBadge } from "./badges.service";

export type ContentType = "post" | "flow";
export type MediaType = "image" | "video" | "none";

export type ContentAuthor = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  equipped_aura?: PublicEquippedAura | null;
  equipped_badge?: PublicEquippedBadge | null;
  is_founder?: boolean;
  official_label?: string | null;
};

export type FeedContent = {
  id: string;
  author_id: string;
  content_type: ContentType;
  text: string | null;
  media_url: string | null;
  media_type: MediaType;
  momentum_id: string | null;
  community_id?: string | null;
  visibility: "public";
  comments_enabled: boolean;
  created_at: string;
  updated_at: string;
  author: ContentAuthor | null;
  dahora_count: number;
  comments_count: number;
  wave_count: number;
  presence_count: number;
  has_dahora: boolean;
  has_waved: boolean;
  is_saved: boolean;
};

type ContentRow = {
  id: string;
  author_id: string;
  content_type: ContentType;
  text: string | null;
  media_url: string | null;
  media_type: MediaType;
  momentum_id: string | null;
  community_id?: string | null;
  visibility: "public";
  comments_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type ProfileRow = ContentAuthor;

type OfficialAccountRow = {
  user_id: string;
  is_founder: boolean;
  label: string | null;
};

type DahoraRow = {
  content_id: string;
  user_id?: string;
};

type CountableContentRow = {
  content_id: string;
};

export type CreateContentInput = {
  text: string;
  media_url?: string;
  media_type?: MediaType;
  content_type?: ContentType;
  community_id?: string;
};

const MAX_CONTENT_TEXT_LENGTH = 1000;

function getMediaType(mediaUrl: string): MediaType {
  if (!mediaUrl) {
    return "none";
  }

  return /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl) ? "video" : "image";
}

function countDahoras(rows: DahoraRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.content_id] = (acc[row.content_id] ?? 0) + 1;
    return acc;
  }, {});
}

function countByContentId(rows: CountableContentRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.content_id] = (acc[row.content_id] ?? 0) + 1;
    return acc;
  }, {});
}

async function getOfficialAccountsByUserId(
  supabase: SupabaseClient,
  userIds: string[],
) {
  if (!userIds.length) {
    return new Map<string, OfficialAccountRow>();
  }

  const { data, error } = await supabase
    .from("official_accounts")
    .select("user_id,is_founder,label")
    .in("user_id", userIds);

  if (error) {
    return new Map<string, OfficialAccountRow>();
  }

  return new Map(
    ((data ?? []) as OfficialAccountRow[]).map((account) => [
      account.user_id,
      account,
    ]),
  );
}

export async function listFeedContents(
  supabase: SupabaseClient,
  currentUserId?: string | null,
): Promise<FeedContent[]> {
  const { data: contentsData, error: contentsError } = await supabase
    .from("contents")
    .select("id,author_id,content_type,text,media_url,media_type,momentum_id,visibility,comments_enabled,created_at,updated_at")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);

  if (contentsError) {
    throw contentsError;
  }

  const contents = (contentsData ?? []) as ContentRow[];

  if (!contents.length) {
    return [];
  }

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
    equippedBadges,
    officialAccounts,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id,username,display_name,avatar_url")
      .in("user_id", authorIds),
    supabase
      .from("dahoras")
      .select("content_id")
      .in("content_id", contentIds),
    supabase
      .from("comments")
      .select("content_id")
      .in("content_id", contentIds),
    supabase
      .from("waves")
      .select("content_id")
      .in("content_id", contentIds),
    supabase
      .from("presences")
      .select("content_id")
      .in("content_id", contentIds),
    currentUserId
      ? supabase
          .from("dahoras")
          .select("content_id")
          .eq("user_id", currentUserId)
          .in("content_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    currentUserId
      ? supabase
          .from("waves")
          .select("content_id")
          .eq("user_id", currentUserId)
          .in("content_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    currentUserId
      ? supabase
          .from("saved_contents")
          .select("content_id")
          .eq("user_id", currentUserId)
          .in("content_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    getEquippedAurasByUserIds(supabase, authorIds),
    getEquippedBadgesByUserIds(supabase, authorIds),
    getOfficialAccountsByUserId(supabase, authorIds),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (dahorasResult.error) {
    throw dahorasResult.error;
  }

  if (commentsResult.error) {
    throw commentsResult.error;
  }

  if (wavesResult.error) {
    throw wavesResult.error;
  }

  if (presencesResult.error) {
    throw presencesResult.error;
  }

  if (myDahorasResult.error) {
    throw myDahorasResult.error;
  }

  if (myWavesResult.error) {
    throw myWavesResult.error;
  }

  if (mySavedResult.error) {
    throw mySavedResult.error;
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      {
        ...profile,
        equipped_aura: equippedAuras.get(profile.user_id) ?? null,
        equipped_badge: equippedBadges.get(profile.user_id) ?? null,
        is_founder: officialAccounts.get(profile.user_id)?.is_founder ?? false,
        official_label: officialAccounts.get(profile.user_id)?.label ?? null,
      },
    ]),
  );
  const dahoraCounts = countDahoras((dahorasResult.data ?? []) as DahoraRow[]);
  const commentsCounts = countByContentId(
    (commentsResult.data ?? []) as CountableContentRow[],
  );
  const waveCounts = countByContentId(
    (wavesResult.data ?? []) as CountableContentRow[],
  );
  const presenceCounts = countByContentId(
    (presencesResult.data ?? []) as CountableContentRow[],
  );
  const myDahoraIds = new Set(
    ((myDahorasResult.data ?? []) as DahoraRow[]).map((row) => row.content_id),
  );
  const myWaveIds = new Set(
    ((myWavesResult.data ?? []) as CountableContentRow[]).map((row) => row.content_id),
  );
  const mySavedIds = new Set(
    ((mySavedResult.data ?? []) as CountableContentRow[]).map((row) => row.content_id),
  );

  return contents.map((content) => ({
    ...content,
    author: profiles.get(content.author_id) ?? null,
    dahora_count: dahoraCounts[content.id] ?? 0,
    comments_count: commentsCounts[content.id] ?? 0,
    wave_count: waveCounts[content.id] ?? 0,
    presence_count: presenceCounts[content.id] ?? 0,
    has_dahora: myDahoraIds.has(content.id),
    has_waved: myWaveIds.has(content.id),
    is_saved: mySavedIds.has(content.id),
  }));
}

export async function createContent(
  supabase: SupabaseClient,
  input: CreateContentInput,
): Promise<ContentRow> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Entre na Fluxo para criar.");
  }

  const text = input.text.trim();
  const mediaUrl = input.media_url?.trim() ?? "";

  if (!text && !mediaUrl) {
    throw new Error("Escreva algo ou adicione uma mídia.");
  }

  if (text.length > MAX_CONTENT_TEXT_LENGTH) {
    throw new Error(`Sua criação pode ter no máximo ${MAX_CONTENT_TEXT_LENGTH} caracteres.`);
  }

  const insertPayload = {
    author_id: userData.user.id,
    content_type: input.content_type ?? "post",
    text: text || null,
    media_url: mediaUrl || null,
    media_type: input.media_type ?? getMediaType(mediaUrl),
    visibility: "public",
    updated_at: new Date().toISOString(),
    ...(input.community_id ? { community_id: input.community_id } : {}),
  };

  const { data, error } = await supabase
    .from("contents")
    .insert(insertPayload)
    .select("id,author_id,content_type,text,media_url,media_type,momentum_id,visibility,comments_enabled,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data as ContentRow;
}

export async function deleteContent(supabase: SupabaseClient, contentId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Entre na Fluxo para apagar essa criação.");
  }

  const { error } = await supabase.from("contents").delete().eq("id", contentId);

  if (error) {
    throw error;
  }
}

export async function setCommentsEnabled(
  supabase: SupabaseClient,
  contentId: string,
  enabled: boolean,
) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Entre na Fluxo para gerenciar comentários.");
  }

  const { data, error } = await supabase
    .from("contents")
    .update({
      comments_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentId)
    .select("id,author_id,content_type,text,media_url,media_type,momentum_id,visibility,comments_enabled,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data as ContentRow;
}

export async function getContentById(
  supabase: SupabaseClient,
  contentId: string,
): Promise<ContentRow | null> {
  const { data, error } = await supabase
    .from("contents")
    .select("id,author_id,content_type,text,media_url,media_type,momentum_id,visibility,comments_enabled,created_at,updated_at")
    .eq("id", contentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ContentRow | null;
}

export type ProfileContentStats = {
  contentCount: number;
  dahorasReceived: number;
};

export async function getProfileContentStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileContentStats> {
  const { data: contentsData, error: contentsError } = await supabase
    .from("contents")
    .select("id")
    .eq("author_id", userId);

  if (contentsError) {
    throw contentsError;
  }

  const contentIds = ((contentsData ?? []) as Array<{ id: string }>).map(
    (content) => content.id,
  );

  if (!contentIds.length) {
    return {
      contentCount: 0,
      dahorasReceived: 0,
    };
  }

  const { count, error: dahorasError } = await supabase
    .from("dahoras")
    .select("id", { count: "exact", head: true })
    .in("content_id", contentIds);

  if (dahorasError) {
    throw dahorasError;
  }

  return {
    contentCount: contentIds.length,
    dahorasReceived: count ?? 0,
  };
}

export async function listContentsByAuthorId(
  supabase: SupabaseClient,
  authorId: string,
): Promise<ContentRow[]> {
  const { data, error } = await supabase
    .from("contents")
    .select("id,author_id,content_type,text,media_url,media_type,momentum_id,visibility,comments_enabled,created_at,updated_at")
    .eq("author_id", authorId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    throw error;
  }

  return (data ?? []) as ContentRow[];
}

export async function listContentsByIds(
  supabase: SupabaseClient,
  contentIds: string[],
): Promise<ContentRow[]> {
  if (!contentIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("contents")
    .select("id,author_id,content_type,text,media_url,media_type,momentum_id,visibility,comments_enabled,created_at,updated_at")
    .eq("visibility", "public")
    .in("id", contentIds);

  if (error) {
    throw error;
  }

  const contentsById = new Map(
    ((data ?? []) as ContentRow[]).map((content) => [content.id, content]),
  );

  return contentIds
    .map((contentId) => contentsById.get(contentId))
    .filter((content): content is ContentRow => Boolean(content));
}

export type ProfileContent = ContentRow;

export type FlowPreview = ContentRow & {
  author: ContentAuthor | null;
};

export async function listActiveFlows(
  supabase: SupabaseClient,
): Promise<FlowPreview[]> {
  const { data: flowsData, error: flowsError } = await supabase
    .from("contents")
    .select("id,author_id,content_type,text,media_url,media_type,momentum_id,visibility,comments_enabled,created_at,updated_at")
    .eq("visibility", "public")
    .eq("content_type", "flow")
    .order("created_at", { ascending: false })
    .limit(18);

  if (flowsError) {
    throw flowsError;
  }

  const flows = (flowsData ?? []) as ContentRow[];

  if (!flows.length) {
    return [];
  }

  const authorIds = [...new Set(flows.map((flow) => flow.author_id))];
  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,avatar_url")
    .in("user_id", authorIds);

  if (profilesError) {
    throw profilesError;
  }

  const [equippedAuras, equippedBadges, officialAccounts] = await Promise.all([
    getEquippedAurasByUserIds(supabase, authorIds),
    getEquippedBadgesByUserIds(supabase, authorIds),
    getOfficialAccountsByUserId(supabase, authorIds),
  ]);

  const profiles = new Map(
    ((profilesData ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      {
        ...profile,
        equipped_aura: equippedAuras.get(profile.user_id) ?? null,
        equipped_badge: equippedBadges.get(profile.user_id) ?? null,
        is_founder: officialAccounts.get(profile.user_id)?.is_founder ?? false,
        official_label: officialAccounts.get(profile.user_id)?.label ?? null,
      },
    ]),
  );

  return flows.map((flow) => ({
    ...flow,
    author: profiles.get(flow.author_id) ?? null,
  }));
}

