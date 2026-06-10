import { AuthScreen } from "@/components/auth/AuthScreen";

type AuthPageProps = {
  searchParams?: Promise<{
    mode?: string | string[];
    error?: string | string[];
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const rawMode = Array.isArray(params?.mode) ? params?.mode[0] : params?.mode;
  const initialMode = rawMode === "signup" ? "signup" : "login";
  const rawError = Array.isArray(params?.error) ? params?.error[0] : params?.error;

  return <AuthScreen initialMode={initialMode} initialError={rawError} />;
}