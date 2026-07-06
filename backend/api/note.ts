import { Context } from "hono";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { checkNotebookOwnership, checkNoteOwnership } from "@/utils/ownership";
import { FILES_BASE_PATH } from "@/utils/file";

/**
 * 获取指定分类下的笔记列表
 * notebook_id 必传，只查未删除的笔记
 * 排序规则：置顶在前(is_pinned DESC) → sort_order 升序 → 创建时间降序
 */
export const listNotes = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const notebookId = Number(c.req.query("notebook_id"));

    // 校验 notebook_id
    if (!notebookId || isNaN(notebookId)) {
        return c.json({
            code: -1000,
            msg: "note.list.notebook_required",
            data: null,
        });
    }

    // 校验笔记本属于当前用户
    const notebookExists = await checkNotebookOwnership(notebookId, uid);
    if (!notebookExists) {
        return c.json({
            code: -1000,
            msg: "note.list.notebook_not_found",
            data: null,
        });
    }

    const notes = await db
        .select()
        .from(schema.notes)
        .where(and(
            eq(schema.notes.user_id, uid),
            eq(schema.notes.notebook_id, notebookId),
            eq(schema.notes.is_deleted, 0),
        ))
        .orderBy(
            desc(schema.notes.is_pinned),
            asc(schema.notes.sort_order),
            desc(schema.notes.created_at),
        )
        .all();

    return c.json({
        code: 200,
        msg: "note.list.success",
        data: notes,
    });
};

/**
 * 创建笔记
 * notebook_id、title 必传；content、is_pinned、sort_order 可选
 */
export const createNote = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const payload = await c.req.json();

    const { notebook_id, title, content, is_pinned, sort_order } = payload || {};

    // 校验 notebook_id
    if (!notebook_id || typeof notebook_id !== "number") {
        return c.json({
            code: -1000,
            msg: "note.create.notebook_required",
            data: null,
        });
    }

    // 校验 title
    if (!title || typeof title !== "string" || title.trim().length === 0) {
        return c.json({
            code: -1000,
            msg: "note.create.title_required",
            data: null,
        });
    }

    // 校验笔记本属于当前用户
    const notebookExists = await checkNotebookOwnership(notebook_id, uid);
    if (!notebookExists) {
        return c.json({
            code: -1000,
            msg: "note.create.notebook_not_found",
            data: null,
        });
    }

    const now = new Date();
    const result = await db
        .insert(schema.notes)
        .values({
            user_id: uid,
            notebook_id,
            title: title.trim(),
            content: content ?? "",
            is_pinned: is_pinned ?? 0,
            sort_order: sort_order ?? 0,
            created_at: now,
            updated_at: now,
        })
        .returning()
        .get();

    return c.json({
        code: 200,
        msg: "note.create.success",
        data: result,
    });
};

/**
 * 更新笔记
 * id 必传；title、content、notebook_id、is_pinned、sort_order 可选（部分更新）
 *
 * 历史版本机制：
 * - 仅当 title 或 content 实际变化时，才把旧值存一条快照（置顶/排序/移动分类不产生版本）
 * - 版本号 = 同一 note 当前最大 version_no + 1
 * - 单次更新后若该 note 版本数超过 50，删除最早的，仅保留最近 50 条
 * - 存快照与更新笔记在同一事务内，保证原子性
 */
