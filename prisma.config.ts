import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations/schema commands connect directly (not through a pooler).
    // App runtime code uses its own pooled connection — see src/lib/prisma.ts.
    url: env("DIRECT_URL"),
  },
});
