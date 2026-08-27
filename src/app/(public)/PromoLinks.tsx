import Link from "next/link";

export default function PromoLinks() {
  return (
    <div className="flex gap-3 text-[9px] font-semibold uppercase leading-snug text-center text-foreground">
      <Link href="/gigs" className="hover:opacity-80">
        Next
        <br />
        Gigs
      </Link>
      <Link href="/book" className="hover:opacity-80">
        Book
        <br />
        Lochie
      </Link>
    </div>
  );
}
