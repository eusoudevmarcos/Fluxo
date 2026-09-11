import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createMobileSupabaseClient } from "../lib/supabase/client";
import { createContent } from "../lib/services/contents.service";
import { uploadContentMedia, type PickedMedia } from "../lib/services/media.service";

type CreateScreenProps = {
  onCreated: () => void;
};

export function CreateScreen({ onCreated }: CreateScreenProps) {
  const [text, setText] = useState("");
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function assetToPickedMedia(asset: ImagePicker.ImagePickerAsset): PickedMedia {
    return {
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
      type: asset.type === "video" ? "video" : "image",
    };
  }

  async function handlePickFromLibrary() {
    setErrorMessage("");
    setIsPicking(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Permita o acesso às fotos para escolher uma mídia.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setMedia(assetToPickedMedia(result.assets[0]));
      }
    } finally {
      setIsPicking(false);
    }
  }

  async function handleUseCamera() {
    setErrorMessage("");
    setIsPicking(true);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Permita o acesso à câmera para tirar uma foto.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setMedia(assetToPickedMedia(result.assets[0]));
      }
    } finally {
      setIsPicking(false);
    }
  }

  async function handlePost() {
    const trimmedText = text.trim();
    if (!trimmedText && !media) {
      setErrorMessage("Escreva algo ou adicione uma mídia.");
      return;
    }

    setIsPosting(true);
    setErrorMessage("");

    try {
      const supabase = createMobileSupabaseClient();
      let mediaUrl: string | undefined;
      let mediaType: "image" | "video" | undefined;

      if (media) {
        const uploaded = await uploadContentMedia(supabase, media);
        mediaUrl = uploaded.publicUrl;
        mediaType = uploaded.mediaType;
      }

      await createContent(supabase, {
        text: trimmedText,
        media_url: mediaUrl,
        media_type: mediaType,
        content_type: "post",
      });

      setText("");
      setMedia(null);
      onCreated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível publicar.");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.brandSmall}>fluxo</Text>
      <Text style={styles.title}>Criar Flow</Text>

      <TextInput
        multiline
        onChangeText={setText}
        placeholder="O que tá rolando no seu flow?"
        placeholderTextColor="rgba(255,255,255,0.4)"
        style={styles.textInput}
        value={text}
      />

      {media && (
        <View style={styles.mediaPreview}>
          {media.type === "video" ? (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderText}>▶ Vídeo selecionado</Text>
            </View>
          ) : (
            <Image source={{ uri: media.uri }} style={styles.mediaImage} />
          )}
          <Pressable onPress={() => setMedia(null)} style={styles.removeMediaButton}>
            <Text style={styles.removeMediaText}>Remover</Text>
          </Pressable>
        </View>
      )}

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <View style={styles.pickerRow}>
        <Pressable disabled={isPicking} onPress={handlePickFromLibrary} style={styles.pickerButton}>
          <Text style={styles.pickerButtonText}>🖼 Galeria</Text>
        </Pressable>
        <Pressable disabled={isPicking} onPress={handleUseCamera} style={styles.pickerButton}>
          <Text style={styles.pickerButtonText}>📷 Câmera</Text>
        </Pressable>
      </View>

      <Pressable
        disabled={isPosting || (!text.trim() && !media)}
        onPress={handlePost}
        style={[styles.postButton, (isPosting || (!text.trim() && !media)) && styles.postButtonDisabled]}
      >
        {isPosting ? <ActivityIndicator color="#050816" /> : <Text style={styles.postButtonText}>Dropar na Fluxo</Text>}
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
    paddingBottom: 140,
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  brandSmall: {
    color: "#ffc400",
    fontSize: 20,
    fontWeight: "900",
  },
  title: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    borderWidth: 1,
    color: "#ffffff",
    fontSize: 15,
    minHeight: 110,
    padding: 16,
    textAlignVertical: "top",
  },
  mediaPreview: {
    gap: 8,
  },
  mediaImage: {
    borderRadius: 16,
    height: 260,
    width: "100%",
  },
  videoPlaceholder: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    height: 180,
    justifyContent: "center",
  },
  videoPlaceholderText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  removeMediaButton: {
    alignSelf: "flex-start",
  },
  removeMediaText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "700",
  },
  pickerRow: {
    flexDirection: "row",
    gap: 12,
  },
  pickerButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
  pickerButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  postButton: {
    alignItems: "center",
    backgroundColor: "#ffc400",
    borderRadius: 18,
    paddingVertical: 16,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: "#050816",
    fontSize: 16,
    fontWeight: "900",
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.26)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#fecaca",
    padding: 12,
  },
});
