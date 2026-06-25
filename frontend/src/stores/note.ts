/**
 * 笔记工作台 Pinia Store
 *
 * 设计要点：
 * 1. 后端只提供平铺数据（notebook/list），前端在内存中组装成树形结构
 * 2. 笔记按 notebook_id 维度缓存（notesByCategory），避免重复请求
 * 3. 聚合笔记（aggregatedNotes）缓存"某节点下所有笔记 id 集合"，切换分类时秒出
 * 4. 当前选中的笔记本/分类/笔记用 ref 跟踪，所有组件通过 store 联动
 */
import { defineStore } from "pinia";
import * as notebookApi from "@/api/notebook";
import * as noteApi from "@/api/note";
import type { CreateNotebookPayload, CreateNotePayload, Note, Notebook, NotebookNode, SortNoteItem, SortNotebookItem } from "@/types/note";

interface LoadingState {
    tree: boolean;     // 笔记本树加载中
    notes: boolean;    // 笔记列表加载中
    save: boolean;     // 创建/更新操作中
}

/** sessionStorage 存储 key 常量 */
const SESSION_KEYS = {
    notebook: "note-active-notebook-id",
    category: "note-active-category-id",
    note: "note-active-note-id",
};

/** 从 sessionStorage 读取 ID，无值时返回 null */
const readSessionId = (key: string): number | null => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
};

/** 写入 sessionStorage（null 时清除） */
const writeSessionId = (key: string, val: number | null): void => {
    if (val === null) {
        sessionStorage.removeItem(key);
    } else {
        sessionStorage.setItem(key, String(val));
    }
};

/**
 * 把扁平数据组装成树形结构
 * 独立函数，方便在 getter 和 action 中复用
 */
