/**
 * 笔记相关类型定义
 *
 * Notebook（笔记本/分类）采用自引用树结构：
 * - parent_id 为 null 时表示顶层笔记本
 * - parent_id 不为 null 时表示子分类
 * - 笔记（Note）可以关联到任意层级的分类节点
 */

/** 后端返回的扁平笔记本节点 */
export interface Notebook {
    id: number;
    user_id: number;
    parent_id: number | null;
    title: string;
    description: string;
    sort_order: number;
    created_at: number | string;
    updated_at: number | string;
}

/** 前端组装后的树形节点（在 Notebook 基础上加 children） */
export interface NotebookNode extends Notebook {
    children: NotebookNode[];
    /** 节点在树中的深度（用于样式缩进），运行时计算 */
    depth?: number;
}

/** 笔记实体 */
export interface Note {
    id: number;
    user_id: number;
    notebook_id: number;
    title: string;
    content: string;
    is_pinned: number;
    is_deleted: number;
    deleted_at: number | string | null;
    sort_order: number;
    created_at: number | string;
    updated_at: number | string;
}

/** 创建笔记本/分类请求参数 */
export interface CreateNotebookPayload {
    title: string;
    parent_id?: number | null;
    description?: string;
    sort_order?: number;
}

/** 创建笔记请求参数 */
export interface CreateNotePayload {
    notebook_id: number;
    title: string;
    content?: string;
    is_pinned?: number;
    sort_order?: number;
}

/** 批量排序笔记的单项参数 */
export interface SortNoteItem {
    /** 笔记 ID */
    id: number;
    /** 排序值 */
    sort_order: number;
}

/** 批量排序分类的单项参数 */
export interface SortNotebookItem {
    /** 分类 ID */
    id: number;
    /** 排序值 */
    sort_order: number;
}
