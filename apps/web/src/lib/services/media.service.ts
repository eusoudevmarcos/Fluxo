import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadedContentMedia = {
  publicUrl: string;
  mediaType: "image" | "video";
};

const CONTENT_MEDIA_BUCKET = "content-media";
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const VIDEO_MAX_SIZE = 100 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function sanitizeFileName(fileName: string) {
  const parts = fileName.split(".");
  const extension = parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : "";
  const baseName = parts.join(".") || "media";

  return `${baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "media"}${extension}`;
}

function getAllowedMediaType(file: File): UploadedContentMedia["mediaType"] {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    if (file.size > IMAGE_MAX_SIZE) {
      throw new Error("A foto pode ter no máximo 10MB.");
    }

    return "image";
  }

  if (ALLOWED_VIDEO_TYPES.has(file.type)) {
    if (file.size > VIDEO_MAX_SIZE) {
      throw new Error("O vídeo pode ter no máximo 100MB.");
    }

    return "video";
  }

  throw new Error("Escolha uma foto ou vídeo em formato suportado.");
}

export async function uploadContentMedia(
  supabase: SupabaseClient,
  file: File,
): Promise<UploadedContentMedia> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("Entre na Fluxo para adicionar mídia.");
  }

  const mediaType = getAllowedMediaType(file);
  const safeFileName = sanitizeFileName(file.name);
  const path = `${userData.user.id}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(CONTENT_MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(CONTENT_MEDIA_BUCKET).getPublicUrl(path);

  return {
    publicUrl: data.publicUrl,
    mediaType,
  };
}
