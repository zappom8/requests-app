import Link from "next/link";

export default function PromoLinks() {
  return (
    <div className="flex gap-3 text-[10px] uppercase tracking-wide text-foreground-muted">
      <Link href="/gigs" className="hover:text-foreground">
        Next Gigs
      </Link>
      <Link href="/book" className="hover:text-foreground">
        Book Lochie
      </Link>
      <Link href="/profile" className="hover:text-foreground">
        Socials
      </Link>
    </div>
  );
}
