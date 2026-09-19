/**
 * Prints the session-pooler (direct) URL derived from DATABASE_URL.
 *
 * Used by the build script so `prisma db push` can run even when only
 * DATABASE_URL is configured (Vercel): the transaction pooler URL (port 6543,
 * ?pgbouncer=true) is translated into its session-pooler equivalent
 * (port 5432, pgbouncer param removed). When DIRECT_URL is set explicitly it
 * wins — this fallback never overrides real configuration.
 */
const raw = process.env.DATABASE_URL;
if (!raw) process.exit(0); // no DATABASE_URL at all → let Prisma report it itself

try {
  const url = new URL(raw);
  if (url.searchParams.has("pgbouncer")) url.searchParams.delete("pgbouncer");
  if (url.port === "6543") url.port = "5432";
  console.log(url.toString());
} catch {
  process.exit(0); // malformed DATABASE_URL → let Prisma's own error surface
}
