import Link from "next/link";

export default function PromoLinks() {
  return (
    <div className="flex flex-col items-center gap-0.5 text-[8px] uppercase tracking-wide text-tip whitespace-nowrap">
      <Link href="/gigs" className="hover:opacity-80">
        Next Gigs
      </Link>
      <Link href="/book" className="hover:opacity-80">
        Book Lochie
      </Link>
      <Link href="/profile" className="hover:opacity-80">
        Socials
      </Link>
    </div>
  );
}
