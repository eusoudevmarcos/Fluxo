"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { HiLightningBolt, HiShieldCheck, HiSparkles, HiUserGroup } from "react-icons/hi";

import { OceanLogo } from "@/components/brand/OceanLogo";
import { ensureProfile } from "@/lib/profiles/ensure-profile";
import {
  acceptCurrentLegalVersions,
  hasAcceptedCurrentLegalVersions,
} from "@/lib/services/legal.service";
import {
  createClient,
  getSupabaseConfigError,
} from "@/lib/supabase/client";
import styles from "./AuthScreen.module.css";

type AuthMode = "login" | "signup";

type AuthScreenProps = {
  initialMode: AuthMode;
  initialError?: string;
};

function getFriendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("user already registered") ||
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists")
  ) {
    return "Este email já tem uma conta na Ocean. Entre com sua senha ou continue com Google.";
  }

  if (
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid credentials")
  ) {
    return "Email ou senha inválidos.";
  }

  if (
    normalizedMessage.includes("provider is not enabled") ||
    normalizedMessage.includes("provider not enabled")
  ) {
    return "Login com Google ainda não está habilitado no Supabase.";
  }

  return message || "Não foi possível autenticar agora.";
}

function hasExistingEmailIdentity(data: { user: { identities?: unknown[] | null } | null }) {
  return Boolean(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
}

const previewHighlights = [
  { icon: <HiLightningBolt />, title: "Flow", text: "Crie e acompanhe o agora." },
  { icon: <HiSparkles />, title: "Aura", text: "Evolua com missões e recompensas." },
  { icon: <HiUserGroup />, title: "Comunidades", text: "Encontre sua galera na Ocean." },
  { icon: <HiShieldCheck />, title: "Segurança", text: "Termos, privacidade e onboarding." },
];

export function AuthScreen({ initialMode, initialError }: AuthScreenProps) {
  const router = useRouter();
  const configError = useMemo(() => getSupabaseConfigError(), []);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError ?? configError ?? "");

  const isSignup = mode === "signup";

  useEffect(() => {
    if (configError) {
      return;
    }

    let isMounted = true;
    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (isMounted && data.user) {
          if (!(await hasAcceptedCurrentLegalVersions(supabase))) {
            router.replace("/legal/accept");
            return;
          }

          const profile = await ensureProfile();
          router.replace(profile.onboarding_completed && profile.profile_required_completed ? "/perfil" : "/onboarding");
        }
      })
      .catch((profileError: unknown) => {
        if (isMounted) {
          setError(
            profileError instanceof Error
              ? profileError.message
              : "Não foi possível carregar seu perfil.",
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [configError, router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(configError ?? "");
    setMessage("");
    router.push(`/auth?mode=${nextMode}`, { scroll: false });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (isSignup && !displayName.trim()) {
      setError("Informe seu nome para criar a conta.");
      return;
    }

    if (isSignup && !hasAcceptedLegal) {
      setError("Você precisa aceitar os termos para criar sua conta.");
      return;
    }

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Informe seu e-mail.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: displayName.trim(),
              full_name: displayName.trim(),
            },
            emailRedirectTo:
              typeof window === "undefined"
                ? undefined
                : `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (hasExistingEmailIdentity(data)) {
          setError("Este email já tem uma conta na Ocean. Entre com sua senha ou continue com Google.");
          setMode("login");
          router.push("/auth?mode=login", { scroll: false });
          return;
        }

        if (data.user && data.session) {
          const profile = await ensureProfile();
          await acceptCurrentLegalVersions(supabase);
          router.replace(profile.onboarding_completed && profile.profile_required_completed ? "/perfil" : "/onboarding");
          router.refresh();
          return;
        }

        setMessage("Cadastro criado. Verifique seu e-mail para confirmar a conta.");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        if (!(await hasAcceptedCurrentLegalVersions(supabase))) {
          router.replace("/legal/accept");
          router.refresh();
          return;
        }

        const profile = await ensureProfile();
        router.replace(profile.onboarding_completed && profile.profile_required_completed ? "/perfil" : "/onboarding");
        router.refresh();
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setMessage("");
    setIsGoogleLoading(true);

    try {
      const supabase = createClient();
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            typeof window === "undefined"
              ? undefined
              : `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) {
        throw oauthError;
      }

      if (data.url) {
        window.location.assign(data.url);
        return;
      }

      throw new Error("Não foi possível abrir o login com Google.");
    } catch (authError) {
      setError(getFriendlyAuthError(authError));
      setIsGoogleLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.preview} aria-label="Previa do aplicativo Ocean">
        <div className={styles.previewText}>
          <OceanLogo size="lg" />
          <h1>Entre no flow da Ocean.</h1>
          <p>
            Crie Flows, acompanhe Moments, participe de Comunidades e evolua sua Aura
            em uma experiencia social imersiva.
          </p>
        </div>

        <div className={styles.previewFrame}>
          <Image
            src="/auth/ocean-mobile-preview.png"
            alt="Previa mobile da Ocean com telas de flow e perfil"
            width={1536}
            height={1024}
            priority
          />
        </div>

        <div className={styles.previewHighlights}>
          {previewHighlights.map((item) => (
            <article key={item.title}>
              <span>{item.icon}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.authArea} aria-label="Autenticação Ocean">
        <div className={styles.authCard}>
          <div className={styles.cardLogo}>
            <OceanLogo />
          </div>

          <header className={styles.header}>
            <h2>{isSignup ? "Crie sua conta" : "Entrar na Ocean"}</h2>
            <p>{isSignup ? "Entre no flow e viva o agora." : "Volte para o flow."}</p>
          </header>

          <button
            className={styles.googleButton}
            type="button"
            disabled={isGoogleLoading || Boolean(configError)}
            onClick={handleGoogleLogin}
          >
            <FcGoogle />
            {isGoogleLoading ? "Conectando..." : "Continuar com Google"}
          </button>

          <div className={styles.divider}>
            <span>ou</span>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {isSignup && (
              <label>
                Nome
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label>
              Email
              <input
                type="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </label>

            {!isSignup && (
              <button className={styles.forgotButton} type="button">
                Esqueci minha senha
              </button>
            )}

            {isSignup && (
              <label className={styles.legalConsent}>
                <input
                  type="checkbox"
                  checked={hasAcceptedLegal}
                  onChange={(event) => setHasAcceptedLegal(event.target.checked)}
                />
                <span>
                  Li e aceito os{" "}
                  <a href="/legal/termos" target="_blank" rel="noreferrer">
                    Termos de Uso
                  </a>
                  , a{" "}
                  <a href="/legal/privacidade" target="_blank" rel="noreferrer">
                    Política de Privacidade
                  </a>
                  , as{" "}
                  <a href="/legal/diretrizes" target="_blank" rel="noreferrer">
                    Diretrizes da Comunidade
                  </a>{" "}
                  e o{" "}
                  <a href="/legal/conteudo-imagem" target="_blank" rel="noreferrer">
                    Termo de Conteúdo, Imagem e Voz
                  </a>{" "}
                  da Ocean.
                </span>
              </label>
            )}

            <button className={styles.submitButton} type="submit" disabled={isSubmitting || Boolean(configError)}>
              {isSubmitting ? "Enviando..." : isSignup ? "Criar conta" : "Entrar"}
            </button>
          </form>

          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}
        </div>

        <div className={styles.switchPanel}>
          <span>{isSignup ? "Já tem conta?" : "Ainda não tem conta?"}</span>
          <button type="button" onClick={() => switchMode(isSignup ? "login" : "signup")}>
            {isSignup ? "Entrar" : "Criar conta"}
          </button>
        </div>
      </section>
    </main>
  );
}


