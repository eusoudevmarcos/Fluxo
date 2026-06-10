import { LegalDocumentView } from "@/components/legal/LegalLayout";
import { legalDocuments } from "@/lib/legal/legal-documents";

export default function ContentLicensePage() {
  return <LegalDocumentView document={legalDocuments["conteudo-imagem"]} />;
}
