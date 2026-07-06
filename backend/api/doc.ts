import { Context } from "hono";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { vSlug } from "@/utils/check";

/** 文档树节点类型 */
type DocTreeNode = {
    id: number;
    title: string;
    type: "notebook";
    children: DocTreeNode[];
    notes: { id: number; title: string; type: "note"; updated_at: Date }[];
};

/**
 * 收集某个笔记本下所有子孙分类 ID（包含自身）
 */
const collectSubtreeIds = async (rootId: number): Promise<Set<number>> => {
    const ids = new Set<number>([rootId]);
    let current = [rootId];
    while (current.length > 0) {
        const children = await db
            .select({ id: schema.notebooks.id })
            .from(schema.notebooks)
            .where(inArray(schema.notebooks.parent_id, current))
            .all();
        current = [];
        for (const c of children) {
            if (!ids.has(c.id)) {
                ids.add(c.id);
                current.push(c.id);
            }
        }
    }
    return ids;
};

/**
 * 获取所有顶层笔记本（管理员专用，不按用户过滤）
 * LEFT JOIN users 返回用户名，方便管理员区分笔记本归属
 */
export const getAllTopLevelNotebooks = async (c: Context) => {
    const rows = await db
        .select({
            id: schema.notebooks.id,
            title: schema.notebooks.title,
            description: schema.notebooks.description,
            user_id: schema.notebooks.user_id,
            username: schema.users.username,
            sort_order: schema.notebooks.sort_order,
        })
        .from(schema.notebooks)
        .leftJoin(schema.users, eq(schema.notebooks.user_id, schema.users.id))
        .where(isNull(schema.notebooks.parent_id))
        .orderBy(asc(schema.notebooks.sort_order))
        .all();

    return c.json({
        code: 200,
        msg: "doc.notebook.top.success",
        data: rows,
    });
};

/**
 * 获取所有公开文档列表
 * LEFT JOIN notebooks 查出原始笔记本的 title/description，方便后台展示
 * 按 id 倒序排列
 */
export const listDocs = async (c: Context) => {
    const rows = await db
        .select({
            id: schema.docs.id,
            notebook_id: schema.docs.notebook_id,
            slug: schema.docs.slug,
            title: schema.docs.title,
            description: schema.docs.description,
            keywords: schema.docs.keywords,
            status: schema.docs.status,
            created_at: schema.docs.created_at,
            updated_at: schema.docs.updated_at,
            notebook_title: schema.notebooks.title,
            notebook_description: schema.notebooks.description,
        })
        .from(schema.docs)
        .leftJoin(schema.notebooks, eq(schema.docs.notebook_id, schema.notebooks.id))
        .orderBy(desc(schema.docs.id))
        .all();

    return c.json({
        code: 200,
        msg: "doc.list.success",
        data: rows,
    });
};

/**
 * 创建公开文档
 * notebook_id：必须是已存在的顶层笔记本（parent_id IS NULL）
 * slug：仅允许 [a-z0-9-]，全局唯一
 */
