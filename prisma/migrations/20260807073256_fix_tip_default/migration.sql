-- Corrects the default tip presets to match the locked product decision
-- (no $2 option) — see src/app/(public)/request/page.tsx's matching fallback.
-- (DROP INDEX statements Prisma's diff proposed for the hand-written
-- trigram/partial indexes were removed — see README.md "Database notes".)
ALTER TABLE "Settings" ALTER COLUMN "defaultTipAmountsCents" SET DEFAULT ARRAY[500, 1000, 2000]::INTEGER[];
