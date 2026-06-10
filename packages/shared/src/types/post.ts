export type PostType = "post" | "flow";

export type Post = {
  id: string;
  author_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  type: PostType;
  momentum_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};