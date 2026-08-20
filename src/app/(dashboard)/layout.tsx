import type { Metadata } from "next";
import DashboardHeader from "./DashboardHeader";

export const metadata: Metadata = {
  title: "OPERATOR",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader />
      <main className="flex-1 px-4 py-6 max-w-3xl w-full mx-auto">{children}</main>
    </div>
  );
}
