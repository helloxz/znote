import { Context } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

/**
 * 校验节点是否属于当前用户
 */
const checkNodeOwnership = async (nodeId: number, userId: number) => {
    const node = await db
        .select({ id: schema.notebooks.id })
        .from(schema.notebooks)
        .where(and(
            eq(schema.notebooks.id, nodeId),
            eq(schema.notebooks.user_id, userId),
        ))
        .get();
    return !!node;
};

/**
 * 检查是否会产生循环引用
 * 从 newParentId 向上遍历到根节点，如果遇到 nodeId 则说明会循环
 */
const wouldCreateCycle = async (nodeId: number, newParentId: number) => {
    let currentId: number | null = newParentId;
    while (currentId !== null) {
        if (currentId === nodeId) return true;
        const node = await db
            .select({ parent_id: schema.notebooks.parent_id })
            .from(schema.notebooks)
            .where(eq(schema.notebooks.id, currentId))
            .get();
        if (!node) return false;
        currentId = node.parent_id;
    }
    return false;
};

/**
 * 获取用户的笔记本列表（平铺，按 sort_order 排序）
 */
export const listNotebooks = async (c: Context) => {
    const uid = Number(c.get("uid"));

    const notebooks = await db
        .select()
        .from(schema.notebooks)
        .where(eq(schema.notebooks.user_id, uid))
        .orderBy(schema.notebooks.sort_order)
        .all();

    return c.json({
        code: 200,
        msg: "notebook.list.success",
        data: notebooks,
    });
};

/**
 * 获取用户的顶层笔记本（parent_id 为 NULL，按 sort_order 排序）
 */
export const getTopLevelNotebooks = async (c: Context) => {
    const uid = Number(c.get("uid"));

    const notebooks = await db
        .select()
        .from(schema.notebooks)
        .where(and(
            eq(schema.notebooks.user_id, uid),
            isNull(schema.notebooks.parent_id),
        ))
        .orderBy(schema.notebooks.sort_order)
        .all();

    return c.json({
        code: 200,
        msg: "notebook.top.success",
        data: notebooks,
    });
};

/**
 * 创建笔记本/分类
 * parent_id 为空 → 顶层笔记本
 * parent_id 不为空 → 子分类
 */
export const createNotebook = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const payload = await c.req.json();

    const { title, parent_id, description, sort_order } = payload || {};

    // 校验 title 非空
    if (!title || typeof title !== "string" || title.trim().length === 0) {
        return c.json({
            code: -1000,
            msg: "notebook.create.title_required",
            data: null,
        });
    }

    // 若传了 parent_id，校验属于当前用户
    const parentId = parent_id ?? null;
    if (parentId !== null) {
        const exists = await checkNodeOwnership(parentId, uid);
        if (!exists) {
            return c.json({
                code: -1000,
                msg: "notebook.create.parent_not_found",
                data: null,
            });
        }
    }

    const now = new Date();
    const result = await db
        .insert(schema.notebooks)
        .values({
            user_id: uid,
            parent_id: parentId,
            title: title.trim(),
            description: description ?? "",
            sort_order: sort_order ?? 0,
            created_at: now,
            updated_at: now,
        })
        .returning()
        .get();

    return c.json({
        code: 200,
        msg: "notebook.create.success",
        data: result,
    });
};

/**
 * 更新笔记本/分类
 * 支持部分更新：title, description, sort_order, parent_id（移动节点）
 */
export const updateNotebook = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const payload = await c.req.json();

    const { id, title, description, sort_order, parent_id } = payload || {};

    // 校验 id
    if (!id || typeof id !== "number") {
        return c.json({
            code: -1000,
            msg: "notebook.update.id_required",
            data: null,
        });
    }

    // 校验节点属于当前用户
    const node = await db
        .select()
        .from(schema.notebooks)
        .where(and(
            eq(schema.notebooks.id, id),
            eq(schema.notebooks.user_id, uid),
        ))
        .get();

    if (!node) {
        return c.json({
            code: -1000,
            msg: "notebook.update.not_found",
            data: null,
        });
    }

    // 如果要更新 parent_id，校验合法性
    if (parent_id !== undefined) {
        const newParentId = parent_id ?? null;

        // 不能指向自己
        if (newParentId === id) {
            return c.json({
                code: -1000,
                msg: "notebook.update.cannot_self_reference",
                data: null,
            });
        }

        // 校验新 parent 属于当前用户
        if (newParentId !== null) {
            const parentExists = await checkNodeOwnership(newParentId, uid);
            if (!parentExists) {
                return c.json({
                    code: -1000,
                    msg: "notebook.update.parent_not_found",
                    data: null,
                });
            }

            // 检查循环引用：新父节点不能是当前节点的子孙
            const cycle = await wouldCreateCycle(id, newParentId);
            if (cycle) {
                return c.json({
                    code: -1000,
                    msg: "notebook.update.circular_reference",
                    data: null,
                });
            }
        }
    }

    // 构建更新字段（部分更新，只更新传入的字段）
    const updates: Record<string, any> = { updated_at: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (parent_id !== undefined) updates.parent_id = parent_id ?? null;

    const result = await db
        .update(schema.notebooks)
        .set(updates)
        .where(and(
            eq(schema.notebooks.id, id),
            eq(schema.notebooks.user_id, uid),
        ))
        .returning()
        .get();

    return c.json({
        code: 200,
        msg: "notebook.update.success",
        data: result,
    });
};
