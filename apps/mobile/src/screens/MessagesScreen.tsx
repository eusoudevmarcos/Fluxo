import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "../components/Avatar";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  getConversationMessages,
  getOrCreateDirectConversation,
  listMyConversations,
  markConversationRead,
  sendPrivMessage,
  subscribeToConversation,
  type PrivConversation,
  type PrivMessage,
} from "../lib/services/privs.service";

type MessagesScreenProps = {
  session: Session;
  openConversationWithUserId: string | null;
  onConsumedOpenConversationRequest: () => void;
  onUnreadCountChange: (count: number) => void;
};

export function MessagesScreen({
  session,
  openConversationWithUserId,
  onConsumedOpenConversationRequest,
  onUnreadCountChange,
}: MessagesScreenProps) {
  const [conversations, setConversations] = useState<PrivConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<PrivConversation | null>(null);
  const [messages, setMessages] = useState<PrivMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const channelRef = useRef<RealtimeChannel | null>(null);

  const loadConversations = useCallback(async () => {
    const supabase = createMobileSupabaseClient();
    const list = await listMyConversations(supabase);
    setConversations(list);
    onUnreadCountChange(list.reduce((total, conversation) => total + conversation.unread_count, 0));
    return list;
  }, [onUnreadCountChange]);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingList(true);
    loadConversations()
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar as mensagens.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingList(false);
      });

    return () => {
      isMounted = false;
    };
  }, [loadConversations]);

  const openThread = useCallback(
    async (conversation: PrivConversation) => {
      setActiveConversation(conversation);
      setIsLoadingThread(true);
      setErrorMessage("");

      try {
        const supabase = createMobileSupabaseClient();
        const threadMessages = await getConversationMessages(supabase, conversation.id);
        setMessages(threadMessages);
        await markConversationRead(supabase, conversation.id);
        loadConversations().catch(() => undefined);

        channelRef.current?.unsubscribe();
        channelRef.current = subscribeToConversation(supabase, conversation.id, () => {
          getConversationMessages(supabase, conversation.id)
            .then(setMessages)
            .catch(() => undefined);
          markConversationRead(supabase, conversation.id).catch(() => undefined);
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível abrir a conversa.");
      } finally {
        setIsLoadingThread(false);
      }
    },
    [loadConversations],
  );

  useEffect(() => {
    if (!openConversationWithUserId) return;

    let isCancelled = false;

    (async () => {
      try {
        const supabase = createMobileSupabaseClient();
        const conversationId = await getOrCreateDirectConversation(supabase, openConversationWithUserId);
        if (isCancelled) return;

        const list = await loadConversations();
        const found = list.find((conversation) => conversation.id === conversationId);
        if (found) {
          await openThread(found);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Não foi possível iniciar a conversa.");
        }
      } finally {
        if (!isCancelled) onConsumedOpenConversationRequest();
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [openConversationWithUserId, loadConversations, openThread, onConsumedOpenConversationRequest]);

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  function closeThread() {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setActiveConversation(null);
    setMessages([]);
    loadConversations().catch(() => undefined);
  }

  async function handleSend() {
    const body = messageInput.trim();
    if (!body || !activeConversation) return;

    setIsSending(true);
    setMessageInput("");

    try {
      const supabase = createMobileSupabaseClient();
      await sendPrivMessage(supabase, activeConversation.id, body);
      const threadMessages = await getConversationMessages(supabase, activeConversation.id);
      setMessages(threadMessages);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível enviar.");
      setMessageInput(body);
    } finally {
      setIsSending(false);
    }
  }

  if (activeConversation) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <View style={styles.threadHeader}>
          <Pressable onPress={closeThread} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Avatar avatarUrl={activeConversation.avatar_url} label={activeConversation.title} />
          <Text style={styles.threadTitle}>{activeConversation.title}</Text>
        </View>

        {isLoadingThread ? (
          <ActivityIndicator color="#ffc400" size="large" style={styles.loader} />
        ) : (
          <FlatList
            contentContainerStyle={styles.messagesList}
            data={messages}
            inverted={false}
            keyExtractor={(message) => message.id}
            renderItem={({ item }) => {
              const isMine = item.sender_id === session.user.id;
              return (
                <View style={[styles.messageBubble, isMine ? styles.messageMine : styles.messageTheirs]}>
                  <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{item.body}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            onChangeText={setMessageInput}
            placeholder="Escreva uma mensagem"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.composerInput}
            value={messageInput}
          />
          <Pressable disabled={isSending || !messageInput.trim()} onPress={handleSend} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brandSmall}>fluxo</Text>
        <Text style={styles.headerTitle}>Mensagens</Text>
      </View>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {isLoadingList ? (
        <ActivityIndicator color="#ffc400" size="large" style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={conversations}
          keyExtractor={(conversation) => conversation.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => openThread(item)} style={styles.conversationRow}>
              <Avatar avatarUrl={item.avatar_url} label={item.title} />
              <View style={styles.conversationText}>
                <Text style={styles.conversationTitle}>{item.title}</Text>
                <Text numberOfLines={1} style={styles.conversationPreview}>
                  {item.last_message || "Diga oi 👋"}
                </Text>
              </View>
              {item.unread_count > 0 && (
                <View style={styles.unreadDot}>
                  <Text style={styles.unreadDotText}>{item.unread_count}</Text>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sem conversas ainda</Text>
              <Text style={styles.emptyText}>Abra o perfil de alguém e toque em mensagem.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#030711",
    flex: 1,
  },
  header: {
    gap: 4,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  brandSmall: {
    color: "#ffc400",
    fontSize: 20,
    fontWeight: "900",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
  },
  loader: {
    marginTop: 40,
  },
  list: {
    gap: 4,
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  conversationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  conversationText: {
    flex: 1,
  },
  conversationTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  conversationPreview: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 2,
  },
  unreadDot: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  unreadDotText: {
    color: "#050816",
    fontSize: 11,
    fontWeight: "900",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingTop: 80,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  threadHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  threadTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  messagesList: {
    gap: 8,
    padding: 16,
  },
  messageBubble: {
    borderRadius: 16,
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageMine: {
    alignSelf: "flex-end",
    backgroundColor: "#ffc400",
  },
  messageTheirs: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  messageText: {
    color: "#ffffff",
    fontSize: 15,
  },
  messageTextMine: {
    color: "#050816",
  },
  composer: {
    alignItems: "center",
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 14,
    paddingBottom: 28,
  },
  composerInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    borderWidth: 1,
    color: "#ffffff",
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  sendButtonText: {
    color: "#050816",
    fontSize: 16,
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
  },
});