export const updateNote = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const payload = await c.req.json();

    const { id, title, content, notebook_id, is_pinned, sort_order, allow_vectorize, create_version } = payload || {};
    // 默认创建版本快照，自动保存时前端传 false
    const shouldCreateVersion = create_version !== false;

    // 校验 id
    if (!id || typeof id !== "number") {
        return c.json({
            code: -1000,
            msg: "note.update.id_required",
            data: null,
        });
    }

    // 取当前笔记旧值，同时校验归属（user_id 条件防越权，一次查询兼得旧值与权限校验）
    const oldNote = await db
        .select({ title: schema.notes.title, content: schema.notes.content })
        .from(schema.notes)
        .where(and(
            eq(schema.notes.id, id),
            eq(schema.notes.user_id, uid),
        ))
        .get();

    if (!oldNote) {
        return c.json({
            code: -1000,
            msg: "note.update.not_found",
            data: null,
        });
    }

    // 如果传了 notebook_id，校验新分类属于当前用户
    if (notebook_id !== undefined) {
        const notebookExists = await checkNotebookOwnership(notebook_id, uid);
        if (!notebookExists) {
            return c.json({
                code: -1000,
                msg: "note.update.notebook_not_found",
                data: null,
            });
        }
    }

    // 如果传了 title，校验非空（trim 后不能为空字符串）
    if (title !== undefined && title.trim().length === 0) {
        return c.json({
            code: -1000,
            msg: "note.update.title_required",
            data: null,
        });
    }

    // 构建更新字段（部分更新）
    const updates: Record<string, any> = { updated_at: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content;
    if (notebook_id !== undefined) {
        updates.notebook_id = notebook_id;
        // 移动笔记到新分类时，自动恢复已删除的笔记（清空软删除标记）
        updates.is_deleted = 0;
        updates.deleted_at = null;
    }
    if (is_pinned !== undefined) updates.is_pinned = is_pinned;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (allow_vectorize !== undefined) updates.allow_vectorize = allow_vectorize;

    // 仅当 title 或 content 实际变化时才生成历史版本
    // content 的 trim 仅用于判定是否记版本，实际存储保留原值（含空白）
    const titleChanged = title !== undefined && title.trim() !== oldNote.title;
    const contentChanged = content !== undefined
        && content.trim() !== oldNote.content
        && content.trim() !== "";
    const needVersion = titleChanged || contentChanged;

    // 事务：存历史快照（可选）→ 更新笔记，保证原子性
    const result = await db.transaction(async (tx) => {
        if (needVersion && shouldCreateVersion) {
            // 版本号 = 当前最大 version_no + 1（单用户无协作，事务内安全）
            const maxRow = await tx
                .select({ maxNo: sql<number>`MAX(${schema.noteVersions.version_no})` })
                .from(schema.noteVersions)
                .where(eq(schema.noteVersions.note_id, id))
                .get();
            const nextVersionNo = (maxRow?.maxNo ?? 0) + 1;

            // 存旧值快照
            await tx.insert(schema.noteVersions).values({
                note_id: id,
                user_id: uid,
                title: oldNote.title,
                content: oldNote.content,
                version_no: nextVersionNo,
            });

            // 保留最近 50 个版本，删除多余的（按 version_no 倒序取前 50，其余删除）
            await tx.run(sql`
                DELETE FROM note_versions
                WHERE note_id = ${id}
                  AND id NOT IN (
                      SELECT id FROM note_versions
                      WHERE note_id = ${id}
                      ORDER BY version_no DESC
                      LIMIT 50
                  )
            `);
        }

        // 更新笔记
        return await tx
            .update(schema.notes)
            .set(updates)
            .where(and(
                eq(schema.notes.id, id),
                eq(schema.notes.user_id, uid),
            ))
            .returning()
            .get();
    });

    return c.json({
        code: 200,
        msg: "note.update.success",
        data: result,
    });
};

/**
 * 软删除笔记
 * id 必传，设置 is_deleted=1、deleted_at=now
 */
export const deleteNote = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const payload = await c.req.json();

    const { id } = payload || {};

    // 校验 id
    if (!id || typeof id !== "number") {
        return c.json({
            code: -1000,
            msg: "note.delete.id_required",
            data: null,
        });
    }

    // 校验笔记属于当前用户
    const noteExists = await checkNoteOwnership(id, uid);
    if (!noteExists) {
        return c.json({
            code: -1000,
            msg: "note.delete.not_found",
            data: null,
        });
    }

    const now = new Date();
    const result = await db
        .update(schema.notes)
        .set({
            is_deleted: 1,
            deleted_at: now,
            updated_at: now,
        })
        .where(and(
            eq(schema.notes.id, id),
            eq(schema.notes.user_id, uid),
        ))
        .returning()
        .get();

    return c.json({
        code: 200,
        msg: "note.delete.success",
        data: result,
    });
};

