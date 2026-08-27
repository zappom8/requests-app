import Link from "next/link";

export default function PromoLinks() {
  return (
    <div className="flex gap-2 text-[8px] font-medium uppercase leading-tight text-center text-tip">
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
      <Link href="/profile" className="hover:opacity-80">
        Socials
      </Link>
    </div>
  );
}
