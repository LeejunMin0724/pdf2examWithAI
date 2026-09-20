/**
 * Build step: `prisma db push --skip-generate` with robust env handling.
 *
 * Replaces the previous inline shell fallback
 *   DIRECT_URL=${DIRECT_URL:-$(node scripts/direct-url.mjs)} prisma db push
 * which set DIRECT_URL to an EMPTY string when DATABASE_URL was absent,
 * crashing Prisma with "resolved to an empty string" (P1012).
 *
 * Behavior:
 * 1. DIRECT_URL set            → used as-is.
 * 2. Only DATABASE_URL set     → DIRECT_URL derived from it
 *    (transaction pooler :6543 + ?pgbouncer → session pooler :5432).
 * 3. DATABASE_URL absent       → db push is SKIPPED with a warning so the
 *    deployment still succeeds (runtime DB features will 500 until the
 *    env var is added in the Vercel dashboard).
 */
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "[prisma-db-push] DATABASE_URL is not set — skipping schema sync. " +
      "Add DATABASE_URL (and optionally DIRECT_URL) in your hosting env vars.",
  );
  process.exit(0);
}

let directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.searchParams.has("pgbouncer")) url.searchParams.delete("pgbouncer");
    if (url.port === "6543") url.port = "5432";
    directUrl = url.toString();
  } catch {
    console.warn("[prisma-db-push] Could not parse DATABASE_URL — falling back to it as-is.");
    directUrl = databaseUrl;
  }
}

const env = { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl };

const result = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
