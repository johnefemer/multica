import { Pool } from "pg";

// Lazy singleton pg pool for marketing-side route handlers.
//
// Next.js dev mode reloads modules on every change; without a global cache
// each reload would leak a new pool. In production each container has one
// process, so this is just a guard for HMR.

const POOL_KEY = Symbol.for("@multica/web/marketing-pg-pool");

interface GlobalWithPool {
  [POOL_KEY]?: Pool;
}

function pool(): Pool {
  const g = globalThis as unknown as GlobalWithPool;
  if (!g[POOL_KEY]) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set; marketing-side DB writes are disabled.",
      );
    }
    g[POOL_KEY] = new Pool({
      connectionString: url,
      // Keep this small — marketing routes are low-traffic and we don't
      // want to compete with the Go backend's pool for connections.
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return g[POOL_KEY]!;
}

// Convenience query helper. Always parameterized — never interpolate.
export async function dbQuery<T extends Record<string, unknown>>(
  text: string,
  values?: ReadonlyArray<unknown>,
): Promise<T[]> {
  const result = await pool().query<T>(text, values as unknown[] | undefined);
  return result.rows;
}
