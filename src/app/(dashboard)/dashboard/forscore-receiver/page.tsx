import type { Metadata } from "next";
import { getCurrentPerformer } from "@/lib/auth";
import ReceiverClient from "./ReceiverClient";

export const metadata: Metadata = { title: "forScore Receiver" };

// The iPad side of live score control: a deliberately tiny page that sits in
// Safari behind/beside forScore in Stage Manager and opens scores when the
// controller (iPhone) says so. No dashboard header (see DashboardHeader's
// HIDDEN_ON) — it only needs to stay alive, not be looked at.
export default async function ForScoreReceiverPage() {
  await getCurrentPerformer();
  return <ReceiverClient />;
}
