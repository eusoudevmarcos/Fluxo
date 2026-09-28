import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  REPORT_REASONS,
  submitReport,
  type ReportReason,
  type ReportTargetType,
} from "../lib/services/safety.service";

type ReportSheetProps = {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string | null;
  onClose: () => void;
  // Chamado so quando a denuncia foi registrada (nao ao cancelar).
  onReported?: () => void;
};

const TARGET_LABELS: Record<ReportTargetType, string> = {
  content: "este post",
  comment: "este comentário",
  profile: "este perfil",
  message: "esta mensagem",
};

export function ReportSheet({
  visible,
  targetType,
  targetId,
  onClose,
  onReported,
}: ReportSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handleClose() {
    const wasSent = isSent;
    setReason(null);
    setDetails("");
    setIsSent(false);
    setErrorMessage("");
    onClose();
    if (wasSent) onReported?.();
  }

  async function handleSubmit() {
    if (!reason || !targetId) return;
    setIsSending(true);
    setErrorMessage("");

    try {
      await submitReport(createMobileSupabaseClient(), targetType, targetId, reason, details);
      setIsSent(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível denunciar.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={handleClose} transparent visible={visible}>
      <Pressable onPress={handleClose} style={styles.backdrop}>
        <Pressable style={styles.sheet}>
          {isSent ? (
            <View style={styles.sentBox}>
              <Text style={styles.title}>Obrigado por avisar</Text>
              <Text style={styles.muted}>
                Nossa equipe vai revisar. Quem foi denunciado não sabe que foi você. Se quiser parar
                de ver essa pessoa, você também pode bloqueá-la no perfil dela.
              </Text>
              <Pressable onPress={handleClose} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Fechar</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Denunciar {TARGET_LABELS[targetType]}</Text>
              <Text style={styles.muted}>Por que você está denunciando?</Text>

              <View style={styles.reasons}>
                {REPORT_REASONS.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setReason(item.id)}
                    style={[styles.reason, reason === item.id && styles.reasonActive]}
                  >
                    <Text style={[styles.reasonText, reason === item.id && styles.reasonTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                maxLength={500}
                multiline
                onChangeText={setDetails}
                placeholder="Quer contar mais? (opcional)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
                value={details}
              />

              {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

              <Pressable
                disabled={!reason || isSending}
                onPress={handleSubmit}
                style={[styles.primaryButton, !reason && styles.buttonDisabled]}
              >
                {isSending ? (
                  <ActivityIndicator color="#050816" />
                ) : (
                  <Text style={styles.primaryButtonText}>Enviar denúncia</Text>
                )}
              </Pressable>
              <Pressable onPress={handleClose} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.6)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0b1222",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sentBox: {
    gap: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  muted: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
  },
  reasons: {
    gap: 8,
    marginVertical: 14,
  },
  reason: {
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reasonActive: {
    backgroundColor: "rgba(255,196,0,0.14)",
    borderColor: "#ffc400",
  },
  reasonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  reasonTextActive: {
    color: "#ffc400",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 14,
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  error: {
    color: "#fecaca",
    marginTop: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 16,
    marginTop: 14,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#050816",
    fontSize: 15,
    fontWeight: "900",
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "800",
  },
});
