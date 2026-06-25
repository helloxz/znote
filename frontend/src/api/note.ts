/**
 * 笔记 API 封装层
 *
 * 与后端 routers.ts 中的 userRouter.notebook.note.* 路由对应。
 * 笔记的增删改查都基于 notebook_id（分类 id）。
 */
import req from "@/utils/req";
import type { CreateNotePayload, Note, NoteVersion, NoteVersionItem, SortNoteItem } from "@/types/note";

interface ApiResult<T> {
    code: number;
    msg: string;
    data: T;
}

/**
 * 获取指定分类下的笔记列表（不含软删除）
 * @param notebookId 分类 id
 */
export const fetchNoteList = async (notebookId: number): Promise<Note[]> => {
    const res = await req.get<ApiResult<Note[]>>("/api/user/notebook/note/list", {
        params: { notebook_id: notebookId },
    });
    if (res.data?.code === 200) {
        return res.data.data ?? [];
    }
    return [];
};

/**
 * 创建笔记
 */
export const createNote = async (payload: CreateNotePayload): Promise<Note | null> => {
    const res = await req.post<ApiResult<Note>>("/api/user/notebook/note/create", payload);
    if (res.data?.code === 200) {
        return res.data.data;
    }
    return null;
};

/**
 * 更新笔记（部分更新）
 * id 必传；title、content、notebook_id、is_pinned、sort_order 可选
 */
export const updateNote = async (
    id: number,
    payload: Partial<Pick<Note, "title" | "content" | "notebook_id" | "is_pinned" | "sort_order">>,
): Promise<Note | null> => {
    const res = await req.post<ApiResult<Note>>("/api/user/notebook/note/update", { id, ...payload });
    if (res.data?.code === 200) {
        return res.data.data;
    }
    return null;
};

/**
 * 删除笔记（软删除：后端置 is_deleted=1、deleted_at=now）
 * @param id 笔记 id
 */
export const deleteNote = async (id: number): Promise<Note | null> => {
    const res = await req.post<ApiResult<Note>>("/api/user/notebook/note/delete", { id });
    if (res.data?.code === 200) {
        return res.data.data;
    }
    return null;
};

/**
 * 批量排序笔记（同分类内拖动排序）
 * 前端传全量 items，后端事务更新后返回该分类排序后的笔记列表
 * @param items 笔记 id 及对应排序值
 * @returns 更新后的笔记列表（失败返回 null）
 */
export const sortNotes = async (items: SortNoteItem[]): Promise<Note[] | null> => {
    const res = await req.post<ApiResult<Note[]>>("/api/user/notebook/note/sort", { items });
    if (res.data?.code === 200) {
        return res.data.data ?? [];
    }
    return null;
};

/**
 * 全文搜索笔记（FTS5 + trigram）
 * 搜索范围：指定顶层笔记本下所有子分类的笔记
 * @param notebookId 顶层笔记本 ID
 * @param keyword    关键词（最少 3 字符）
 * @returns 匹配的笔记列表（按 BM25 相关性排序，最多 50 条），失败返回 null
 */
export const searchNotes = async (notebookId: number, keyword: string): Promise<Note[] | null> => {
    const res = await req.get<ApiResult<Note[]>>("/api/user/note/search", {
        params: { notebook_id: notebookId, keyword },
    });
    if (res.data?.code === 200) {
        return res.data.data ?? [];
    }
    return null;
};

/**
 * 获取笔记的历史版本列表（仅轻量字段，不含 content）
 * @param noteId 笔记 ID
 * @returns 版本列表（按版本号倒序，最多 50 条），失败返回 null
 */
export const fetchNoteVersions = async (noteId: number): Promise<NoteVersionItem[] | null> => {
    const res = await req.get<ApiResult<NoteVersionItem[]>>("/api/user/note/versions", {
        params: { note_id: noteId },
    });
    if (res.data?.code === 200) {
        return res.data.data ?? [];
    }
    return null;
};

/**
 * 获取单个历史版本详情（含 title/content）
 * @param versionId 版本 ID
 * @returns 版本详情，失败返回 null
 */
export const fetchNoteVersion = async (versionId: number): Promise<NoteVersion | null> => {
    const res = await req.get<ApiResult<NoteVersion>>("/api/user/note/version", {
        params: { version_id: versionId },
    });
    if (res.data?.code === 200) {
        return res.data.data;
    }
    return null;
};

/**
 * 获取单条笔记详情（含 notebook_id，用于 deep-link / 第三栏独立渲染）
 * @param id 笔记 ID
 * @returns 完整笔记对象，失败返回 null
 */
export const fetchNoteById = async (id: number): Promise<Note | null> => {
    const res = await req.get<ApiResult<Note>>("/api/user/note/detail", {
        params: { id },
    });
    if (res.data?.code === 200) {
        return res.data.data;
    }
    return null;
};
