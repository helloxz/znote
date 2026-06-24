import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
    avatar: text("avatar").default("").notNull(),
    reg_ip: text("reg_ip").notNull(),
    reg_ua: text("reg_ua").notNull(),
    status: text("status", { enum: ["active", "inactive", "banned"] }).default("active").notNull(),
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const sessions = sqliteTable("sessions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: integer("uid").notNull(),
    role: text("role", { enum: ["user", "admin"] }).notNull(),
    token: text("token").notNull().unique(),
    ip: text("ip").notNull(),
    ua: text("ua").notNull(),
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    last_active_at: integer("last_active_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["active", "expired", "revoked"] }).default("active").notNull(),
});

export const userSettings = sqliteTable("user_settings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: integer("uid").notNull().unique(),
    value: text("value").default("{}").notNull(),
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
