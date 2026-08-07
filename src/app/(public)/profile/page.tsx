import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Settings just takes whatever text is typed (e.g. "www.instagram.com/x" with
// no scheme) — without this, that renders as a relative link on our own site.
function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const SOCIAL_LINKS: { key: "instagramUrl" | "facebookUrl" | "tiktokUrl" | "youtubeUrl" | "spotifyUrl" | "websiteUrl"; label: string }[] = [
  { key: "instagramUrl", label: "Instagram" },
  { key: "facebookUrl", label: "Facebook" },
  { key: "tiktokUrl", label: "TikTok" },
  { key: "youtubeUrl", label: "YouTube" },
  { key: "spotifyUrl", label: "Spotify" },
  { key: "websiteUrl", label: "Website" },
];

export default async function ProfilePage() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  const links = SOCIAL_LINKS.filter((link) => settings?.[link.key]);

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-12 gap-6 text-center">
      {settings?.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.photoUrl}
          alt="Profile photo"
          className="h-28 w-28 rounded-full object-cover border border-border"
        />
      ) : (
        <div className="h-28 w-28 rounded-full bg-surface border border-border" />
      )}

      {settings?.bio && <p className="max-w-sm text-foreground-muted">{settings.bio}</p>}

      {links.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 max-w-sm">
          {links.map((link) => (
            <a
              key={link.key}
              href={settings![link.key]!}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-4 py-2 text-sm hover:border-accent hover:text-accent-hover"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}

      {settings?.contactEmail && (
        <a href={`mailto:${settings.contactEmail}`} className="text-sm text-foreground-muted hover:text-foreground">
          {settings.contactEmail}
        </a>
      )}

      {!settings?.bio && links.length === 0 && !settings?.contactEmail && (
        <p className="text-foreground-muted">Profile coming soon.</p>
      )}

      <Link
        href="/queue"
        className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
      >
        View Queue
      </Link>
    </div>
  );
}
