"use server";

import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const SETTINGS_ID = 1;

// Matches Supabase's "branding" bucket cap — checked here too so a bad
// upload fails fast with a clear message instead of Supabase's own error.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// The <input accept="image/..."> and file.type/file.name on the client are
// both attacker-controlled — a request straight to this action can claim
// any type or filename it likes. Sniffing the actual file bytes' magic
// number is what actually proves the upload is one of these image formats,
// and the extension/content-type used for the Supabase upload below comes
// from this detection, never from the client-supplied name or MIME type.
const IMAGE_SIGNATURES: { mime: string; ext: string; check: (b: Uint8Array) => boolean }[] = [
  { mime: "image/png", ext: "png", check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", ext: "jpg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/gif", ext: "gif", check: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  {
    mime: "image/webp",
    ext: "webp",
    check: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

function detectImageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  return IMAGE_SIGNATURES.find((sig) => sig.check(bytes)) ?? null;
}

function optionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function updateSettings(formData: FormData) {
  const bio = optionalString(formData, "bio");
  const instagramUrl = optionalString(formData, "instagramUrl");
  const facebookUrl = optionalString(formData, "facebookUrl");
  const tiktokUrl = optionalString(formData, "tiktokUrl");
  const youtubeUrl = optionalString(formData, "youtubeUrl");
  const spotifyUrl = optionalString(formData, "spotifyUrl");
  const websiteUrl = optionalString(formData, "websiteUrl");
  const contactEmail = optionalString(formData, "contactEmail");
  const brandPrimaryColor = optionalString(formData, "brandPrimaryColor");
  const brandSecondaryColor = optionalString(formData, "brandSecondaryColor");

  const tipAmountsRaw = String(formData.get("defaultTipAmounts") ?? "");
  const defaultTipAmountsCents = tipAmountsRaw
    .split(",")
    .map((s) => Math.round(parseFloat(s.trim()) * 100))
    .filter((n) => Number.isFinite(n) && n > 0);

  await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      bio,
      instagramUrl,
      facebookUrl,
      tiktokUrl,
      youtubeUrl,
      spotifyUrl,
      websiteUrl,
      contactEmail,
      brandPrimaryColor,
      brandSecondaryColor,
      ...(defaultTipAmountsCents.length > 0 ? { defaultTipAmountsCents } : {}),
    },
    create: {
      id: SETTINGS_ID,
      bio,
      instagramUrl,
      facebookUrl,
      tiktokUrl,
      youtubeUrl,
      spotifyUrl,
      websiteUrl,
      contactEmail,
      brandPrimaryColor,
      brandSecondaryColor,
      ...(defaultTipAmountsCents.length > 0 ? { defaultTipAmountsCents } : {}),
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/profile");
  revalidatePath("/request");
}

export async function uploadBrandingImage(formData: FormData) {
  const field = String(formData.get("field") ?? ""); // "photoUrl" | "logoUrl"
  const file = formData.get("file") as File | null;
  if ((field !== "photoUrl" && field !== "logoUrl") || !file) {
    throw new Error("field and file are required");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be 5MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(bytes);
  if (!detected) {
    throw new Error("File isn't a recognized image format (PNG, JPEG, GIF, or WebP).");
  }

  const path = `${field}-${Date.now()}.${detected.ext}`;

  const supabase = getSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, new Blob([bytes], { type: detected.mime }), {
      contentType: detected.mime,
      upsert: false,
    });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data } = supabase.storage.from("branding").getPublicUrl(path);

  await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: { [field]: data.publicUrl },
    create: { id: SETTINGS_ID, [field]: data.publicUrl },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/profile");
}

export async function removeBrandingImage(formData: FormData) {
  const field = String(formData.get("field") ?? ""); // "photoUrl" | "logoUrl"
  if (field !== "photoUrl" && field !== "logoUrl") throw new Error("field is required");

  const settings = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  const currentUrl = settings?.[field];

  if (currentUrl) {
    const path = currentUrl.split("/branding/")[1];
    if (path) {
      const supabase = getSupabaseAdminClient();
      await supabase.storage.from("branding").remove([path]);
    }
  }

  await prisma.settings.update({ where: { id: SETTINGS_ID }, data: { [field]: null } });

  revalidatePath("/dashboard/settings");
  revalidatePath("/profile");
}
