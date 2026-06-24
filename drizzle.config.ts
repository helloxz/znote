import type { Config } from "drizzle-kit";

const dbPath = process.env.ZEST_DB_PATH || "./data/db/zest.db";

export default {
    schema: "./backend/db/schema.ts",
    out: "./drizzle",
    dialect: "turso",
    dbCredentials: {
        url: `file:${dbPath}`,
    },
} satisfies Config;
