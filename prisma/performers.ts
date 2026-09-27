// Links Supabase Auth logins to Performers (see the Performer model). Runs
// against whichever database DATABASE_URL points at — local dev by default;
// for production: set -a && source .env.supabase && set +a first. Both use
// the same Supabase Auth project, so the auth user ids are the same in each.
//
//   List performers and which login each is linked to:
//     npx tsx prisma/performers.ts list
//
//   Link an existing login (e.g. Lochie's) to an existing performer:
//     npx tsx prisma/performers.ts link <slug> <email>
//
//   Create a new performer and email them an invite to set a password
//   (lands on /auth/confirm → /dashboard/set-password). If the email
//   already has a login (e.g. invited when creating the same performer in
//   the other database), links that instead of inviting again:
//     npx tsx prisma/performers.ts create <slug> "<Name>" <email>
import "dotenv/config";
import { createClient, type User } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
}

async function list() {
  const performers = await prisma.performer.findMany({ orderBy: { createdAt: "asc" } });
  for (const p of performers) {
    const login = p.authUserId ? (await supabase.auth.admin.getUserById(p.authUserId)).data.user?.email : null;
    console.log(`${p.slug.padEnd(12)} ${p.name.padEnd(16)} ${login ?? "(no login linked)"}`);
  }
}

async function link(slug: string, email: string) {
  const user = await findAuthUserByEmail(email);
  if (!user) throw new Error(`No Supabase login with email ${email}.`);
  const performer = await prisma.performer.update({ where: { slug }, data: { authUserId: user.id } });
  console.log(`Linked ${email} to performer "${performer.slug}".`);
}

async function create(slug: string, name: string, email: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("slug must be lowercase letters, numbers and dashes.");

  let user = await findAuthUserByEmail(email);
  if (!user) {
    const redirectTo = `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/auth/confirm`;
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error) throw error;
    user = data.user;
    console.log(`Invite email sent to ${email}.`);
  } else {
    console.log(`${email} already has a login — linking it, no invite sent.`);
  }

  const performer = await prisma.performer.create({ data: { slug, name, authUserId: user.id } });
  console.log(`Created performer "${performer.slug}" (${performer.name}).`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "list") return list();
  if (command === "link" && args.length === 2) return link(args[0], args[1]);
  if (command === "create" && args.length === 3) return create(args[0], args[1], args[2]);
  console.log("Usage: list | link <slug> <email> | create <slug> \"<Name>\" <email>");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
