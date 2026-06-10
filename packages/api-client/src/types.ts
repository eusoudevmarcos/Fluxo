export type SupabaseUserLike = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseAuthLike = {
  getUser: () => Promise<{ data: { user: SupabaseUserLike | null }; error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
};

export type SupabaseClientLike = {
  auth: SupabaseAuthLike;
  from: (table: string) => unknown;
};