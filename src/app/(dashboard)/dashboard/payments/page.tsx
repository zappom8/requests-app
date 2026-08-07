import { getPayments } from "@/lib/payments";
import RefundButton from "./RefundButton";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const sp = await searchParams;
  const { items, totals } = await getPayments({ dateFrom: sp.dateFrom, dateTo: sp.dateTo });

  const exportHref = `/api/dashboard/payments/export${
    sp.dateFrom || sp.dateTo
      ? `?${new URLSearchParams({ ...(sp.dateFrom ? { dateFrom: sp.dateFrom } : {}), ...(sp.dateTo ? { dateTo: sp.dateTo } : {}) }).toString()}`
      : ""
  }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Tips &amp; Payments</h1>
        <p className="text-sm text-foreground-muted">{totals.count} tipped requests.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Total tips</p>
          <p className="text-lg font-semibold text-tip">{money(totals.grossCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Stripe fees</p>
          <p className="text-lg font-semibold">{money(totals.feeCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Refunded</p>
          <p className="text-lg font-semibold">{money(totals.refundedCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Net</p>
          <p className="text-lg font-semibold text-success">{money(totals.netCents)}</p>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground-muted">From</label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={sp.dateFrom}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground-muted">To</label>
          <input
            type="date"
            name="dateTo"
            defaultValue={sp.dateTo}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Filter
        </button>
        <a
          href={exportHref}
          className="ml-auto text-sm font-medium text-accent-hover hover:underline"
        >
          Download CSV
        </a>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-foreground-muted">
              <th className="px-4 py-2 font-medium">Song</th>
              <th className="px-4 py-2 font-medium">Requester</th>
              <th className="px-4 py-2 font-medium">Gross</th>
              <th className="px-4 py-2 font-medium">Fee</th>
              <th className="px-4 py-2 font-medium">Net</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">
                  <p className="font-medium">{item.songName}</p>
                  <p className="text-xs text-foreground-muted">{item.artistName}</p>
                </td>
                <td className="px-4 py-2">{item.requesterName}</td>
                <td className="px-4 py-2 text-tip">{money(item.tipAmountCents)}</td>
                <td className="px-4 py-2 text-foreground-muted">{money(item.stripeFeeCents ?? 0)}</td>
                <td className="px-4 py-2">
                  {money(item.tipAmountCents - (item.stripeFeeCents ?? 0) - item.refundedAmountCents)}
                </td>
                <td className="px-4 py-2 text-foreground-muted">{item.paymentStatus}</td>
                <td className="px-4 py-2 text-foreground-muted whitespace-nowrap" suppressHydrationWarning>
                  {item.requestedAt.toLocaleDateString([], { dateStyle: "short" })}
                </td>
                <td className="px-4 py-2 text-right">
                  {item.paymentStatus === "SUCCEEDED" && <RefundButton requestId={item.id} />}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-foreground-muted">
                  No tips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