/**
 * 批量排序笔记（同分类内拖动排序）
 * 前端传全量 items: [{id, sort_order}]
 * 后端从首个笔记推断 notebook_id，事务批量更新，返回该分类排序后的笔记列表
 */
export const sortNotes = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const payload = await c.req.json();

    const { items } = payload || {};

    // 校验 items 非空数组
    if (!Array.isArray(items) || items.length === 0) {
        return c.json({
            code: -1000,
            msg: "note.sort.items_required",
            data: null,
        });
    }

    // 校验每个 item 的 id 和 sort_order 合法
    for (const item of items) {
        if (
            !item ||
            typeof item.id !== "number" ||
            typeof item.sort_order !== "number" ||
            !Number.isFinite(item.sort_order)
        ) {
            return c.json({
                code: -1000,
                msg: "note.sort.items_invalid",
                data: null,
            });
        }
    }

    // 从首个笔记推断 notebook_id，同时校验归属当前用户
    const firstNote = await db
        .select({ notebook_id: schema.notes.notebook_id })
        .from(schema.notes)
        .where(and(
            eq(schema.notes.id, items[0].id),
            eq(schema.notes.user_id, uid),
        ))
        .get();

    if (!firstNote) {
        return c.json({
            code: -1000,
            msg: "note.sort.note_not_found",
            data: null,
        });
    }

    const notebookId = firstNote.notebook_id;

    // 事务内批量更新 sort_order（带 user_id 防越权，不更新 updated_at）
    await db.transaction(async (tx) => {
        for (const item of items) {
            await tx
                .update(schema.notes)
                .set({
                    sort_order: item.sort_order,
                })
                .where(and(
                    eq(schema.notes.id, item.id),
                    eq(schema.notes.user_id, uid),
                ));
        }
    });

    // 返回该分类下排序后的笔记列表（排序口径与 listNotes 一致）
    const notes = await db
        .select()
        .from(schema.notes)
        .where(and(
            eq(schema.notes.user_id, uid),
            eq(schema.notes.notebook_id, notebookId),
            eq(schema.notes.is_deleted, 0),
        ))
        .orderBy(
            desc(schema.notes.is_pinned),
            asc(schema.notes.sort_order),
            desc(schema.notes.created_at),
        )
        .all();

    return c.json({
        code: 200,
        msg: "note.sort.success",
        data: notes,
    });
};

/**
 * 清空回收站（批量硬删除）
 * 将当前用户所有已软删除的笔记彻底删除，包括历史版本和关联文件
 * 分批处理，每批 30 条笔记，每批一个事务，避免长时间持锁
 * 失败的批次跳过继续处理，返回成功删除的总数
 */