export const createDoc = async (c: Context) => {
    const payload = await c.req.json();
    const { notebook_id, slug, title, description, keywords, status } = payload || {};

    // 校验 notebook_id
    if (!notebook_id || typeof notebook_id !== "number") {
        return c.json({ code: -1000, msg: "doc.create.notebook_required", data: null });
    }

    // 校验笔记本必须存在且为顶层笔记本
    const notebook = await db
        .select({ id: schema.notebooks.id, parent_id: schema.notebooks.parent_id })
        .from(schema.notebooks)
        .where(eq(schema.notebooks.id, notebook_id))
        .get();

    if (!notebook) {
        return c.json({ code: -1000, msg: "doc.create.notebook_not_found", data: null });
    }
    if (notebook.parent_id !== null) {
        return c.json({ code: -1000, msg: "doc.create.notebook_not_top_level", data: null });
    }

    // 校验笔记本未被其他文档引用
    const existingDocByNotebook = await db
        .select({ id: schema.docs.id })
        .from(schema.docs)
        .where(eq(schema.docs.notebook_id, notebook_id))
        .get();

    if (existingDocByNotebook) {
        return c.json({ code: -1000, msg: "doc.create.notebook_already_published", data: null });
    }

    // 校验 slug
    if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
        return c.json({ code: -1000, msg: "doc.create.slug_required", data: null });
    }
    const trimmedSlug = slug.trim().toLowerCase();
    if (!vSlug(trimmedSlug)) {
        return c.json({ code: -1000, msg: "doc.create.slug_invalid", data: null });
    }

    // 校验 slug 全局唯一
    const existingDocBySlug = await db
        .select({ id: schema.docs.id })
        .from(schema.docs)
        .where(eq(schema.docs.slug, trimmedSlug))
        .get();

    if (existingDocBySlug) {
        return c.json({ code: -1000, msg: "doc.create.slug_exists", data: null });
    }

    // 校验 status（若传入）
    if (status !== undefined && status !== "active" && status !== "inactive") {
        return c.json({ code: -1000, msg: "doc.create.status_invalid", data: null });
    }

    // 插入文档配置
    const now = new Date();
    const result = await db
        .insert(schema.docs)
        .values({
            notebook_id,
            slug: trimmedSlug,
            title: title ?? "",
            description: description ?? "",
            keywords: keywords ?? "",
            status: status ?? "active",
            created_at: now,
            updated_at: now,
        })
        .returning()
        .get();

    return c.json({
        code: 200,
        msg: "doc.create.success",
        data: result,
    });
};

/**
 * 更新公开文档（部分字段更新）
 * 仅更新传入的字段，slug 和 notebook_id 的查重均排除自身
 */
export const updateDoc = async (c: Context) => {
    const payload = await c.req.json();
    const { id, notebook_id, slug, title, description, keywords, status } = payload || {};

    // 校验 id
    if (!id || typeof id !== "number") {
        return c.json({ code: -1000, msg: "doc.update.id_required", data: null });
    }

    // 查询现有文档记录
    const existingDoc = await db
        .select()
        .from(schema.docs)
        .where(eq(schema.docs.id, id))
        .get();

    if (!existingDoc) {
        return c.json({ code: -1000, msg: "doc.update.not_found", data: null });
    }

    // 校验 notebook_id（若传入）
    if (notebook_id !== undefined) {
        const notebook = await db
            .select({ id: schema.notebooks.id, parent_id: schema.notebooks.parent_id })
            .from(schema.notebooks)
            .where(eq(schema.notebooks.id, notebook_id))
            .get();

        if (!notebook) {
            return c.json({ code: -1000, msg: "doc.update.notebook_not_found", data: null });
        }
        if (notebook.parent_id !== null) {
            return c.json({ code: -1000, msg: "doc.update.notebook_not_top_level", data: null });
        }

        // 查重：新 notebook_id 不能已被其他文档占用（排除自身）
        const conflict = await db
            .select({ id: schema.docs.id })
            .from(schema.docs)
            .where(and(
                eq(schema.docs.notebook_id, notebook_id),
                ne(schema.docs.id, id),
            ))
            .get();

        if (conflict) {
            return c.json({ code: -1000, msg: "doc.update.notebook_already_published", data: null });
        }
    }

    // 校验 slug（若传入）
    let trimmedSlug: string | undefined;
    if (slug !== undefined) {
        if (typeof slug !== "string" || slug.trim().length === 0) {
            return c.json({ code: -1000, msg: "doc.update.slug_required", data: null });
        }
        trimmedSlug = slug.trim().toLowerCase();
        if (!vSlug(trimmedSlug)) {
            return c.json({ code: -1000, msg: "doc.update.slug_invalid", data: null });
        }

        // 查重：新 slug 不能已被其他文档占用（排除自身）
        const conflict = await db
            .select({ id: schema.docs.id })
            .from(schema.docs)
            .where(and(
                eq(schema.docs.slug, trimmedSlug),
                ne(schema.docs.id, id),
            ))
            .get();

        if (conflict) {
            return c.json({ code: -1000, msg: "doc.update.slug_exists", data: null });
        }
    }

    // 校验 status（若传入）
    if (status !== undefined && status !== "active" && status !== "inactive") {
        return c.json({ code: -1000, msg: "doc.update.status_invalid", data: null });
    }

    // 构建部分更新字段
    const updates: Record<string, any> = { updated_at: new Date() };
    if (notebook_id !== undefined) updates.notebook_id = notebook_id;
    if (slug !== undefined) updates.slug = trimmedSlug;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (keywords !== undefined) updates.keywords = keywords;
    if (status !== undefined) updates.status = status;

    const result = await db
        .update(schema.docs)
        .set(updates)
        .where(eq(schema.docs.id, id))
        .returning()
        .get();

    return c.json({
        code: 200,
        msg: "doc.update.success",
        data: result,
    });
};

