import type { SupabaseClient } from "@supabase/supabase-js";

export type PickedMedia = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  type?: "image" | "video" | null;
};

export type UploadedContentMedia = {
  publicUrl: string;
  mediaType: "image" | "video";
};

const CONTENT_MEDIA_BUCKET = "content-media";
const AVATAR_BUCKET = "avatars";
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const VIDEO_MAX_SIZE = 100 * 1024 * 1024;
const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

function sanitizeFileName(fileName: string) {
  const parts = fileName.split(".");
  const extension = parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : "";
  const baseName = parts.join(".") || "media";

  return `${baseName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "media"}${extension}`;
}

function resolveMimeType(asset: PickedMedia) {
  if (asset.mimeType) return asset.mimeType;

  const fromName = asset.fileName ?? asset.uri;
  const extension = fromName.split(".").pop()?.toLowerCase() ?? "";

  return EXTENSION_MIME[extension] ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
}

function getAllowedMediaType(
  mimeType: string,
  fileSize: number | undefined,
): UploadedContentMedia["mediaType"] {
  if (ALLOWED_IMAGE_TYPES.has(mimeType)) {
    if (fileSize && fileSize > IMAGE_MAX_SIZE) {
      throw new Error("A foto pode ter no máximo 10MB.");
    }
    return "image";
  }

  if (ALLOWED_VIDEO_TYPES.has(mimeType)) {
    if (fileSize && fileSize > VIDEO_MAX_SIZE) {
      throw new Error("O vídeo pode ter no máximo 100MB.");
    }
    return "video";
  }

  throw new Error("Escolha uma foto ou vídeo em formato suportado.");
}

export async function uploadContentMedia(
  supabase: SupabaseClient,
  asset: PickedMedia,
): Promise<UploadedContentMedia> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para adicionar mídia.");

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  const mimeType = resolveMimeType(asset);
  const mediaType = getAllowedMediaType(mimeType, arrayBuffer.byteLength);
  const safeFileName = sanitizeFileName(asset.fileName ?? asset.uri.split("/").pop() ?? "media");
  const path = `${userData.user.id}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(CONTENT_MEDIA_BUCKET)
    .upload(path, arrayBuffer, {
      cacheControl: "31536000",
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(CONTENT_MEDIA_BUCKET).getPublicUrl(path);

  return {
    publicUrl: data.publicUrl,
    mediaType,
  };
}

export async function uploadAvatar(supabase: SupabaseClient, asset: PickedMedia): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Entre na Fluxo para adicionar uma foto.");

  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();
  const mimeType = resolveMimeType(asset);

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Escolha uma foto em formato suportado.");
  }

  if (arrayBuffer.byteLength > AVATAR_MAX_SIZE) {
    throw new Error("A foto de perfil pode ter no máximo 5MB.");
  }

  const extension = mimeType.split("/")[1] ?? "jpg";
  const path = `${userData.user.id}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, arrayBuffer, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return `${data.publicUrl}?t=${Date.now()}`;
}
