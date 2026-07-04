import { Context } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

// ==================== 用户设置 ====================

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

// ==================== 全局设置 ====================

// 配置默认值映射（后续新增配置项在此添加）
const DEFAULT_SETTINGS: Record<string, Record<string, any>> = {
    // 站点设置
    site_setting: {
        title: "ZNote",
        sub_title: "简洁、易用的笔记系统",
        keywords: "",
        description: "",
        custom_header: "",
    },
    // AI向量模型设置
    ai_embedding_setting: {
        enabled: false,
        provider: "siliconflow",
        model: "BAAI/bge-m3",
        api_key: "",
    },
    // AI对话模型设置
    ai_chat_setting: {
        provider: "siliconflow",
        base_url: "https://api.siliconflow.cn/v1",
        model: "deepseek-ai/DeepSeek-V4-Flash",
        api_key: "",
    },
};

// 公共配置白名单
const PUBLIC_SETTING_KEYS = ["site_setting"];

/**
 * 设置全局配置（管理员）
 * @param key 配置键名
 * @param value 配置值（JSON 对象或字符串）
 */
export const setGlobalSetting = async (c: Context) => {
    const { key, value } = await c.req.json();

    // 校验 key 是否存在
    if (!key || typeof key !== "string") {
        return c.json({
            code: -1000,
            msg: "setting.key.required",
            data: null,
        });
    }

    // 校验 value 是否存在
    if (value === undefined || value === null) {
        return c.json({
            code: -1000,
            msg: "setting.value.required",
            data: null,
        });
    }

    // 将 value 转为 JSON 字符串存储，并验证合法性
    let valueStr: string;
    try {
        if (typeof value === "string") {
            // 字符串类型：尝试验证是否为合法 JSON
            JSON.parse(value);
            valueStr = value;
        } else {
            // 对象类型：序列化为 JSON 字符串
            valueStr = JSON.stringify(value);
        }
    } catch {
        return c.json({
            code: -1000,
            msg: "setting.value.invalid_json",
            data: null,
        });
    }

    // 查询 key 是否已存在
    const existing = await db
        .select()
        .from(schema.globalSettings)
        .where(eq(schema.globalSettings.key, key))
        .get();

    if (existing) {
        // 存在则更新
        await db.update(schema.globalSettings)
            .set({
                value: valueStr,
                updated_at: new Date(),
            })
            .where(eq(schema.globalSettings.key, key))
            .run();
    } else {
        // 不存在则插入
        await db.insert(schema.globalSettings)
            .values({
                key,
                value: valueStr,
            })
            .run();
    }

    return c.json({
        code: 200,
        msg: "success",
        data: null,
    });
};

/**
 * 获取全局配置（管理员）
 * @param key 配置键名
 */
export const getGlobalSetting = async (c: Context) => {
    const key = c.req.query("key");

    // 校验 key 是否存在
    if (!key) {
        return c.json({
            code: -1000,
            msg: "setting.key.required",
            data: null,
        });
    }

    // 获取该 key 的默认值
    const defaults = DEFAULT_SETTINGS[key] || {};

    // 根据 key 查询配置
    const setting = await db
        .select()
        .from(schema.globalSettings)
        .where(eq(schema.globalSettings.key, key))
        .get();

    // 无数据且无默认值定义，返回 404
    if (!setting && Object.keys(defaults).length === 0) {
        return c.json({
            code: 404,
            msg: "setting.not.found",
            data: null,
        });
    }

    // 解析数据库中的值
    let storedValue: Record<string, any> = {};
    if (setting) {
        try {
            storedValue = JSON.parse(setting.value);
        } catch {
            storedValue = {};
        }
    }

    // 合并默认值和已存储的值（已存储的值覆盖默认值）
    const mergedValue = { ...defaults, ...storedValue };

    return c.json({
        code: 200,
        msg: "success",
        data: mergedValue,
    });
};

/**
 * 获取公共配置（公开接口）
 * @param key 配置键名
 */
export const getPublicSettings = async (c: Context) => {
    const key = c.req.query("key");

    // 校验 key 是否存在
    if (!key || typeof key !== "string") {
        return c.json({
            code: -1000,
            msg: "setting.key.required",
            data: null,
        });
    }

    // 检查 key 是否在白名单中
    if (!PUBLIC_SETTING_KEYS.includes(key)) {
        return c.json({
            code: -1000,
            msg: "setting.key.not_allowed",
            data: null,
        });
    }

    // 通过 getSettingValue 获取配置值
    const value = await getSettingValue(key);

    return c.json({
        code: 200,
        msg: "success",
        data: value,
    });
};

/**
 * 内部函数：获取全局配置值（供后端内部调用）
 * @param key 配置键名
 * @returns 配置值的 JSON 对象，如果不存在则返回默认值，无默认值则返回 null
 */
export const getSettingValue = async (key: string): Promise<Record<string, any> | null> => {
    // 获取该 key 的默认值
    const defaults = DEFAULT_SETTINGS[key] || {};

    // 根据 key 查询配置
    const setting = await db
        .select()
        .from(schema.globalSettings)
        .where(eq(schema.globalSettings.key, key))
        .get();

    // 无数据且无默认值定义，返回 null
    if (!setting && Object.keys(defaults).length === 0) {
        return null;
    }

    // 解析数据库中的值
    let storedValue: Record<string, any> = {};
    if (setting) {
        try {
            storedValue = JSON.parse(setting.value);
        } catch {
            storedValue = {};
        }
    }

    // 合并默认值和已存储的值（已存储的值覆盖默认值）
    return { ...defaults, ...storedValue };
};
