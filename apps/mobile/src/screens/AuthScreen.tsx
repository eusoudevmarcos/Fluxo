import { APP_NAME } from "@ocean/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { oceanMobileTheme } from "../styles/theme";

export function AuthScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.logo}>{APP_NAME.toLowerCase()}</Text>
        <Text style={styles.title}>A Ocean mobile esta chegando.</Text>
        <Text style={styles.subtitle}>
          Uma experiencia social imersiva para Flow, Moments, Wave e Aura.
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryText}>Entrar</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Criar conta</Text>
          </Pressable>
        </View>
      </View>
    </View>
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
    borderRadius: 28,
    borderWidth: 1,
    gap: 18,
    padding: 24,
    width: "100%",
  },
  logo: {
    color: oceanMobileTheme.primary,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -2,
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
  actions: {
    gap: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: oceanMobileTheme.primary,
    borderRadius: 18,
    padding: 16,
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