export const emptyTrash = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const BATCH_SIZE = 30;

    // 查询回收站所有笔记 ID（仅查 ID，轻量）
    const trashedNotes = await db
        .select({ id: schema.notes.id })
        .from(schema.notes)
        .where(and(
            eq(schema.notes.user_id, uid),
            eq(schema.notes.is_deleted, 1),
        ))
        .all();

    // 回收站为空，直接返回
    if (trashedNotes.length === 0) {
        return c.json({
            code: 200,
            msg: "note.trash.empty.success",
            data: { deleted: 0 },
        });
    }

    const noteIds = trashedNotes.map((n) => n.id);
    let totalDeleted = 0;

    // 分批处理
    for (let i = 0; i < noteIds.length; i += BATCH_SIZE) {
        const batchIds = noteIds.slice(i, i + BATCH_SIZE);

        try {
            // 查询这批笔记的内容
            const notes = await db
                .select({ id: schema.notes.id, content: schema.notes.content })
                .from(schema.notes)
                .where(and(
                    inArray(schema.notes.id, batchIds),
                    eq(schema.notes.user_id, uid),
                ))
                .all();

            // 查询这批笔记的所有历史版本
            const versions = await db
                .select({ note_id: schema.noteVersions.note_id, content: schema.noteVersions.content })
                .from(schema.noteVersions)
                .where(and(
                    inArray(schema.noteVersions.note_id, batchIds),
                    eq(schema.noteVersions.user_id, uid),
                ))
                .all();

            // 合并所有内容，正则提取图片 ID
            const allContents = [
                ...notes.map((n) => n.content),
                ...versions.map((v) => v.content),
            ].filter(Boolean);

            const fileIdSet = new Set<string>();
            const reg = /zn-[A-Za-z0-9]{8}/g;
            for (const text of allContents) {
                const matches = text.matchAll(reg);
                for (const m of matches) {
                    fileIdSet.add(m[0]);
                }
            }

            // 查询关联文件记录
            const filePaths: string[] = [];
            if (fileIdSet.size > 0) {
                const fileRecords = await db
                    .select({ file_path: schema.files.file_path })
                    .from(schema.files)
                    .where(and(
                        inArray(schema.files.file_id, [...fileIdSet]),
                        eq(schema.files.user_id, uid),
                    ))
                    .all();
                filePaths.push(...fileRecords.map((f) => f.file_path));
            }

            // 事务内批量删除：历史版本 → 文件记录 → 笔记
            await db.transaction(async (tx) => {
                await tx
                    .delete(schema.noteVersions)
                    .where(and(
                        inArray(schema.noteVersions.note_id, batchIds),
                        eq(schema.noteVersions.user_id, uid),
                    ));

                if (fileIdSet.size > 0) {
                    await tx
                        .delete(schema.files)
                        .where(and(
                            inArray(schema.files.file_id, [...fileIdSet]),
                            eq(schema.files.user_id, uid),
                        ));
                }

                await tx
                    .delete(schema.notes)
                    .where(and(
                        inArray(schema.notes.id, batchIds),
                        eq(schema.notes.user_id, uid),
                    ));
            });

            // 事务成功后，清理磁盘文件（失败不阻塞，静默跳过）
            for (const relativePath of filePaths) {
                try {
                    const fullPath = join(FILES_BASE_PATH, relativePath);
                    if (existsSync(fullPath)) {
                        unlinkSync(fullPath);
                    }
                } catch {
                    // 磁盘文件删除失败不影响结果
                }
            }

            totalDeleted += notes.length;
        } catch {
            // 该批次处理失败，跳过继续处理下一批
        }
    }

    return c.json({
        code: 200,
        msg: "note.trash.empty.success",
        data: { deleted: totalDeleted },
    });
};

/**
 * 获取回收站笔记列表
 * 查询当前用户已软删除的笔记，按删除时间倒序，最多 200 条
 */
export const listTrashNotes = async (c: Context) => {
    const uid = Number(c.get("uid"));

    const notes = await db
        .select()
        .from(schema.notes)
        .where(and(
            eq(schema.notes.user_id, uid),
            eq(schema.notes.is_deleted, 1),
        ))
        .orderBy(desc(schema.notes.deleted_at))
        .limit(200)
        .all();

    return c.json({
        code: 200,
        msg: "note.trash.list.success",
        data: notes,
    });
};

/**
 * 获取单条笔记详情（含 notebook_id，用于 deep-link / 单独展示）
 * id 必传，校验归属当前用户
 */
export const getNoteById = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const noteId = Number(c.req.query("id"));

    // 校验 id
    if (!noteId || isNaN(noteId)) {
        return c.json({
            code: -1000,
            msg: "note.detail.id_required",
            data: null,
        });
    }

    // 校验笔记属于当前用户（user_id 条件防越权）
    const note = await db
        .select()
        .from(schema.notes)
        .where(and(
            eq(schema.notes.id, noteId),
            eq(schema.notes.user_id, uid),
        ))
        .get();

    if (!note) {
        return c.json({
            code: -1000,
            msg: "note.detail.not_found",
            data: null,
        });
    }

    return c.json({
        code: 200,
        msg: "note.detail.success",
        data: note,
    });
};

