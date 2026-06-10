import type { SupabaseClient } from "@supabase/supabase-js";

import { getEquippedAurasByUserIds } from "./auras.service";
import { getEquippedBadgesByUserIds } from "./badges.service";
import type { ContentAuthor } from "./contents.service";

export type CommentWithAuthor = {
  id: string;
  content_id: string;
  author_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  author: ContentAuthor | null;
};

type CommentRow = {
  id: string;
  content_id: string;
  author_id: string;
  text: string;
  created_at: string;
  updated_at: string;
};

type OfficialAccountRow = {
  user_id: string;
  is_founder: boolean;
  label: string | null;
};

const MAX_COMMENT_LENGTH = 500;

async function getAuthorsByUserId(
  supabase: SupabaseClient,
  userIds: string[],
) {
  if (!userIds.length) {
    return new Map<string, ContentAuthor>();
  }

  const uniqueUserIds = [...new Set(userIds)];
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,avatar_url")
    .in("user_id", uniqueUserIds);

  if (error) {
    throw error;
  }

  const [equippedAuras, equippedBadges, officialAccountsResult] = await Promise.all([
    getEquippedAurasByUserIds(supabase, uniqueUserIds),
    getEquippedBadgesByUserIds(supabase, uniqueUserIds),
    supabase
      .from("official_accounts")
      .select("user_id,is_founder,label")
      .in("user_id", uniqueUserIds),
  ]);

  const officialAccounts = new Map(
    ((officialAccountsResult.error ? [] : officialAccountsResult.data ?? []) as OfficialAccountRow[])
      .map((account) => [account.user_id, account]),
  );

  return new Map(
    ((data ?? []) as ContentAuthor[]).map((profile) => [
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
}

function validateCommentText(value: string) {
  const text = value.trim();

  if (!text) {
    throw new Error("Escreva um comentário antes de enviar.");
  }

  if (text.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Seu comentário pode ter no máximo ${MAX_COMMENT_LENGTH} caracteres.`);
  }

  return text;
}

export async function listCommentsByContentId(
  supabase: SupabaseClient,
  contentId: string,
): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id,content_id,author_id,text,created_at,updated_at")
    .eq("content_id", contentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const comments = (data ?? []) as CommentRow[];
  const authors = await getAuthorsByUserId(
    supabase,
    comments.map((comment) => comment.author_id),
  );

  return comments.map((comment) => ({
    ...comment,
    author: authors.get(comment.author_id) ?? null,
  }));
}

export async function createComment(
  supabase: SupabaseClient,
  contentId: string,
  value: string,
) {
  const text = validateCommentText(value);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Entre na Ocean para comentar.");
  }

  const { error } = await supabase.from("comments").insert({
    content_id: contentId,
    author_id: userData.user.id,
    text,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function deleteComment(
  supabase: SupabaseClient,
  commentId: string,
) {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);

  if (error) {
    throw error;
  }
}

export async function getCommentsCount(
  supabase: SupabaseClient,
  contentId: string,
) {
  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("content_id", contentId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
