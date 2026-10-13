-- Tiered "thank you for the tip" messages shown after a successful payment.
-- Additive: one new nullable column (NULL = use the built-in default tiers).
ALTER TABLE "Settings" ADD COLUMN "tipThankYouTiers" JSONB;
