import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentAuthor } from "./contents.service";
import { getVerifiedSealsByUserIds } from "./seals.service";

export type CommentWithAuthor = {
  id: string;
  content_id: string;
  author_id: string;
  text: string;
  created_at: string;
  author: ContentAuthor | null;
};

type CommentRow = {
  id: string;
  content_id: string;
  author_id: string;
  text: string;
  created_at: string;
};

const MAX_COMMENT_LENGTH = 500;

async function getAuthorsByUserId(supabase: SupabaseClient, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueUserIds.length) return new Map<string, ContentAuthor>();

  const [profilesResult, verifiedSeals] = await Promise.all([
    supabase.from("profiles").select("user_id,username,display_name,avatar_url").in("user_id", uniqueUserIds),
    getVerifiedSealsByUserIds(supabase, uniqueUserIds),
  ]);

  if (profilesResult.error) throw profilesResult.error;

  return new Map(
    ((profilesResult.data ?? []) as ContentAuthor[]).map((profile) => [
      profile.user_id,
      { ...profile, verified_seal: verifiedSeals.get(profile.user_id) ?? null },
    ]),
  );
}

function validateCommentText(value: string) {
  const text = value.trim();

  if (!text) throw new Error("Escreva um comentário antes de enviar.");
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
    .select("id,content_id,author_id,text,created_at")
    .eq("content_id", contentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const comments = (data ?? []) as CommentRow[];
  const authors = await getAuthorsByUserId(supabase, comments.map((comment) => comment.author_id));

  return comments.map((comment) => ({
    ...comment,
    author: authors.get(comment.author_id) ?? null,
  }));
}

export async function createComment(supabase: SupabaseClient, contentId: string, value: string) {
  const text = validateCommentText(value);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para comentar.");

  const { error } = await supabase.from("comments").insert({
    content_id: contentId,
    author_id: userData.user.id,
    text,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
