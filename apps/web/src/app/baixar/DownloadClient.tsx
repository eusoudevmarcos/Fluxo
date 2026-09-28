"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { OceanLogo } from "@/components/brand/OceanLogo";
import { readPendingInviteCode } from "@/lib/services/invites.service";
import styles from "./page.module.css";

type DownloadClientProps = {
  androidUrl: string | null;
  iosUrl: string | null;
};

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
  const agent = navigator.userAgent.toLowerCase();
  if (/android/.test(agent)) return "android";
  if (/iphone|ipad|ipod/.test(agent)) return "ios";
  return "other";
}

export function DownloadClient({ androidUrl, iosUrl }: DownloadClientProps) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setPlatform(detectPlatform());
      setInviteCode(readPendingInviteCode());
    });
  }, []);

  const showAndroid = platform !== "ios";
  const showIos = platform !== "android";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <OceanLogo size="md" />
        <span className={styles.badge}>Versão de teste</span>
        <h1>Baixe o app da Fluxo</h1>
        <p className={styles.muted}>
          A Fluxo foi feita para o celular. Instale o app, crie sua conta e comece a cumprir missões,
          convidar amigos e conquistar seus selos de pioneiro.
        </p>

        {inviteCode && (
          <div className={styles.codeBox}>
            <small>Seu código de convite</small>
            <strong>{inviteCode}</strong>
            <small>Digite no final do cadastro no app para já entrar conectado com quem te convidou.</small>
          </div>
        )}

        {showAndroid && (
          <div className={styles.option}>
            <h2>Android</h2>
            {androidUrl ? (
              <>
                <a className={styles.primary} href={androidUrl} rel="noopener">
                  Baixar para Android (APK)
                </a>
                <ol className={styles.steps}>
                  <li>Toque em &quot;Baixar para Android&quot; e confirme o download.</li>
                  <li>Abra o arquivo baixado. Se o celular avisar, toque em &quot;Configurações&quot; e ative &quot;Permitir desta fonte&quot;.</li>
                  <li>Volte e toque em &quot;Instalar&quot;. Pronto: abra a Fluxo e crie sua conta.</li>
                </ol>
                <p className={styles.small}>
                  O aviso de &quot;app desconhecido&quot; aparece porque a versão de teste ainda não está na
                  Play Store. Baixe só por este site.
                </p>
              </>
            ) : (
              <p className={styles.muted}>O link para Android sai em breve.</p>
            )}
          </div>
        )}

        {showIos && (
          <div className={styles.option}>
            <h2>iPhone</h2>
            {iosUrl ? (
              <>
                <a className={styles.primary} href={iosUrl} rel="noopener">
                  Entrar no teste pelo TestFlight
                </a>
                <ol className={styles.steps}>
                  <li>Instale o app TestFlight da Apple, se ainda não tiver.</li>
                  <li>Toque em &quot;Entrar no teste pelo TestFlight&quot; e aceite o convite.</li>
                  <li>Toque em &quot;Instalar&quot; dentro do TestFlight e abra a Fluxo.</li>
                </ol>
              </>
            ) : (
              <p className={styles.muted}>A versão para iPhone sai em breve pelo TestFlight.</p>
            )}
          </div>
        )}

        <p className={styles.small}>
          Ao usar a Fluxo você concorda com os <Link href="/legal/termos">Termos de Uso</Link> e a{" "}
          <Link href="/legal/privacidade">Política de Privacidade</Link>. A Fluxo é para pessoas a
          partir de 14 anos.
        </p>
        <Link className={styles.secondary} href="/auth?mode=login">
          Prefiro usar pelo site
        </Link>
      </section>
    </main>
  );
}
