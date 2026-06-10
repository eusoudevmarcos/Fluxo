export type SupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function cleanEnvValue(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

function assertHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local.",
    );
  }

  if (!assertHttpUrl(supabaseUrl)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL valida, como https://seu-projeto.supabase.co.",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function getSupabaseConfigError() {
  try {
    getSupabaseConfig();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Configuracao do Supabase invalida.";
  }
}
