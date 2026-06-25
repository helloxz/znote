/**
 * 笔记本 API 封装层
 *
 * 与后端 routers.ts 中的 userRouter.notebook.* 路由一一对应。
 * 所有方法在 token 失效时会由 axios 拦截器统一处理（业务侧只关心 code === 200）。
 */
import req from "@/utils/req";
import type { CreateNotebookPayload, Notebook, SortNotebookItem } from "@/types/note";

/** 统一接口返回结构 */
interface ApiResult<T> {
    code: number;
    msg: string;
    data: T;
}

/**
 * 获取当前用户的所有笔记本（平铺结构）
 * 后端按 sort_order 升序返回
 */
export const fetchNotebookList = async (): Promise<Notebook[]> => {
    const res = await req.get<ApiResult<Notebook[]>>("/api/user/notebook/list");
    if (res.data?.code === 200) {
        return res.data.data ?? [];
    }
    return [];
};

/**
 * 获取顶层笔记本（parent_id 为 null）
 * 用于下拉框展示
 */
export const fetchTopNotebooks = async (): Promise<Notebook[]> => {
    const res = await req.get<ApiResult<Notebook[]>>("/api/user/notebook/top");
    if (res.data?.code === 200) {
        return res.data.data ?? [];
    }
    return [];
};

/**
 * 创建笔记本或子分类
 * - 不传 parent_id：创建顶层笔记本
 * - 传 parent_id：创建对应父节点的子分类
 */
export const createNotebook = async (payload: CreateNotebookPayload): Promise<Notebook | null> => {
    const res = await req.post<ApiResult<Notebook>>("/api/user/notebook/create", payload);
    if (res.data?.code === 200) {
        return res.data.data;
    }
    return null;
};

/**
 * 更新笔记本/分类（部分更新）
 * 支持更新 title、description 等字段
 */
export const updateNotebook = async (id: number, payload: { title?: string; description?: string }): Promise<Notebook | null> => {
    const res = await req.post<ApiResult<Notebook>>("/api/user/notebook/update", { id, ...payload });
    if (res.data?.code === 200) {
        return res.data.data;
    }
    return null;
};

/**
 * 批量排序分类（同级内拖动排序）
 * 前端传全量 items，后端事务更新后返回该父节点下排序后的子分类列表
 * @param items 分类 id 及对应排序值
 * @returns 更新后的分类列表（失败返回 null）
 */
export const sortNotebooks = async (items: SortNotebookItem[]): Promise<Notebook[] | null> => {
    const res = await req.post<ApiResult<Notebook[]>>("/api/user/notebook/sort", { items });
    if (res.data?.code === 200) {
        return res.data.data ?? [];
    }
    return null;
};
