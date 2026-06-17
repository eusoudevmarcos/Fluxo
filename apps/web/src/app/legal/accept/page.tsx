"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { LegalShell } from "@/components/legal/LegalLayout";
import { ensureProfile } from "@/lib/profiles/ensure-profile";
import {
  acceptCurrentLegalVersions,
  hasAcceptedCurrentLegalVersions,
} from "@/lib/services/legal.service";
import { createClient } from "@/lib/supabase/client";
import styles from "@/components/legal/LegalLayout.module.css";

const requiredChecks = [
  {
    id: "terms",
    label: "Li e aceito os Termos de Uso.",
    href: "/legal/termos",
  },
  {
    id: "privacy",
    label: "Li e aceito a Politica de Privacidade.",
    href: "/legal/privacidade",
  },
  {
    id: "community",
    label: "Li e aceito as Diretrizes da Comunidade.",
    href: "/legal/diretrizes",
  },
  {
    id: "content",
    label: "Li e aceito o Termo de Conteudo, Imagem e Voz.",
    href: "/legal/conteudo-imagem",
  },
] as const;

type CheckId = (typeof requiredChecks)[number]["id"];

export default function LegalAcceptPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [checked, setChecked] = useState<Record<CheckId, boolean>>({
    terms: false,
    privacy: false,
    community: false,
    content: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const allChecked = Object.values(checked).every(Boolean);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      supabase.auth
        .getUser()
        .then(async ({ data }) => {
          if (!data.user) {
            router.replace("/auth?mode=login");
            return;
          }

          if (await hasAcceptedCurrentLegalVersions(supabase)) {
            const profile = await ensureProfile();
            router.replace(profile.onboarding_completed && profile.profile_required_completed ? "/perfil" : "/onboarding");
            return;
          }

          setIsLoading(false);
        })
        .catch((loadError: unknown) => {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nao foi possivel preparar o aceite.",
          );
          setIsLoading(false);
        });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!allChecked) {
      setError("Voce precisa aceitar todos os documentos para continuar.");
      return;
    }

    setIsSubmitting(true);

    try {
      await acceptCurrentLegalVersions(supabase);
      const profile = await ensureProfile();
      router.replace(profile.onboarding_completed && profile.profile_required_completed ? "/perfil" : "/onboarding");
      router.refresh();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Nao foi possivel registrar seu aceite agora.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <LegalShell>
      <form className={styles.acceptCard} onSubmit={handleSubmit}>
        <span>Wave Legal</span>
        <h1>Antes de entrar na Wave</h1>
        <p>
          Para proteger voce, a comunidade e a beta, precisamos registrar seu aceite
          das versoes atuais dos documentos legais.
        </p>

        <ul>
          <li>Conteudos, imagem, voz, comentarios e comunidades seguem regras claras.</li>
          <li>Privs e recursos futuros tambem ficam sujeitos a seguranca da Wave.</li>
          <li>Podemos pedir novo aceite quando houver mudancas relevantes.</li>
        </ul>

        {requiredChecks.map((item) => (
          <label className={styles.checkbox} key={item.id}>
            <input
              type="checkbox"
              checked={checked[item.id]}
              onChange={(event) =>
                setChecked((current) => ({ ...current, [item.id]: event.target.checked }))
              }
            />
            <span>
              {item.label} <Link href={item.href}>Abrir documento</Link>
            </span>
          </label>
        ))}

        <button
          className={styles.primaryButton}
          type="submit"
          disabled={isLoading || isSubmitting}
        >
          {isSubmitting ? "Registrando..." : "Aceitar e continuar"}
        </button>

        {isLoading && <p>Carregando...</p>}
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </LegalShell>
  );
}

