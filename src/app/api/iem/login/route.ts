import { createHash, timingSafeEqual } from "node:crypto";

// South Pine IEM relay: trades the shared password for the secret Realtime
// channel token. The password is only a door: the unguessable token is what
// actually scopes the channel, and it never appears in the page source or repo
// (both come from Vercel env: IEM_PASSWORD, IEM_CHANNEL_TOKEN).
//
// Touches no database. In-memory throttling only slows guessing on a warm
// serverless instance, so keep IEM_PASSWORD reasonably long.

export const dynamic = "force-dynamic";

const WINDOW_MS = 5 * 60_000;
const MAX_FAILS = 8;
const attempts = new Map<string, { fails: number; resetAt: number }>();

const digest = (value: string) => createHash("sha256").update(value).digest();
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const expected = process.env.IEM_PASSWORD;
  const token = process.env.IEM_CHANNEL_TOKEN;
  if (!expected || !token) return reply({ error: "Not configured" }, 503);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt > now && entry.fails >= MAX_FAILS) return reply({ error: "Too many tries" }, 429);

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password.slice(0, 200);
  } catch {}

  if (timingSafeEqual(digest(password), digest(expected))) {
    attempts.delete(ip);
    return reply({ token });
  }

  attempts.set(ip, {
    fails: (entry && entry.resetAt > now ? entry.fails : 0) + 1,
    resetAt: entry && entry.resetAt > now ? entry.resetAt : now + WINDOW_MS,
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  return reply({ error: "Wrong password" }, 401);
}
