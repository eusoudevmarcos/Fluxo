import Link from "next/link";

import { LegalShell } from "@/components/legal/LegalLayout";
import { legalDocumentList } from "@/lib/legal/legal-documents";
import styles from "@/components/legal/LegalLayout.module.css";

export default function LegalIndexPage() {
  return (
    <LegalShell>
      <section className={styles.index}>
        <div className={styles.hero}>
          <span>Ocean Legal</span>
          <h1>Documentos legais da Ocean</h1>
          <p>
            Antes de criar conta ou continuar usando a beta, leia os documentos que
            protegem voce, a comunidade e a plataforma.
          </p>
        </div>

        <div className={styles.cardGrid}>
          {legalDocumentList.map((document) => (
            <Link key={document.slug} href={`/legal/${document.slug}`}>
              <strong>{document.title}</strong>
              <span>{document.summary}</span>
              <span>Versao {document.version}</span>
            </Link>
          ))}
        </div>
      </section>
    </LegalShell>
  );
}