const buildNodeTree = (allNotebooks: Notebook[], notebook: Notebook): NotebookNode => {
    const children = allNotebooks
        .filter((nb) => nb.parent_id === notebook.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((child) => buildNodeTree(allNotebooks, child));
    return { ...notebook, children };
};

export const useNoteStore = defineStore("note", {
    state: () => ({
        /** 后端拉回来的扁平数据，全量缓存 */
        allNotebooks: [] as Notebook[],
        /** 顶层笔记本（parent_id === null），方便下拉框直接使用 */
        topNotebooks: [] as Notebook[],
        /** 已加载过笔记的分类 id 集合（用于避免重复请求） */
        loadedCategoryIds: new Set<number>(),
        /** 分类 id → 该分类下的笔记列表 */
        notesByCategory: {} as Record<number, Note[]>,
        /** 当前选中的笔记本（顶层）id（优先从 sessionStorage 恢复） */
        activeNotebookId: readSessionId(SESSION_KEYS.notebook),
        /** 当前选中的分类 id（null 表示未选中）（优先从 sessionStorage 恢复） */
        activeCategoryId: readSessionId(SESSION_KEYS.category),
        /** 当前选中的笔记 id（优先从 sessionStorage 恢复） */
        activeNoteId: readSessionId(SESSION_KEYS.note),
        /** 加载状态 */
        loading: {
            tree: false,
            notes: false,
            save: false,
        } as LoadingState,
    }),

    getters: {
        /**
         * 完整的分类树（仅顶层节点，子节点嵌在 children 里）
         * 适用于第一栏分类树渲染
         */
        categoryTree(state): NotebookNode[] {
            return state.topNotebooks.map((top) => buildNodeTree(state.allNotebooks, top));
        },

        /**
         * 当前选中的笔记本节点
         */
        activeNotebook(state): Notebook | null {
            if (state.activeNotebookId === null) return null;
            return state.allNotebooks.find((n) => n.id === state.activeNotebookId) ?? null;
        },

        /**
         * 当前选中的分类节点
         */
        activeCategory(state): Notebook | null {
            if (state.activeCategoryId === null) return null;
            return state.allNotebooks.find((n) => n.id === state.activeCategoryId) ?? null;
        },

        /**
         * 当前选中的笔记
         */
        activeNote(state): Note | null {
            if (state.activeNoteId === null) return null;
            for (const list of Object.values(state.notesByCategory)) {
                const found = list.find((n) => n.id === state.activeNoteId);
                if (found) return found;
            }
            return null;
        },

        /**
         * 第二栏展示用：当前选中分类下的直属笔记列表
         * 只取该分类自身的笔记（不含后代分类），排除软删除后排序
         * 排序口径与后端 listNotes 一致：置顶在前 → sort_order 升序 → 创建时间倒序
         */
        displayedNotes(state): Note[] {
            if (state.activeCategoryId === null) return [];

            const list = state.notesByCategory[state.activeCategoryId] ?? [];
            return list
                .filter((n) => n.is_deleted === 0)
                .sort((a, b) => {
                    if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned;            // 置顶在前
                    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;       // sort_order 升序
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // 创建时间倒序
                });
        },
    },

    actions: {
        /**
         * 加载笔记本树（首次进入工作台时调用）
         * 一次性拉全量数据，前端组装
         * 如果 sessionStorage 中保存了上次选中的分类和笔记，一并恢复
         */
        async loadNotebookTree() {
            this.loading.tree = true;
            try {
                const list = await notebookApi.fetchNotebookList();
                this.allNotebooks = list;
                this.topNotebooks = list
                    .filter((nb) => nb.parent_id === null)
                    .sort((a, b) => a.sort_order - b.sort_order);

                // 默认选中第一个顶层笔记本（仅在 sessionStorage 无缓存时）
                if (this.activeNotebookId === null && this.topNotebooks.length > 0) {
                    this.activeNotebookId = this.topNotebooks[0].id;
                    writeSessionId(SESSION_KEYS.notebook, this.activeNotebookId);
                } else if (this.activeNotebookId !== null) {
                    // 校验恢复的 notebookId 是否有效，无效则清除
                    const valid = this.allNotebooks.some((nb) => nb.id === this.activeNotebookId);
                    if (!valid) {
                        this.activeNotebookId = null;
                        this.activeCategoryId = null;
                        this.activeNoteId = null;
                        writeSessionId(SESSION_KEYS.notebook, null);
                        writeSessionId(SESSION_KEYS.category, null);
                        writeSessionId(SESSION_KEYS.note, null);
                    }
                }

                // 恢复上次选中的分类：只加载该分类自身的笔记缓存
                if (this.activeCategoryId !== null) {
                    const savedNoteId = this.activeNoteId;
                    // 先清空笔记选中，保证后续恢复时（null→id）触发 watch 更新草稿
                    this.activeNoteId = null;
                    // 校验恢复的 categoryId 是否有效
                    const catValid = this.allNotebooks.some((nb) => nb.id === this.activeCategoryId);
                    if (!catValid) {
                        this.activeCategoryId = null;
                        writeSessionId(SESSION_KEYS.category, null);
                        writeSessionId(SESSION_KEYS.note, null);
                        return;
                    }
                    // 只加载当前分类的笔记缓存
                    if (!this.loadedCategoryIds.has(this.activeCategoryId)) {
                        await this.loadCategoryNotes(this.activeCategoryId);
                    }
                    // 恢复笔记选中
                    if (savedNoteId !== null) {
                        this.activeNoteId = savedNoteId;
                    }
                }
            } finally {
                this.loading.tree = false;
            }
        },

        /**
         * 切换顶层笔记本
         * 切换后重置分类选中状态，同步写入 sessionStorage
         */
        switchNotebook(id: number) {
            this.activeNotebookId = id;
            this.activeCategoryId = null;
            this.activeNoteId = null;
            writeSessionId(SESSION_KEYS.notebook, id);
            writeSessionId(SESSION_KEYS.category, null);
            writeSessionId(SESSION_KEYS.note, null);
        },

        /**
         * 选中分类，按需加载该分类下的笔记，同步写入 sessionStorage
         */
        async selectCategory(id: number | null) {
            this.activeCategoryId = id;
            this.activeNoteId = null;
            writeSessionId(SESSION_KEYS.category, id);
            writeSessionId(SESSION_KEYS.note, null);
            if (id !== null && !this.loadedCategoryIds.has(id)) {
                await this.loadCategoryNotes(id);
            }
        },

        /**
         * 加载指定分类的笔记（带缓存）
         */
        async loadCategoryNotes(categoryId: number) {
            this.loading.notes = true;
            try {
                const notes = await noteApi.fetchNoteList(categoryId);
                this.notesByCategory = { ...this.notesByCategory, [categoryId]: notes };
                this.loadedCategoryIds.add(categoryId);
            } finally {
                this.loading.notes = false;
            }
        },

        /**
         * 选中笔记，同步写入 sessionStorage
         */
        selectNote(id: number | null) {
            this.activeNoteId = id;
            writeSessionId(SESSION_KEYS.note, id);
        },

        /**
         * 创建笔记本（顶层）或子分类
         */
        async createNotebook(payload: CreateNotebookPayload) {
            this.loading.save = true;
            try {
                const result = await notebookApi.createNotebook(payload);
                if (result) {
                    // 局部更新：插入新节点到 allNotebooks
                    this.allNotebooks = [...this.allNotebooks, result];
                    // 若是顶层笔记本，追加到 topNotebooks
                    if (result.parent_id === null) {
                        this.topNotebooks = [...this.topNotebooks, result].sort(
                            (a, b) => a.sort_order - b.sort_order,
                        );
                    }
                }
                return result;
            } finally {
                this.loading.save = false;
            }
        },

        /**
         * 更新笔记本/分类
         * 更新成功后同步更新本地缓存
         */
        async updateNotebook(id: number, payload: { title?: string; description?: string }) {
            this.loading.save = true;
            try {
                const result = await notebookApi.updateNotebook(id, payload);
                if (result) {
                    this.allNotebooks = this.allNotebooks.map((nb) => (nb.id === id ? result : nb));
                    if (result.parent_id === null) {
                        this.topNotebooks = this.topNotebooks.map((nb) => (nb.id === id ? result : nb));
                    }
                }
                return result;
            } finally {
                this.loading.save = false;
            }
        },

        /**
         * 批量排序分类（同级内拖动排序）
         * 前端传全量 items，后端事务更新后返回该父节点下排序后的子分类列表
         * 用返回数据覆盖 allNotebooks 中对应记录的 sort_order
         * categoryTree getter 会自动重算
         * @param items 分类 id 及对应排序值
         */
        async sortNotebooks(items: SortNotebookItem[]) {
            this.loading.save = true;
            try {
                const result = await notebookApi.sortNotebooks(items);
                if (result) {
                    // 用返回的排序后数据更新 allNotebooks 中对应记录
                    const idToUpdate = new Map(result.map((n) => [n.id, n]));
                    this.allNotebooks = this.allNotebooks.map((nb) =>
                        idToUpdate.get(nb.id) ?? nb,
                    );
                }
                return result;
            } finally {
                this.loading.save = false;
            }
        },

        /**
         * 创建笔记
         */
        async createNote(payload: CreateNotePayload) {
            this.loading.save = true;
            try {
                const result = await noteApi.createNote(payload);
                if (result) {
                    // 写入对应分类的笔记列表
                    const existing = this.notesByCategory[result.notebook_id] ?? [];
                    this.notesByCategory = {
                        ...this.notesByCategory,
                        [result.notebook_id]: [result, ...existing],
                    };
                    this.loadedCategoryIds.add(result.notebook_id);
                }
                return result;
            } finally {
                this.loading.save = false;
            }
        },

        /**
         * 更新笔记（部分更新）
         * 更新成功后同步更新本地缓存
         */
        async updateNote(
            id: number,
            payload: Partial<Pick<import("@/types/note").Note, "title" | "content" | "notebook_id" | "is_pinned" | "sort_order">>,
        ) {
            this.loading.save = true;
            try {
                const result = await noteApi.updateNote(id, payload);
                if (result) {
                    // 同步更新本地缓存中对应的笔记
                    for (const cid of Object.keys(this.notesByCategory)) {
                        const list = this.notesByCategory[Number(cid)];
                        const idx = list.findIndex((n) => n.id === id);
                        if (idx !== -1) {
                            list[idx] = result;
                            this.notesByCategory = { ...this.notesByCategory };
                            break;
                        }
                    }
                }
                return result;
            } finally {
                this.loading.save = false;
            }
        },

        /**
         * 删除笔记（软删除）
         * 后端置 is_deleted=1，前端从对应分类缓存中移除该笔记；
         * 若删除的是当前激活笔记，清空选中回到空态。
         */
        async deleteNote(id: number) {
            this.loading.save = true;
            try {
                const result = await noteApi.deleteNote(id);
                if (result) {
                    // 从对应分类的笔记列表中移除
                    for (const cid of Object.keys(this.notesByCategory)) {
                        const list = this.notesByCategory[Number(cid)];
                        const idx = list.findIndex((n) => n.id === id);
                        if (idx !== -1) {
                            this.notesByCategory = {
                                ...this.notesByCategory,
                                [Number(cid)]: list.filter((n) => n.id !== id),
                            };
                            break;
                        }
                    }
                    // 若删除的是当前激活笔记，清空选中（第三栏回到空态）
                    if (this.activeNoteId === id) {
                        this.selectNote(null);
                    }
                }
                return result;
            } finally {
                this.loading.save = false;
            }
        },

        /**
         * 批量排序笔记（同分类内拖动排序）
         * 前端传全量 items，后端事务更新后返回该分类排序后的笔记列表
         * 用返回数据覆盖对应分类的本地缓存
         * @param items 笔记 id 及对应排序值
         */
        async sortNotes(items: SortNoteItem[]) {
            this.loading.save = true;
            try {
                const result = await noteApi.sortNotes(items);
                if (result) {
                    // 后端返回的列表属于同一分类，找出 notebook_id 后覆盖本地缓存
                    const notebookId = result[0]?.notebook_id;
                    if (notebookId !== undefined) {
                        this.notesByCategory = {
                            ...this.notesByCategory,
                            [notebookId]: result,
                        };
                    }
                }
                return result;
            } finally {
                this.loading.save = false;
            }
        },
    },
});