/**
 * 彻底删除笔记（硬删除）
 * id 必传，校验归属后，在事务内删除笔记、历史版本及相关文件记录，
 * 事务成功后再清理磁盘文件
 *
 * 流程：
 * 1. 校验 id 参数 + 笔记归属（带 user_id 条件防越权）
 * 2. 查笔记 + 所有历史版本的 content
 * 3. 正则提取 zn-{8位图片ID}，去重
 * 4. 查 files 表（带 user_id 过滤）获取 file_path
 * 5. 事务内依次删除：note_versions → files → notes
 * 6. 事务成功后，遍历 file_path 清理磁盘文件（失败仅跳过不报错）
 */
export const permanentDeleteNote = async (c: Context) => {
    const uid = Number(c.get("uid"));
    const payload = await c.req.json();

    const { id } = payload || {};

    if (!id || typeof id !== "number") {
        return c.json({
            code: -1000,
            msg: "note.permanent_delete.id_required",
            data: null,
        });
    }

    // 查询笔记，同时校验归属（带 user_id 条件防越权）
    const note = await db
        .select({ content: schema.notes.content })
        .from(schema.notes)
        .where(and(
            eq(schema.notes.id, id),
            eq(schema.notes.user_id, uid),
        ))
        .get();

    if (!note) {
        return c.json({
            code: -1000,
            msg: "note.permanent_delete.not_found",
            data: null,
        });
    }

    // 查询所有历史版本的 content
    const versions = await db
        .select({ content: schema.noteVersions.content })
        .from(schema.noteVersions)
        .where(eq(schema.noteVersions.note_id, id))
        .all();

    // 合并笔记内容 + 所有历史版本内容，正则提取 zn-{8位图片ID}
    const contents = [note.content, ...versions.map((v) => v.content)].filter(Boolean);
    const fileIdSet = new Set<string>();
    const reg = /zn-[A-Za-z0-9]{8}/g;
    for (const text of contents) {
        const matches = text.matchAll(reg);
        for (const m of matches) {
            fileIdSet.add(m[0]);
        }
    }

    // 查询关联文件记录（带 user_id 过滤，只删当前用户的文件）
    const filePaths: string[] = [];
    if (fileIdSet.size > 0) {
        const fileRecords = await db
            .select({ file_path: schema.files.file_path })
            .from(schema.files)
            .where(and(
                inArray(schema.files.file_id, [...fileIdSet]),
                eq(schema.files.user_id, uid),
            ))
            .all();
        filePaths.push(...fileRecords.map((f) => f.file_path));
    }

    // 事务：删除历史版本 → 文件记录 → 笔记
    await db.transaction(async (tx) => {
        await tx
            .delete(schema.noteVersions)
            .where(and(
                eq(schema.noteVersions.note_id, id),
                eq(schema.noteVersions.user_id, uid),
            ));

        if (fileIdSet.size > 0) {
            await tx
                .delete(schema.files)
                .where(and(
                    inArray(schema.files.file_id, [...fileIdSet]),
                    eq(schema.files.user_id, uid),
                ));
        }

        await tx
            .delete(schema.notes)
            .where(and(
                eq(schema.notes.id, id),
                eq(schema.notes.user_id, uid),
            ));
    });

    // 事务成功后，清理磁盘文件（失败不阻塞返回，仅跳过）
    for (const relativePath of filePaths) {
        try {
            const fullPath = join(FILES_BASE_PATH, relativePath);
            if (existsSync(fullPath)) {
                unlinkSync(fullPath);
            }
        } catch {
            // 磁盘文件删除失败不影响结果，跳过
        }
    }

    return c.json({
        code: 200,
        msg: "note.permanent_delete.success",
        data: null,
    });
};
