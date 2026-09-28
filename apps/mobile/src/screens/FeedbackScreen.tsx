import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import { sendFeedback } from "../lib/services/safety.service";

type FeedbackScreenProps = {
  onBack: () => void;
};

const KINDS = [
  { id: "bug", label: "🐞 Algo deu errado" },
  { id: "idea", label: "💡 Tenho uma ideia" },
  { id: "other", label: "💬 Outro assunto" },
] as const;

type FeedbackKind = (typeof KINDS)[number]["id"];

export function FeedbackScreen({ onBack }: FeedbackScreenProps) {
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSend() {
    if (!message.trim()) {
      setErrorMessage("Escreva o que aconteceu ou a sua ideia.");
      return;
    }

    setIsSending(true);
    setErrorMessage("");
    try {
      await sendFeedback(createMobileSupabaseClient(), kind, message, { source: "settings" });
      setIsSent(true);
      setMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível enviar.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Enviar feedback</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.muted}>
          Você está na versão de teste da Fluxo. Conte o que deu errado ou o que poderia ser melhor:
          cada mensagem chega direto para o time.
        </Text>

        {isSent ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recebemos, valeu! 🙌</Text>
            <Text style={styles.muted}>Pode mandar quantas vezes quiser.</Text>
            <Pressable onPress={() => setIsSent(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Enviar outro</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.chipRow}>
              {KINDS.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setKind(item.id)}
                  style={[styles.chip, kind === item.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, kind === item.id && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              maxLength={4000}
              multiline
              onChangeText={setMessage}
              placeholder={
                kind === "bug"
                  ? "O que você estava fazendo e o que aconteceu?"
                  : "Conte pra gente"
              }
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={message}
            />

            {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

            <Pressable disabled={isSending} onPress={handleSend} style={styles.primaryButton}>
              {isSending ? (
                <ActivityIndicator color="#050816" />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#030711",
    flex: 1,
  },
  content: {
    gap: 14,
    paddingBottom: 118,
    paddingHorizontal: 20,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
    paddingTop: 56,
  },
  backButton: {
    minWidth: 28,
    padding: 4,
  },
  backText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  muted: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: "#ffc400",
    borderColor: "#ffc400",
  },
  chipText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#050816",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    minHeight: 140,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  error: {
    color: "#fecaca",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#050816",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
