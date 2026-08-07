"use server";

import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const SETTINGS_ID = 1;

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

  const ext = file.name.split(".").pop() || "png";
  const path = `${field}-${Date.now()}.${ext}`;

  const supabase = getSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage.from("branding").upload(path, file, {
    contentType: file.type,
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
