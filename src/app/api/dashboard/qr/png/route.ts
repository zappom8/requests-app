import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getRequestUrl } from "@/lib/qr";

// Auth enforced by src/proxy.ts (matches /api/dashboard/:path*).
export async function GET() {
  const buffer = await QRCode.toBuffer(getRequestUrl(), { type: "png", width: 1024, margin: 2 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="request-qr.png"`,
    },
  });
}
