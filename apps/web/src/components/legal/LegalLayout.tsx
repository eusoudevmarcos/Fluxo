import Link from "next/link";
import type { ReactNode } from "react";

import { OceanLogo } from "@/components/brand/OceanLogo";
import type { LegalDocument } from "@/lib/legal/legal-documents";
import styles from "./LegalLayout.module.css";

type LegalShellProps = {
  children: ReactNode;
};

type LegalDocumentViewProps = {
  document: LegalDocument;
};

export function LegalShell({ children }: LegalShellProps) {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" aria-label="Voltar para Wave">
          <OceanLogo size="md" />
        </Link>
        <nav>
          <Link href="/legal">Documentos</Link>
          <Link href="/auth?mode=signup">Criar conta</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}

export function LegalDocumentView({ document }: LegalDocumentViewProps) {
  return (
    <LegalShell>
      <article className={styles.document}>
        <div className={styles.hero}>
          <span>Versão {document.version}</span>
          <h1>{document.title}</h1>
          <p>{document.summary}</p>
          <small>
            Atualizado em {document.updatedAt}. Este documento pode ser atualizado, e
            mudancas relevantes poderao exigir novo aceite.
          </small>
        </div>

        <div className={styles.sections}>
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </LegalShell>
  );
}
