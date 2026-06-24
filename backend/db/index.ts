import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import * as schema from "./schema";

const dbFile = Bun.env.ZEST_DB_PATH || "./data/db/zest.db";
const dbDir = dirname(dbFile);

if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
}

const client = createClient({
    url: `file:${dbFile}`,
});

await client.execute("PRAGMA journal_mode = WAL");

export const db = drizzle({ client, schema });
