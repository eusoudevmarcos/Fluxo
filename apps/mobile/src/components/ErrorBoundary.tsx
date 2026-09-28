import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { createMobileSupabaseClient, getMobileSupabaseConfigError } from "../lib/supabase/client";
import { sendFeedback } from "../lib/services/safety.service";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

// Beta: em vez da tela branca, mostra uma tela de recuperacao e envia o erro para app_feedback
// (kind 'crash', migration 055) para o time ver sem precisar de Sentry ainda.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (getMobileSupabaseConfigError()) return;

    void sendFeedback(createMobileSupabaseClient(), "crash", `${error.name}: ${error.message}`, {
      stack: error.stack?.slice(0, 3000) ?? null,
      component_stack: info.componentStack?.slice(0, 3000) ?? null,
    }).catch(() => undefined);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.screen}>
        <Text style={styles.brand}>fluxo</Text>
        <Text style={styles.title}>Ops, algo deu errado.</Text>
        <Text style={styles.message}>
          O erro já foi enviado para o time. Toque abaixo para tentar de novo.
        </Text>
        <Pressable onPress={() => this.setState({ hasError: false })} style={styles.button}>
          <Text style={styles.buttonText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: "#030711",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 28,
  },
  brand: {
    color: "#ffc400",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  message: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#ffc400",
    borderRadius: 16,
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  buttonText: {
    color: "#050816",
    fontSize: 15,
    fontWeight: "900",
  },
});
