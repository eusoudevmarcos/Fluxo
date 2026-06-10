import type { Post } from "@ocean/shared";
import type { SupabaseClientLike } from "./types";

export type CreatePostInput = {
  authorId: string;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  type?: Post["type"];
};

export async function listPosts(supabase: SupabaseClientLike): Promise<Post[]> {
  void supabase;
  return [];
}

export async function createPost(
  supabase: SupabaseClientLike,
  input: CreatePostInput,
): Promise<Post> {
  void supabase;
  void input;
  throw new Error("createPost is not implemented until real posts are connected.");
}