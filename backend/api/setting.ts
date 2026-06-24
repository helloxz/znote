import { Context } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

const DEFAULT_USER_SETTINGS = {
    dashboard_home: "overview",
    dashboard_layout: "default",
};

export const getUserSettingValue = async (uid: number) => {
    const row = await db
        .select({ value: schema.userSettings.value })
        .from(schema.userSettings)
        .where(eq(schema.userSettings.uid, uid))
        .get();

    if (!row?.value) {
        return DEFAULT_USER_SETTINGS;
    }

    try {
        return {
            ...DEFAULT_USER_SETTINGS,
            ...JSON.parse(row.value),
        };
    } catch {
        return DEFAULT_USER_SETTINGS;
    }
};

export const getUserSetting = async (c: Context) => {
    const uid = Number(c.get("uid"));
    return c.json({
        code: 200,
        msg: "success",
        data: await getUserSettingValue(uid),
    });
};

export const setUserSetting = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const payload = await c.req.json();
    const value = JSON.stringify({
        ...DEFAULT_USER_SETTINGS,
        ...(payload || {}),
    });

    const existing = await db
        .select({ id: schema.userSettings.id })
        .from(schema.userSettings)
        .where(eq(schema.userSettings.uid, uid))
        .get();

    if (existing) {
        await db.update(schema.userSettings)
            .set({ value, updated_at: new Date() })
            .where(eq(schema.userSettings.uid, uid))
            .run();
    } else {
        await db.insert(schema.userSettings)
            .values({ uid, value })
            .run();
    }

    return c.json({
        code: 200,
        msg: "success",
        data: JSON.parse(value),
    });
};
