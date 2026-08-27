import { prisma } from "@/lib/prisma";
import BookingStatusSelect from "./BookingStatusSelect";
import LocalTime from "../../LocalTime";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const inquiries = await prisma.bookingInquiry.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Booking Inquiries</h1>
        <p className="text-sm text-foreground-muted">{inquiries.length} total.</p>
      </div>

      {inquiries.length === 0 ? (
        <p className="text-sm text-foreground-muted">No booking inquiries yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {inquiries.map((inquiry) => (
            <li key={inquiry.id} className="rounded-lg border border-border bg-surface p-4 space-y-2">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium">{inquiry.name}</p>
                  <a href={`mailto:${inquiry.email}`} className="text-sm text-accent hover:text-accent-hover">
                    {inquiry.email}
                  </a>
                  {inquiry.phone && <p className="text-sm text-foreground-muted">{inquiry.phone}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-foreground-muted">
                    <LocalTime iso={inquiry.createdAt.toISOString()} />
                  </span>
                  <BookingStatusSelect id={inquiry.id} status={inquiry.status} />
                </div>
              </div>

              {(inquiry.eventDate || inquiry.location) && (
                <p className="text-sm text-foreground-muted">
                  {[inquiry.eventDate, inquiry.location].filter(Boolean).join(" · ")}
                </p>
              )}

              <p className="text-sm whitespace-pre-wrap">{inquiry.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
