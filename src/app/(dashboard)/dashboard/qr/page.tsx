import QRCode from "qrcode";
import { getRequestUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const url = getRequestUrl();
  const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h1 className="text-xl font-semibold mb-1">QR Code</h1>
        <p className="text-sm text-foreground-muted">
          Always points to <code className="text-foreground">{url}</code> — print it once, it never changes.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6 flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="QR code linking to the request page" className="h-64 w-64" />
        <div className="flex gap-2">
          <a
            href="/api/dashboard/qr/png"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
          >
            Download PNG
          </a>
          <a
            href="/api/dashboard/qr/svg"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent"
          >
            Download SVG
          </a>
        </div>
      </div>
    </div>
  );
}
