import { LegalDocumentView } from "@/components/legal/LegalLayout";
import { legalDocuments } from "@/lib/legal/legal-documents";

export default function TermsPage() {
  return <LegalDocumentView document={legalDocuments.termos} />;
}
