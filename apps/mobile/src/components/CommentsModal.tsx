import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "./Avatar";
import { ReportSheet } from "./ReportSheet";
import { SealBadge } from "./SealBadge";
import { createMobileSupabaseClient } from "../lib/supabase/client";
import {
  createComment,
  listCommentsByContentId,
  type CommentWithAuthor,
} from "../lib/services/comments.service";

type CommentsModalProps = {
  contentId: string | null;
  onClose: () => void;
  onCommentAdded: () => void;
};

function timeAgo(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function CommentsModal({ contentId, onClose, onCommentAdded }: CommentsModalProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);

  useEffect(() => {
    createMobileSupabaseClient()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null))
      .catch(() => undefined);
  }, []);

  const loadComments = useCallback(async (id: string) => {
    const supabase = createMobileSupabaseClient();
    return listCommentsByContentId(supabase, id);
  }, []);

  useEffect(() => {
    if (!contentId) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage("");

    loadComments(contentId)
      .then((result) => {
        if (isMounted) setComments(result);
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar comentários.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [contentId, loadComments]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !contentId) return;

    setIsSending(true);
    setErrorMessage("");

    try {
      const supabase = createMobileSupabaseClient();
      await createComment(supabase, contentId, text);
      setInput("");
      const updated = await loadComments(contentId);
      setComments(updated);
      onCommentAdded();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível comentar.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={contentId !== null}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheet}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Comentários</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

          {isLoading ? (
            <ActivityIndicator color="#ffc400" size="large" style={styles.loader} />
          ) : (
            <FlatList
              contentContainerStyle={styles.list}
              data={comments}
              keyExtractor={(comment) => comment.id}
              renderItem={({ item }) => {
                const authorName = item.author?.display_name || item.author?.username || "Fluxo";
                const canReport = Boolean(currentUserId) && item.author_id !== currentUserId;
                return (
                  <Pressable
                    // Toque longo em comentario de outra pessoa abre a denuncia.
                    delayLongPress={350}
                    onLongPress={canReport ? () => setReportCommentId(item.id) : undefined}
                    style={styles.commentRow}
                  >
                    <Avatar avatarUrl={item.author?.avatar_url} label={authorName} />
                    <View style={styles.commentBody}>
                      <View style={styles.commentAuthorRow}>
                        <Text style={styles.commentAuthor}>{authorName}</Text>
                        <SealBadge seal={item.author?.verified_seal} size={12} />
                        <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
                      </View>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Seja o primeiro a comentar.</Text>
              }
            />
          )}

          <View style={styles.composer}>
            <TextInput
              onChangeText={setInput}
              placeholder="Escreva um comentário"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              value={input}
            />
            <Pressable disabled={isSending || !input.trim()} onPress={handleSend} style={styles.sendButton}>
              <Text style={styles.sendButtonText}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>

      <ReportSheet
        onClose={() => setReportCommentId(null)}
        onReported={() =>
          setComments((previous) => previous.filter((comment) => comment.id !== reportCommentId))
        }
        targetId={reportCommentId}
        targetType="comment"
        visible={Boolean(reportCommentId)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0b1120",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "75%",
  },
  header: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },
  title: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 18,
  },
  loader: {
    marginTop: 40,
  },
  list: {
    gap: 14,
    padding: 18,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentAuthorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  commentAuthor: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  commentTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  commentText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    marginTop: 2,
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    paddingTop: 40,
    textAlign: "center",
  },
  composer: {
    alignItems: "center",
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
  },
  input: {
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
    margin: 14,
    padding: 10,
  },
});