/**
 * 批量删除公开文档（仅删 docs 记录，不动笔记本和笔记）
 * 传入 ids: number[]，所有 id 均需校验存在，任一不存在即返回错误
 */
export const deleteDoc = async (c: Context) => {
    const payload = await c.req.json();
    const { ids } = payload || {};

    // 校验 ids 非空数组
    if (!Array.isArray(ids) || ids.length === 0) {
        return c.json({ code: -1000, msg: "doc.delete.id_required", data: null });
    }

    // 校验每个 id 类型合法
    for (const id of ids) {
        if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) {
            return c.json({ code: -1000, msg: "doc.delete.id_invalid", data: null });
        }
    }

    // 批量校验所有 id 存在
    const existingIds = await db
        .select({ id: schema.docs.id })
        .from(schema.docs)
        .where(inArray(schema.docs.id, ids))
        .all();

    if (existingIds.length !== ids.length) {
        return c.json({ code: -1000, msg: "doc.delete.not_found", data: null });
    }

    // 批量删除
    await db
        .delete(schema.docs)
        .where(inArray(schema.docs.id, ids))
        .run();

    return c.json({
        code: 200,
        msg: "doc.delete.success",
        data: { deleted_count: ids.length },
    });
};

// ==================== 公开 API ====================

/**
 * 获取所有公开文档列表（访客专用）
 * 仅返回 status=active 的文档，按 id 倒序排列
 */
export const listPublicDocs = async (c: Context) => {
    const rows = await db
        .select({
            id: schema.docs.id,
            notebook_id: schema.docs.notebook_id,
            slug: schema.docs.slug,
            title: schema.docs.title,
            description: schema.docs.description,
            keywords: schema.docs.keywords,
            created_at: schema.docs.created_at,
            updated_at: schema.docs.updated_at,
            notebook_title: schema.notebooks.title,
            notebook_description: schema.notebooks.description,
        })
        .from(schema.docs)
        .leftJoin(schema.notebooks, eq(schema.docs.notebook_id, schema.notebooks.id))
        .where(eq(schema.docs.status, "active"))
        .orderBy(desc(schema.docs.id))
        .all();

    return c.json({
        code: 200,
        msg: "doc.public.list.success",
        data: rows,
    });
};

/**
 * 获取公开文档结构（分类树 + 笔记列表，不含 content）
 * 校验 doc 存在且 status=active，收集子树分类 ID，
 * 构建带 type 标记的树结构供前端渲染左侧导航
 */
