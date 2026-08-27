import Link from "next/link";

export default function PromoLinks() {
  return (
    <div className="flex gap-2 text-[8px] uppercase tracking-wide text-foreground-muted whitespace-nowrap">
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
