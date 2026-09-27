import type { Metadata } from "next";
import DashboardHeader from "./DashboardHeader";
import { getSignedInPerformer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "OPERATOR",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const performer = await getSignedInPerformer();
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader performerName={performer?.name ?? null} />
      <main className="flex-1 px-4 py-6 max-w-3xl w-full mx-auto">{children}</main>
    </div>
  );
}
