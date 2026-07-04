import { db } from "@/db";
import * as schema from "@/db/schema";
import { desc, eq, and, inArray } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { vectorStore, INDEX_NAME } from "@/db/vector";
import { getSettingValue } from "./setting";

/** 单篇内容最大字符数，超过则跳过（BAAI/bge-m3 上限约 8192 tokens，留余量） */
const MAX_CONTENT_LENGTH = 5000;

/** 向量维度 */
const VECTOR_DIMENSIONS = 1024;

/** 根据 AI provider 返回对应的 API 地址 */
function getBaseURL(provider: string): string {
    switch (provider) {
        case "siliconflow":
            return "https://api.siliconflow.cn/v1";
        default:
            return "https://api.siliconflow.cn/v1";
    }
}

/** 获取 AI 对话模型配置 */
export async function getAIChatConfig() {
    return getSettingValue("ai_chat_setting");
}

/** 获取 AI 向量模型配置 */
export async function getAIEmbeddingConfig() {
    return getSettingValue("ai_embedding_setting");
}

/**
 * 查询并向量化下一批未处理笔记
 * 每次处理 batchSize 条，依次：检查开关 → 查询 → 过滤超长 → 解析顶层笔记本 → API 向量化 → 写入向量库 → 更新状态
 * @param batchSize 每批处理数量，默认 20
 * @returns 各状态计数 { success, skipped, failed }
 */
export async function vectorizeNextBatch(batchSize = 20) {
    // 1. 检查 AI embedding 是否已开启
    const embeddingConfig = await getAIEmbeddingConfig();
    if (!embeddingConfig?.enabled) {
        return { success: 0, skipped: 0, failed: 0 };
    }

    // 2. 查询待向量化的笔记（按 ID 降序取最新 20 条）
    const notes = await db
        .select()
        .from(schema.notes)
        .where(
            and(
                eq(schema.notes.is_deleted, 0),
                eq(schema.notes.allow_vectorize, 1),
                eq(schema.notes.is_vectorized, 0),
            )
        )
        .orderBy(desc(schema.notes.id))
        .limit(batchSize);

    if (notes.length === 0) {
        return { success: 0, skipped: 0, failed: 0 };
    }

    // 3. 分离超长内容（>5000 字符）→ 标记为 is_vectorized=2（跳过）
    const tooLong: number[] = [];
    const toProcess: typeof notes = [];
    for (const note of notes) {
        if (note.content.length > MAX_CONTENT_LENGTH) {
            tooLong.push(note.id);
        } else {
            toProcess.push(note);
        }
    }

    if (tooLong.length > 0) {
        await db
            .update(schema.notes)
            .set({ is_vectorized: 2, vectorized_at: new Date() })
            .where(inArray(schema.notes.id, tooLong));
    }

    if (toProcess.length === 0) {
        return { success: 0, skipped: tooLong.length, failed: 0 };
    }

    // 4. 解析每篇笔记的顶层笔记本 ID（向上递归到 parent_id IS NULL）
    const userIds = [...new Set(toProcess.map(n => n.user_id))];
    const allNotebooks = await db
        .select({
            id: schema.notebooks.id,
            parent_id: schema.notebooks.parent_id,
            user_id: schema.notebooks.user_id,
        })
        .from(schema.notebooks)
        .where(inArray(schema.notebooks.user_id, userIds));

    // 构建 id → { parent_id } 查找表
    const notebookParentMap = new Map<number, number | null>();
    for (const nb of allNotebooks) {
        notebookParentMap.set(nb.id, nb.parent_id);
    }

    // 向上遍历找到根节点（parent_id 为 null 的节点）
    const getRootNotebookId = (notebookId: number): number => {
        const visited = new Set<number>();
        let current = notebookId;
        while (true) {
            if (visited.has(current)) break; // 防止循环引用
            visited.add(current);
            const parentId = notebookParentMap.get(current);
            if (parentId === null) return current;
            if (parentId === undefined) return notebookId; // 数据异常，返回自身
            current = parentId;
        }
        return notebookId;
    };

    // 记录每篇笔记对应的顶层 notebook_id
    const noteRootMap = new Map<number, number>();
    for (const note of toProcess) {
        noteRootMap.set(note.id, getRootNotebookId(note.notebook_id));
    }

    // 5. 调用 SiliconFlow 批量向量化 API
    let successIds: number[] = [];
    let failedIds: number[] = [];

    try {
        const openai = createOpenAI({
            baseURL: getBaseURL(embeddingConfig.provider),
            apiKey: embeddingConfig.api_key,
        });

        const model = openai.embedding(embeddingConfig.model);

        const contents = toProcess.map(n => n.content);
        const isBgeModel = embeddingConfig.model.toLowerCase().includes("bge");
        const { embeddings } = await embedMany({
            model,
            values: contents,
            providerOptions: isBgeModel
                ? undefined
                : {
                      openai: {
                          dimensions: VECTOR_DIMENSIONS,
                      },
                  },
        });

        // 6. 批量写入向量库（metadata 包含 note_id / user_id / 顶层 notebook_id / title）
        if (embeddings.length > 0) {
            await vectorStore.upsert({
                indexName: INDEX_NAME,
                vectors: embeddings,
                metadata: toProcess.map(note => ({
                    note_id: note.id,
                    user_id: note.user_id,
                    notebook_id: noteRootMap.get(note.id)!,
                    title: note.title,
                })),
            });
        }

        successIds = toProcess.map(n => n.id);
        console.log(`向量化完成: 成功 ${successIds.length} 条, 跳过 ${tooLong.length} 条, 失败 ${failedIds.length} 条`);
    } catch (err) {
        console.error("向量化失败:", err);
        // embedding 或 upsert 失败，整批标记为失败
        failedIds = toProcess.map(n => n.id);
    }

    // 7. 批量更新笔记向量化状态
    if (successIds.length > 0) {
        await db
            .update(schema.notes)
            .set({ is_vectorized: 1, vectorized_at: new Date() })
            .where(inArray(schema.notes.id, successIds));
    }

    if (failedIds.length > 0) {
        await db
            .update(schema.notes)
            .set({ is_vectorized: 3, vectorized_at: new Date() })
            .where(inArray(schema.notes.id, failedIds));
    }

    return {
        success: successIds.length,
        skipped: tooLong.length,
        failed: failedIds.length,
    };
}
