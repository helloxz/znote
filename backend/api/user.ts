import { Context } from "hono";
import { join } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getUserSettingValue } from "@/api/setting";
import { checkSystemInitialized } from "@/api/system";
import { vEmail, vPassword, vUsername } from "@/utils/check";
import { enPassword, getBearerToken, getClientIp, randomString } from "@/utils/helper";

const getRequestUserAgent = (c: Context) => {
    const userAgent = c.req.header("user-agent") || "unknown";
    return userAgent.length > 256 ? userAgent.slice(0, 256) : userAgent;
};

const createSession = async (uid: number, role: "admin" | "user", c: Context) => {
    const token = `web-${randomString(28)}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await db.insert(schema.sessions)
        .values({
            uid,
            role,
            token,
            ip: getClientIp(c),
            ua: getRequestUserAgent(c),
            expires_at: expiresAt,
        })
        .run();

    return token;
};

export const initUser = async (c: Context) => {
    if (await checkSystemInitialized()) {
        return c.json({ code: -1000, msg: "already.initialized", data: null });
    }

    let { username, email, password } = await c.req.json();

    username = username?.trim().toLowerCase() || "";
    email = email?.trim().toLowerCase() || "";
    password = password?.trim() || "";

    if (!vUsername(username)) {
        return c.json({ code: -1000, msg: "invalid.username", data: null });
    }
    if (!vEmail(email)) {
        return c.json({ code: -1000, msg: "invalid.email", data: null });
    }
    if (!vPassword(password)) {
        return c.json({ code: -1000, msg: "invalid.password", data: null });
    }

    await db.insert(schema.users)
        .values({
            username,
            email,
            password: enPassword(username, password),
            role: "admin",
            reg_ip: getClientIp(c),
            reg_ua: getRequestUserAgent(c),
        })
        .run();

    return c.json({ code: 200, msg: "init.success", data: null });
};

export const register = async (c: Context) => {
    if ((Bun.env.ZEST_ALLOW_REGISTER || "true") === "false") {
        return c.json({ code: -1000, msg: "register.not.allowed", data: null });
    }

    let { username, email, password } = await c.req.json();
    username = username?.trim().toLowerCase() || "";
    email = email?.trim().toLowerCase() || "";
    password = password?.trim() || "";

    if (!vUsername(username)) {
        return c.json({ code: -1000, msg: "invalid.username", data: null });
    }
    if (!vEmail(email)) {
        return c.json({ code: -1000, msg: "invalid.email", data: null });
    }
    if (!vPassword(password)) {
        return c.json({ code: -1000, msg: "invalid.password", data: null });
    }

    const existingUsername = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .get();
    if (existingUsername) {
        return c.json({ code: -1000, msg: "username.already.exists", data: null });
    }

    const existingEmail = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .get();
    if (existingEmail) {
        return c.json({ code: -1000, msg: "email.already.exists", data: null });
    }

    const [user] = await db.insert(schema.users).values({
        username,
        email,
        password: enPassword(username, password),
        role: "user",
        reg_ip: getClientIp(c),
        reg_ua: getRequestUserAgent(c),
    }).returning({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        role: schema.users.role,
    });

    const token = await createSession(user.id, user.role, c);

    return c.json({
        code: 200,
        msg: "register.success",
        data: {
            ...user,
            token,
            redirect: "/dashboard/home",
        },
    });
};

export const login = async (c: Context) => {
    let { username, password } = await c.req.json();
    username = username?.trim().toLowerCase() || "";
    password = password?.trim() || "";

    if (!password || !vPassword(password)) {
        return c.json({ code: -1000, msg: "invalid.password", data: null });
    }

    let actualUsername = username;
    if (username.includes("@")) {
        if (!vEmail(username)) {
            return c.json({ code: -1000, msg: "invalid.email", data: null });
        }
        const userByEmail = await db
            .select({ username: schema.users.username })
            .from(schema.users)
            .where(eq(schema.users.email, username))
            .get();
        if (!userByEmail) {
            return c.json({ code: -1000, msg: "invalid.username.or.password", data: null });
        }
        actualUsername = userByEmail.username;
    } else if (!vUsername(username)) {
        return c.json({ code: -1000, msg: "invalid.username", data: null });
    }

    const encryptedPassword = enPassword(actualUsername, password);
    const user = await db
        .select({
            id: schema.users.id,
            username: schema.users.username,
            email: schema.users.email,
            role: schema.users.role,
        })
        .from(schema.users)
        .where(
            and(
                eq(schema.users.username, actualUsername),
                eq(schema.users.password, encryptedPassword),
                eq(schema.users.status, "active"),
            ),
        )
        .get();

    if (!user) {
        return c.json({ code: -1000, msg: "invalid.username.or.password", data: null });
    }

    const token = await createSession(user.id, user.role, c);
    const userSettings = await getUserSettingValue(user.id);
    const redirect = userSettings.dashboard_home === "templates" ? "/dashboard/templates" : "/dashboard/home";

    return c.json({
        code: 200,
        msg: "login.success",
        data: {
            ...user,
            token,
            redirect,
        },
    });
};

export const userInfo = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const user = await db
        .select({
            id: schema.users.id,
            username: schema.users.username,
            email: schema.users.email,
            role: schema.users.role,
            avatar: schema.users.avatar,
        })
        .from(schema.users)
        .where(eq(schema.users.id, uid))
        .get();

    if (!user) {
        return c.json({ code: -1000, msg: "user.not.found", data: null });
    }

    return c.json({ code: 200, msg: "success", data: user });
};

export const logout = async (c: Context) => {
    const token = c.get("token") || getBearerToken(c);
    if (token) {
        await db.update(schema.sessions)
            .set({ status: "revoked" })
            .where(and(eq(schema.sessions.token, token), eq(schema.sessions.status, "active")))
            .run();
    }

    return c.json({ code: 200, msg: "success", data: null });
};

export const changePassword = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const username = String(c.get("username"));
    let { old_password, new_password, repeat_password } = await c.req.json();

    old_password = old_password?.trim() || "";
    new_password = new_password?.trim() || "";
    repeat_password = repeat_password?.trim() || "";

    if (!vPassword(old_password) || !vPassword(new_password)) {
        return c.json({ code: -1000, msg: "invalid.password", data: null });
    }

    if (new_password !== repeat_password) {
        return c.json({ code: -1000, msg: "user.password.repeat.not_match", data: null });
    }

    const user = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
            and(
                eq(schema.users.id, uid),
                eq(schema.users.password, enPassword(username, old_password)),
                eq(schema.users.status, "active"),
            ),
        )
        .get();

    if (!user) {
        return c.json({ code: -1000, msg: "user.old_password.invalid", data: null });
    }

    await db.update(schema.users)
        .set({ password: enPassword(username, new_password), updated_at: new Date() })
        .where(eq(schema.users.id, uid))
        .run();

    return c.json({ code: 200, msg: "user.password.update.success", data: null });
};

export const checkLogin = async (c: Context) => {
    return c.json({ code: 200, msg: "success", data: null });
};

export const listUsers = async (c: Context) => {
    const users = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        role: schema.users.role,
        status: schema.users.status,
        created_at: schema.users.created_at,
        reg_ip: schema.users.reg_ip,
    }).from(schema.users).orderBy(desc(schema.users.id)).all();

    return c.json({ code: 200, msg: "success", data: users });
};

export const resetUserPassword = async (c: Context) => {
    const { id } = await c.req.json();
    if (!Number.isInteger(id) || id <= 0) {
        return c.json({ code: -1000, msg: "user.id.invalid", data: null });
    }

    const user = await db
        .select({ id: schema.users.id, username: schema.users.username, role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .get();

    if (!user) {
        return c.json({ code: -1000, msg: "user.not.found", data: null });
    }

    if (user.role !== "user") {
        return c.json({ code: -1000, msg: "user.reset.only_user_allowed", data: null });
    }

    const newPassword = randomString(10);
    await db.update(schema.users)
        .set({ password: enPassword(user.username, newPassword), updated_at: new Date() })
        .where(eq(schema.users.id, user.id))
        .run();

    return c.json({
        code: 200,
        msg: "user.password.reset.success",
        data: { password: newPassword },
    });
};

export const resetAdminPassword = async (c: Context) => {
    const admin = await db
        .select({ id: schema.users.id, username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.role, "admin"))
        .orderBy(schema.users.id)
        .limit(1)
        .get();

    if (!admin) {
        return c.text("管理员账号不存在", 404);
    }

    const resetFilePath = join(process.cwd(), "data", "reset.txt");
    const resetFileExists = await Bun.file(resetFilePath).exists();
    if (!resetFileExists) {
        return c.text("Forbidden", 403);
    }

    const password = randomString(12);
    await db.update(schema.users)
        .set({ password: enPassword(admin.username, password), updated_at: new Date() })
        .where(eq(schema.users.id, admin.id))
        .run();

    return c.text(`管理员新密码: ${password}`);
};
