import { Context } from "hono";
import { count } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getAppName } from "@/utils/helper";

export const APP_VERSION = "0.1.0";
export const APP_DATE = "2026051601";

export const getAppInfo = async (c: Context) => {
    const userCount = await db.select({ count: count() }).from(schema.users);

    return c.json({
        code: 200,
        msg: "success",
        data: {
            app_name: getAppName(),
            version: APP_VERSION,
            date: APP_DATE,
            total_user_count: userCount[0]?.count || 0,
        },
    });
};
