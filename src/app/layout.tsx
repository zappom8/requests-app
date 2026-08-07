import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Request a Song",
  description: "Request a song live — powered by Lochie",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { brandPrimaryColor: true, brandSecondaryColor: true },
  });

  const brandStyle: React.CSSProperties = {
    ...(settings?.brandPrimaryColor
      ? { ["--accent" as string]: settings.brandPrimaryColor, ["--accent-hover" as string]: settings.brandPrimaryColor }
      : {}),
    ...(settings?.brandSecondaryColor ? { ["--tip" as string]: settings.brandSecondaryColor } : {}),
  };

  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={brandStyle}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
