import { Context } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import type { AppRole } from "@/types";

export const verifyApiToken = async (
    token: string,
    c: Context,
    role: AppRole = "user",
) => {
    if (!token || token.length < 32) {
        return false;
    }

    try {
        const session = await db
            .select()
            .from(schema.sessions)
            .where(and(eq(schema.sessions.token, token), eq(schema.sessions.status, "active")))
            .get();

        if (!session) {
            return false;
        }

        if (session.expires_at.getTime() <= Date.now()) {
            await db.update(schema.sessions)
                .set({ status: "expired" })
                .where(eq(schema.sessions.id, session.id))
                .run();
            return false;
        }

        if (role === "admin" && session.role !== "admin") {
            return false;
        }

        const user = await db
            .select({
                id: schema.users.id,
                username: schema.users.username,
            })
            .from(schema.users)
            .where(and(eq(schema.users.id, session.uid), eq(schema.users.status, "active")))
            .get();

        if (!user) {
            return false;
        }

        c.set("uid", user.id);
        c.set("role", session.role);
        c.set("username", user.username);
        c.set("token", token);

        return true;
    } catch {
        return false;
    }
};
