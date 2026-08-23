import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import { oceanMobileTheme } from "../styles/theme";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setMessage("Informe email e senha.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const supabase = createMobileSupabaseClient();
      const { error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            })
          : await supabase.auth.signUp({
              email: normalizedEmail,
              password,
            });

      if (error) throw error;

      if (mode === "signup") {
        setMessage("Conta criada. Confirme o email se o Supabase pedir validacao.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel entrar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>fluxo</Text>
        <Text style={styles.title}>Entre no beta mobile.</Text>
        <Text style={styles.subtitle}>
          Use a mesma conta da Fluxo. Esta tela ja conversa com o Supabase real.
        </Text>

        <View style={styles.form}>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={oceanMobileTheme.muted}
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Senha"
            placeholderTextColor={oceanMobileTheme.muted}
            secureTextEntry
            style={styles.input}
            textContentType="password"
            value={password}
          />
        </View>

        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.actions}>
          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSubmitting) && styles.buttonPressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#020617" />
            ) : (
              <Text style={styles.primaryText}>
                {mode === "login" ? "Entrar" : "Criar conta"}
              </Text>
            )}
          </Pressable>
          <Pressable
            disabled={isSubmitting}
            onPress={() => {
              setMode((currentMode) => (currentMode === "login" ? "signup" : "login"));
              setMessage("");
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>
              {mode === "login" ? "Criar conta" : "Ja tenho conta"}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: oceanMobileTheme.bg,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: oceanMobileTheme.card,
    borderColor: oceanMobileTheme.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    padding: 24,
    width: "100%",
  },
  logo: {
    color: oceanMobileTheme.primary,
    fontSize: 42,
    fontWeight: "900",
  },
  title: {
    color: oceanMobileTheme.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: oceanMobileTheme.muted,
    fontSize: 15,
    lineHeight: 24,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: "rgba(2, 6, 23, 0.62)",
    borderColor: oceanMobileTheme.border,
    borderRadius: 16,
    borderWidth: 1,
    color: oceanMobileTheme.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  message: {
    color: oceanMobileTheme.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: oceanMobileTheme.primary,
    borderRadius: 18,
    padding: 16,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  primaryText: {
    color: "#020617",
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: oceanMobileTheme.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  secondaryText: {
    color: oceanMobileTheme.text,
    fontWeight: "800",
  },
});
