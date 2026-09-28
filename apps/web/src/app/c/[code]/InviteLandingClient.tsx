"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { OceanLogo } from "@/components/brand/OceanLogo";
import {
  getInvitePreview,
  normalizeInviteCode,
  savePendingInviteCode,
  type InvitePreview,
} from "@/lib/services/invites.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type InviteLandingClientProps = {
  code: string;
};

export function InviteLandingClient({ code }: InviteLandingClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const normalizedCode = normalizeInviteCode(code);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [previewResult, userResult] = await Promise.all([
        getInvitePreview(supabase, normalizedCode).catch(() => null),
        supabase.auth.getUser().catch(() => null),
      ]);

      if (!isMounted) return;

      if (previewResult) savePendingInviteCode(previewResult.code);
      setPreview(previewResult);
      setIsLoggedIn(Boolean(userResult?.data.user));
      setIsLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [normalizedCode, supabase]);

  const inviterName = preview?.display_name || preview?.username || "Alguém";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <OceanLogo size="md" />

        {isLoading && <p className={styles.muted}>Abrindo seu convite...</p>}

        {!isLoading && !preview && (
          <>
            <h1>Convite não encontrado</h1>
            <p className={styles.muted}>
              Confira o link com quem te convidou. Você também pode entrar na Fluxo sem convite.
            </p>
            <Link className={styles.primary} href="/auth?mode=signup">
              Criar minha conta
            </Link>
          </>
        )}

        {!isLoading && preview && (
          <>
            <div className={styles.avatar}>
              {preview.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.avatar_url} alt="" />
              ) : (
                <span>{inviterName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <h1>{inviterName} te chamou para a Fluxo</h1>
            {preview.username && <p className={styles.handle}>@{preview.username}</p>}

            {preview.has_slots ? (
              <p className={styles.muted}>
                Entre com o convite e vocês já começam conectados. Quem chega agora faz parte dos
                pioneiros da Fluxo.
              </p>
            ) : (
              <p className={styles.muted}>
                Os convites de {inviterName} acabaram por enquanto, mas você pode entrar na Fluxo
                mesmo assim.
              </p>
            )}

            <div className={styles.codeBox}>
              <small>Código do convite</small>
              <strong>{preview.code}</strong>
            </div>

            {isLoggedIn ? (
              <Link className={styles.primary} href="/onboarding">
                Continuar meu cadastro
              </Link>
            ) : (
              <>
                <Link className={styles.primary} href="/auth?mode=signup">
                  Criar minha conta
                </Link>
                <Link className={styles.secondary} href="/auth?mode=login">
                  Já tenho conta
                </Link>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
