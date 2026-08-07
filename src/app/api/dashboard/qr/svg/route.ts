import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getRequestUrl } from "@/lib/qr";

// Auth enforced by src/proxy.ts (matches /api/dashboard/:path*).
export async function GET() {
  const svg = await QRCode.toString(getRequestUrl(), { type: "svg", margin: 2 });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="request-qr.svg"`,
    },
  });
}
