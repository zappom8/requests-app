import Link from "next/link";
import BookingForm from "./BookingForm";

export default function BookPage() {
  return (
    <div className="min-h-screen w-full px-4 py-6 max-w-md mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Book Lochie</h1>
        <Link href="/gigs" className="text-sm text-accent hover:text-accent-hover">
          Upcoming Gigs
        </Link>
      </div>
      <p className="text-sm text-foreground-muted -mt-2">
        Planning an event and want live music? Send through the details and Lochie will be in touch.
      </p>
      <BookingForm />
    </div>
  );
}
