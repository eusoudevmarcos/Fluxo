import { LegalDocumentView } from "@/components/legal/LegalLayout";
import { legalDocuments } from "@/lib/legal/legal-documents";

export default function PrivacyPage() {
  return <LegalDocumentView document={legalDocuments.privacidade} />;
}