export const getPublicDoc = async (c: Context) => {
    const slug = c.req.param("slug") as string;

    // 查找公开文档，校验状态
    const doc = await db
        .select()
        .from(schema.docs)
        .where(eq(schema.docs.slug, slug))
        .get();

    if (!doc || doc.status !== "active") {
        return c.json({ code: -1000, msg: "doc.public.not_found", data: null });
    }

    // 查询根笔记本的标题和描述，作为自定义为空时的兜底
    const rootNotebook = await db
        .select({ title: schema.notebooks.title, description: schema.notebooks.description })
        .from(schema.notebooks)
        .where(eq(schema.notebooks.id, doc.notebook_id))
        .get();

    // 收集子树所有分类 ID
    const notebookIds = await collectSubtreeIds(doc.notebook_id);
    const idList = [...notebookIds];

    // 查询子树内所有分类
    const notebooks = await db
        .select({
            id: schema.notebooks.id,
            parent_id: schema.notebooks.parent_id,
            title: schema.notebooks.title,
            sort_order: schema.notebooks.sort_order,
        })
        .from(schema.notebooks)
        .where(inArray(schema.notebooks.id, idList))
        .orderBy(asc(schema.notebooks.sort_order))
        .all();

    // 查询子树内所有未删除笔记（不含 content）
    const notes = await db
        .select({
            id: schema.notes.id,
            notebook_id: schema.notes.notebook_id,
            title: schema.notes.title,
            is_pinned: schema.notes.is_pinned,
            sort_order: schema.notes.sort_order,
            created_at: schema.notes.created_at,
            updated_at: schema.notes.updated_at,
        })
        .from(schema.notes)
        .where(and(
            inArray(schema.notes.notebook_id, idList),
            eq(schema.notes.is_deleted, 0),
        ))
        .orderBy(desc(schema.notes.is_pinned), asc(schema.notes.sort_order), desc(schema.notes.created_at))
        .all();

    // 构建树结构
    const nodeMap = new Map<number, DocTreeNode>();
    for (const nb of notebooks) {
        nodeMap.set(nb.id, {
            id: nb.id,
            title: nb.title,
            type: "notebook",
            children: [],
            notes: [],
        });
    }

    // 笔记挂载到对应分类
    for (const note of notes) {
        const parent = nodeMap.get(note.notebook_id);
        if (parent) {
            parent.notes.push({ id: note.id, title: note.title, type: "note", updated_at: note.updated_at });
        }
    }

    // 建立分类父子关系：只接受已收集范围内的 parent
    for (const nb of notebooks) {
        const node = nodeMap.get(nb.id)!;
        if (nb.parent_id !== null && nodeMap.has(nb.parent_id)) {
            nodeMap.get(nb.parent_id)!.children.push(node);
        }
    }

    // 根节点是文档本身，不需要展示，返回其下一级子分类作为顶层树
    const rootNode = nodeMap.get(doc.notebook_id);
    const tree = rootNode ? rootNode.children : [];

    return c.json({
        code: 200,
        msg: "doc.public.success",
        data: {
            doc: {
                id: doc.id,
                notebook_id: doc.notebook_id,
                title: doc.title || (rootNotebook?.title || ""),
                description: doc.description || (rootNotebook?.description || ""),
                keywords: doc.keywords,
            },
            tree,
        },
    });
};

/**
 * 获取公开文档下某篇笔记的完整内容
 * 校验 doc 存在且 status=active，笔记未删除，
 * 且笔记所属分类必须在 doc 的子树范围内（防越权）
 */
export const getPublicNote = async (c: Context) => {
    const slug = c.req.param("slug") as string;
    const noteId = Number(c.req.param("noteId"));

    // 校验 noteId
    if (!noteId || isNaN(noteId)) {
        return c.json({ code: -1000, msg: "doc.note.id_required", data: null });
    }

    // 查找公开文档，校验状态
    const doc = await db
        .select()
        .from(schema.docs)
        .where(eq(schema.docs.slug, slug))
        .get();

    if (!doc || doc.status !== "active") {
        return c.json({ code: -1000, msg: "doc.note.not_found", data: null });
    }

    // 查询笔记，校验未删除
    const note = await db
        .select()
        .from(schema.notes)
        .where(and(
            eq(schema.notes.id, noteId),
            eq(schema.notes.is_deleted, 0),
        ))
        .get();

    if (!note) {
        return c.json({ code: -1000, msg: "doc.note.not_found", data: null });
    }

    // 校验笔记所属分类在文档子树内
    const notebookIds = await collectSubtreeIds(doc.notebook_id);
    if (!notebookIds.has(note.notebook_id)) {
        return c.json({ code: -1000, msg: "doc.note.not_found", data: null });
    }

    return c.json({
        code: 200,
        msg: "doc.note.success",
        data: {
            id: note.id,
            title: note.title,
            content: note.content,
            created_at: note.created_at,
            updated_at: note.updated_at,
        },
    });
};
