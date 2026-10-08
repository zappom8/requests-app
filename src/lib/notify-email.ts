// Sends a plain-text notification email through Resend's HTTP API (no SDK).
// Never throws: a failed email must not lose or block the enquiry itself —
// the inquiry is already saved and shows on the dashboard.
export async function sendNotificationEmail(opts: {
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!apiKey || !to) {
    console.warn("[notify-email] RESEND_API_KEY / NOTIFY_EMAIL_TO not set — skipping email");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.NOTIFY_EMAIL_FROM || "Website <onboarding@resend.dev>",
        to: [to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) console.error("[notify-email] Resend error", res.status, await res.text());
  } catch (e) {
    console.error("[notify-email] failed to send", e);
  }
}
