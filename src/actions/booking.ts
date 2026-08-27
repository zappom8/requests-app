"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@/generated/prisma/client";

type ActionResult = { success: true } | { success: false; error: string };

function optionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function submitBookingInquiry(formData: FormData): Promise<ActionResult> {
  // Honeypot — a real visitor never sees or fills this field (hidden off-
  // screen on the form), so anything landing here is a bot. Silently accept
  // rather than error, so the bot's automation doesn't learn to adapt.
  if (optionalString(formData, "website")) {
    return { success: true };
  }

  const name = optionalString(formData, "name");
  const email = optionalString(formData, "email");
  const message = optionalString(formData, "message");

  if (!name || !email || !message) {
    return { success: false, error: "Name, email, and message are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  await prisma.bookingInquiry.create({
    data: {
      name,
      email,
      phone: optionalString(formData, "phone"),
      eventDate: optionalString(formData, "eventDate"),
      location: optionalString(formData, "location"),
      message,
    },
  });

  revalidatePath("/dashboard/bookings");
  return { success: true };
}

export async function updateBookingInquiryStatus(id: string, status: InquiryStatus): Promise<ActionResult> {
  await prisma.bookingInquiry.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/bookings");
  return { success: true };
}
