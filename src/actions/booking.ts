"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@/generated/prisma/client";
import { sendNotificationEmail } from "@/lib/notify-email";
import { getDefaultPerformer, requirePerformer } from "@/lib/auth";

type ActionResult = { success: true } | { success: false; error: string };

function optionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function inquiryEmail(i: {
  name: string;
  email: string;
  phone: string | null;
  eventDate: string | null;
  location: string | null;
  message: string;
}) {
  return {
    subject: `New booking inquiry from ${i.name}`,
    replyTo: i.email,
    text: [
      `Name: ${i.name}`,
      `Email: ${i.email}`,
      `Phone: ${i.phone ?? "-"}`,
      `Event date: ${i.eventDate ?? "-"}`,
      `Location: ${i.location ?? "-"}`,
      "",
      i.message,
    ].join("\n"),
  };
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

  // Only the default performer has a public /book page so far.
  const performer = await getDefaultPerformer();

  const phone = optionalString(formData, "phone");
  const eventDate = optionalString(formData, "eventDate");
  const location = optionalString(formData, "location");

  await prisma.bookingInquiry.create({
    data: { performerId: performer.id, name, email, phone, eventDate, location, message },
  });

  await sendNotificationEmail(inquiryEmail({ name, email, phone, eventDate, location, message }));

  revalidatePath("/dashboard/bookings");
  return { success: true };
}

export async function updateBookingInquiryStatus(id: string, status: InquiryStatus): Promise<ActionResult> {
  const performer = await requirePerformer();
  await prisma.bookingInquiry.updateMany({ where: { id, performerId: performer.id }, data: { status } });
  revalidatePath("/dashboard/bookings");
  return { success: true };
}

export async function resendBookingInquiryEmail(id: string): Promise<ActionResult> {
  const performer = await requirePerformer();
  const inquiry = await prisma.bookingInquiry.findFirst({ where: { id, performerId: performer.id } });
  if (!inquiry) return { success: false, error: "Inquiry not found." };
  const sent = await sendNotificationEmail(inquiryEmail(inquiry));
  return sent ? { success: true } : { success: false, error: "Couldn't send the email." };
}
