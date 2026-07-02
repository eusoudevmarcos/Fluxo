"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PrivsPanel } from "@/components/privs/PrivsPanel";
import styles from "./page.module.css";

export default function PrivsPage() {
  const router = useRouter();

  return (
    <AppShell>
      <main className={styles.page}>
        <header className={styles.header}>
          <span>Privs</span>
          <h1>Conversas privadas da Wave</h1>
          <p>
            Inicie conversas, acompanhe grupos e mantenha os contatos da Wave
            em um painel real de mensagens.
          </p>
        </header>

        <div className={styles.panelFrame}>
          <PrivsPanel onClose={() => router.push("/")} />
        </div>
      </main>
    </AppShell>
  );
}
