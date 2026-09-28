import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import { acceptCurrentLegalVersions, getLegalDocumentUrl } from "../lib/services/legal.service";

type LegalAcceptScreenProps = {
  onAccepted: () => void;
  onSignOut: () => Promise<void> | void;
};

const DOCUMENTS = [
  { slug: "termos", label: "Termos de Uso" },
  { slug: "privacidade", label: "Política de Privacidade" },
  { slug: "diretrizes", label: "Diretrizes da Comunidade" },
  { slug: "conteudo-imagem", label: "Termo de Conteúdo, Imagem e Voz" },
] as const;

// Aceite obrigatorio da versao vigente dos documentos (mesmo registro do site). Aparece antes do
// onboarding e de novo quando os documentos mudam de versao.
export function LegalAcceptScreen({ onAccepted, onSignOut }: LegalAcceptScreenProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleAccept() {
    setIsSaving(true);
    setErrorMessage("");
    try {
      await acceptCurrentLegalVersions(createMobileSupabaseClient());
      onAccepted();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível registrar o aceite.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.brand}>fluxo</Text>
      <Text style={styles.title}>Antes de continuar</Text>
      <Text style={styles.muted}>
        A Fluxo está em versão de teste. Leia como funcionam a plataforma, seus dados, as regras de
        convivência e as proteções para adolescentes.
      </Text>

      <View style={styles.card}>
        {DOCUMENTS.map((document) => {
          const url = getLegalDocumentUrl(document.slug);
          return (
            <Pressable
              disabled={!url}
              key={document.slug}
              onPress={() => url && void Linking.openURL(url)}
              style={styles.docRow}
            >
              <Text style={styles.docLabel}>{document.label}</Text>
              <Text style={styles.docOpen}>{url ? "Ler ›" : ""}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => setIsChecked((current) => !current)} style={styles.checkRow}>
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <Text style={styles.checkText}>
          Li e aceito os Termos de Uso, a Política de Privacidade, as Diretrizes da Comunidade e o
          Termo de Conteúdo, Imagem e Voz.
        </Text>
      </Pressable>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <Pressable
        disabled={!isChecked || isSaving}
        onPress={handleAccept}
        style={[styles.primaryButton, (!isChecked || isSaving) && styles.buttonDisabled]}
      >
        {isSaving ? (
          <ActivityIndicator color="#050816" />
        ) : (
          <Text style={styles.primaryButtonText}>Aceitar e continuar</Text>
        )}
      </Pressable>

      <Pressable onPress={() => void onSignOut()} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#030711",
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 60,
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  brand: {
    color: "#ffc400",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  muted: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  docRow: {
    borderBottomColor: "rgba(255,255,255,0.06)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
  },
  docLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  docOpen: {
    color: "#ffc400",
    fontSize: 14,
    fontWeight: "800",
  },
  checkRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  checkbox: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 7,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: "#ffc400",
    borderColor: "#ffc400",
  },
  checkMark: {
    color: "#050816",
    fontSize: 14,
    fontWeight: "900",
  },
  checkText: {
    color: "#ffffff",
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    padding: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 16,
    paddingVertical: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#050816",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "800",
  },
});
