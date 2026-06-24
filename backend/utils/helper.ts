import { Context } from "hono";
import { pbkdf2Sync } from "crypto";

const isValidIp = (ip: string): boolean => {
    if (!ip) {
        return false;
    }

    const ipv4Regex =
        /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/;
    const ipv6Regex = /^([a-fA-F0-9:]+)$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

export const getClientIp = (c: Context): string => {
    const xff = c.req.header("x-forwarded-for");
    if (xff) {
        const ip = xff.split(",")[0]?.trim() || "";
        if (isValidIp(ip)) {
            return ip;
        }
    }

    const realIp = c.req.header("x-real-ip");
    if (realIp && isValidIp(realIp)) {
        return realIp.trim();
    }

    const cfIp = c.req.header("cf-connecting-ip");
    if (cfIp && isValidIp(cfIp)) {
        return cfIp.trim();
    }

    return "0.0.0.0";
};

export const enPassword = (username: string, password: string): string => {
    return pbkdf2Sync(password, username, 100000, 32, "sha512").toString("hex");
};

export const randomString = (length = 16): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i += 1) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const getAppName = (): string => {
    return Bun.env.ZEST_APP_NAME?.trim() || "Zest";
};

export const getBearerToken = (c: Context): string => {
    const authorization = c.req.header("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
        return "";
    }
    return authorization.slice(7).trim();
};
