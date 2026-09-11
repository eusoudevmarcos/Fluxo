import type { SupabaseClient } from "@supabase/supabase-js";

export type ContentType = "post" | "flow";
export type MediaType = "image" | "video" | "none";

export type ContentAuthor = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type ContentRow = {
  id: string;
  author_id: string;
  content_type: ContentType;
  text: string | null;
  media_url: string | null;
  media_type: MediaType;
  visibility: "public";
  comments_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type FeedContent = ContentRow & {
  author: ContentAuthor | null;
  dahora_count: number;
  comments_count: number;
  wave_count: number;
  has_dahora: boolean;
};

type CountableContentRow = { content_id: string };

export type CreateContentInput = {
  text: string;
  media_url?: string;
  media_type?: MediaType;
  content_type?: ContentType;
};

const MAX_CONTENT_TEXT_LENGTH = 1000;
const CONTENT_COLUMNS =
  "id,author_id,content_type,text,media_url,media_type,visibility,comments_enabled,created_at,updated_at";

function getMediaType(mediaUrl: string): MediaType {
  if (!mediaUrl) return "none";
  return /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl) ? "video" : "image";
}

function countByContentId(rows: CountableContentRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.content_id] = (acc[row.content_id] ?? 0) + 1;
    return acc;
  }, {});
}

export async function listFeedContents(
  supabase: SupabaseClient,
  currentUserId?: string | null,
): Promise<FeedContent[]> {
  const { data: contentsData, error: contentsError } = await supabase
    .from("contents")
    .select(CONTENT_COLUMNS)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);

  if (contentsError) throw contentsError;

  const contents = (contentsData ?? []) as ContentRow[];
  if (!contents.length) return [];

  const contentIds = contents.map((content) => content.id);
  const authorIds = [...new Set(contents.map((content) => content.author_id))];

  const [profilesResult, dahorasResult, commentsResult, wavesResult, myDahorasResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,username,display_name,avatar_url")
        .in("user_id", authorIds),
      supabase.from("dahoras").select("content_id").in("content_id", contentIds),
      supabase.from("comments").select("content_id").in("content_id", contentIds),
      supabase.from("waves").select("content_id").in("content_id", contentIds),
      currentUserId
        ? supabase
            .from("dahoras")
            .select("content_id")
            .eq("user_id", currentUserId)
            .in("content_id", contentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (profilesResult.error) throw profilesResult.error;
  if (dahorasResult.error) throw dahorasResult.error;
  if (commentsResult.error) throw commentsResult.error;
  if (wavesResult.error) throw wavesResult.error;
  if (myDahorasResult.error) throw myDahorasResult.error;

  const profiles = new Map(
    ((profilesResult.data ?? []) as ContentAuthor[]).map((profile) => [profile.user_id, profile]),
  );
  const dahoraCounts = countByContentId((dahorasResult.data ?? []) as CountableContentRow[]);
  const commentsCounts = countByContentId((commentsResult.data ?? []) as CountableContentRow[]);
  const waveCounts = countByContentId((wavesResult.data ?? []) as CountableContentRow[]);
  const myDahoraIds = new Set(
    ((myDahorasResult.data ?? []) as CountableContentRow[]).map((row) => row.content_id),
  );

  return contents.map((content) => ({
    ...content,
    author: profiles.get(content.author_id) ?? null,
    dahora_count: dahoraCounts[content.id] ?? 0,
    comments_count: commentsCounts[content.id] ?? 0,
    wave_count: waveCounts[content.id] ?? 0,
    has_dahora: myDahoraIds.has(content.id),
  }));
}

export async function createContent(
  supabase: SupabaseClient,
  input: CreateContentInput,
): Promise<ContentRow> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para criar.");

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
  };

  const { data, error } = await supabase
    .from("contents")
    .insert(insertPayload)
    .select(CONTENT_COLUMNS)
    .single();

  if (error) throw error;

  return data as ContentRow;
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

  if (contentsError) throw contentsError;

  const contentIds = ((contentsData ?? []) as Array<{ id: string }>).map((content) => content.id);

  if (!contentIds.length) {
    return { contentCount: 0, dahorasReceived: 0 };
  }

  const { count, error: dahorasError } = await supabase
    .from("dahoras")
    .select("id", { count: "exact", head: true })
    .in("content_id", contentIds);

  if (dahorasError) throw dahorasError;

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
    .select(CONTENT_COLUMNS)
    .eq("author_id", authorId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw error;

  return (data ?? []) as ContentRow[];
}
