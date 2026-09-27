import { signOut } from "@/actions/auth";

// Where getCurrentPerformer() sends a signed-in login that isn't linked to
// any Performer (see src/lib/auth.ts) — e.g. an account created directly in
// Supabase rather than through prisma/performers.ts.
export default function NoAccessPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">No dashboard access</h1>
      <p className="text-sm text-foreground-muted max-w-sm">
        You&apos;re signed in, but this account isn&apos;t set up as a performer yet. Ask Lochie to finish setting
        up your account.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
