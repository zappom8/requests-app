// Tiered thank-you messages shown after a tip payment succeeds. Each tier
// applies from its minimum tip upward until the next tier starts, so a tip
// of exactly a tier's minimum gets that tier's message.
export type TipThanksTier = { minCents: number; message: string };

// Used until Lochie saves his own tiers on the Settings page.
export const DEFAULT_TIP_THANKS_TIERS: TipThanksTier[] = [
  { minCents: 50, message: "Thanks so much! 🙏" },
  { minCents: 1000, message: "ayyy cheers!!! 💰🙏" },
  { minCents: 2000, message: "yo wtf thanks so much 🤑🤑" },
];

// Settings.tipThankYouTiers is JSON; null (never saved) = defaults, while a
// saved empty list means "no messages".
export function parseTipThanksTiers(value: unknown): TipThanksTier[] {
  if (value === null || value === undefined) return DEFAULT_TIP_THANKS_TIERS;
  if (!Array.isArray(value)) return DEFAULT_TIP_THANKS_TIERS;
  return value
    .filter(
      (t): t is TipThanksTier =>
        !!t && typeof t.minCents === "number" && Number.isFinite(t.minCents) && typeof t.message === "string"
    )
    .sort((a, b) => a.minCents - b.minCents);
}

export function pickTipThanks(tiers: TipThanksTier[], tipCents: number): string | null {
  let found: TipThanksTier | null = null;
  for (const t of tiers) if (t.minCents <= tipCents) found = t;
  return found?.message ?? null;
}
