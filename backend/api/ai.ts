import { Context } from "hono";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { desc, eq, and, inArray, lte, sql } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { RequestContext } from "@mastra/core/request-context";
import { vectorStore, INDEX_NAME } from "@/db/vector";
import { checkNotebookOwnership } from "@/utils/ownership";
import { getBaseURL, getAIEmbeddingConfig, MAX_CONTENT_LENGTH, VECTOR_DIMENSIONS } from "@/utils/ai-config";

// ==================== 向量化 ====================

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

    // 2. 查询待向量化的笔记（按 ID 降序取最新 N 条）
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

    // 3. 分离超长内容（>MAX_CONTENT_LENGTH 字符）→ 标记为 is_vectorized=2（跳过）
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

    // 构建 id → parent_id 查找表
    const notebookParentMap = new Map<number, number | null>();
    for (const nb of allNotebooks) {
        notebookParentMap.set(nb.id, nb.parent_id);
    }

    // 向上遍历找到根节点（parent_id 为 null 的节点）
    const getRootNotebookId = (notebookId: number): number => {
        const visited = new Set<number>();
        let current = notebookId;
        while (true) {
            if (visited.has(current)) break;
            visited.add(current);
            const parentId = notebookParentMap.get(current);
            if (parentId === null) return current;
            if (parentId === undefined) return notebookId;
            current = parentId;
        }
        return notebookId;
    };

    // 记录每篇笔记对应的顶层 notebook_id
    const noteRootMap = new Map<number, number>();
    for (const note of toProcess) {
        noteRootMap.set(note.id, getRootNotebookId(note.notebook_id));
    }

    // 5. 调用向量化 API
    let successIds: number[] = [];
    let failedIds: number[] = [];

    try {
        const openai = createOpenAI({
            baseURL: getBaseURL(embeddingConfig.provider),
            apiKey: embeddingConfig.api_key,
        });

        const contents = toProcess.map(n => n.content);
        const isBgeModel = embeddingConfig.model.toLowerCase().includes("bge");
        const { embeddings } = await embedMany({
            model: openai.embedding(embeddingConfig.model),
            values: contents,
            providerOptions: isBgeModel
                ? undefined
                : { openai: { dimensions: VECTOR_DIMENSIONS } },
        });

        // 6. 批量写入向量库
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

/**
 * 更新已修改笔记的向量数据
 * 查询已向量化但内容有更新的笔记（updated_at > vectorized_at，且至少 6 分钟前修改，避免正在编辑中），
 * 重新 embedding 并更新向量库
 * @param batchSize 每批处理数量，默认 20
 * @returns 各状态计数 { success, failed }
 */
export async function updateVectorizedNotes(batchSize = 20) {
    // 1. 检查 AI embedding 是否已开启
    const embeddingConfig = await getAIEmbeddingConfig();
    if (!embeddingConfig?.enabled) {
        return { success: 0, failed: 0 };
    }

    // 2. 查询需要更新的笔记（6 分钟缓冲避免正在编辑的笔记）
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const notes = await db
        .select()
        .from(schema.notes)
        .where(
            and(
                eq(schema.notes.is_deleted, 0),
                eq(schema.notes.allow_vectorize, 1),
                eq(schema.notes.is_vectorized, 1),
                sql`${schema.notes.updated_at} > ${schema.notes.vectorized_at}`,
                lte(schema.notes.updated_at, sixMinutesAgo),
            )
        )
        .orderBy(desc(schema.notes.id))
        .limit(batchSize);

    if (notes.length === 0) {
        return { success: 0, failed: 0 };
    }

    // 3. 解析每篇笔记的顶层笔记本 ID
    const userIds = [...new Set(notes.map(n => n.user_id))];
    const allNotebooks = await db
        .select({
            id: schema.notebooks.id,
            parent_id: schema.notebooks.parent_id,
        })
        .from(schema.notebooks)
        .where(inArray(schema.notebooks.user_id, userIds));

    const notebookParentMap = new Map<number, number | null>();
    for (const nb of allNotebooks) {
        notebookParentMap.set(nb.id, nb.parent_id);
    }

    const getRootNotebookId = (notebookId: number): number => {
        const visited = new Set<number>();
        let current = notebookId;
        while (true) {
            if (visited.has(current)) break;
            visited.add(current);
            const parentId = notebookParentMap.get(current);
            if (parentId === null) return current;
            if (parentId === undefined) return notebookId;
            current = parentId;
        }
        return notebookId;
    };

    const noteRootMap = new Map<number, number>();
    for (const note of notes) {
        noteRootMap.set(note.id, getRootNotebookId(note.notebook_id));
    }

    // 4. 批量向量化
    let successIds: number[] = [];
    let failedIds: number[] = [];

    try {
        const openai = createOpenAI({
            baseURL: getBaseURL(embeddingConfig.provider),
            apiKey: embeddingConfig.api_key,
        });

        const contents = notes.map(n => n.content);
        const isBgeModel = embeddingConfig.model.toLowerCase().includes("bge");
        const { embeddings } = await embedMany({
            model: openai.embedding(embeddingConfig.model),
            values: contents,
            providerOptions: isBgeModel
                ? undefined
                : { openai: { dimensions: VECTOR_DIMENSIONS } },
        });

        // 5. 逐条删除旧向量 + 写入新向量
        if (embeddings.length > 0) {
            for (let i = 0; i < notes.length; i++) {
                const note = notes[i];
                try {
                    // 删除该笔记的旧向量
                    await vectorStore.deleteVectors({
                        indexName: INDEX_NAME,
                        filter: { note_id: note.id, user_id: note.user_id },
                    });
                } catch { /* 旧向量不存在时忽略 */ }

                // 写入新向量
                await vectorStore.upsert({
                    indexName: INDEX_NAME,
                    vectors: [embeddings[i]],
                    metadata: [{
                        note_id: note.id,
                        user_id: note.user_id,
                        notebook_id: noteRootMap.get(note.id)!,
                        title: note.title,
                    }],
                });
            }
        }

        successIds = notes.map(n => n.id);
        console.log(`向量更新完成: 成功 ${successIds.length} 条, 失败 ${failedIds.length} 条`);
    } catch (err) {
        console.error("向量更新失败:", err);
        failedIds = notes.map(n => n.id);
    }

    // 6. 批量更新笔记向量化时间
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
        failed: failedIds.length,
    };
}

/**
 * 管理员重置向量化（清空向量库 + 重置所有笔记为待向量化）
 * POST /api/admin/reset_vectorization
 */
export async function resetVectorization(c: Context) {
    await vectorStore.deleteIndex({ indexName: INDEX_NAME });
    await vectorStore.createIndex({ indexName: INDEX_NAME, dimension: 1024 });

    await db.update(schema.notes)
        .set({ is_vectorized: 0, vectorized_at: null })
        .run();

    return c.json({ code: 200, msg: "ai.vectorization.reset.success", data: null });
}

// ==================== AI 对话 ====================

/**
 * AI RAG 对话（SSE 流式返回）
 * POST /api/user/ai/chat
 * Body: { notebook_id: number, thread_id: string, message: string }
 */
export async function chatWithNotes(c: Context) {
    const uid = Number(c.get("uid"));

    // 解析参数
    const payload = await c.req.json();
    const { notebook_id, thread_id, message } = payload || {};

    // 校验必填参数
    if (!notebook_id || typeof notebook_id !== "number") {
        return c.json({ code: -1000, msg: "ai.chat.notebook_required", data: null });
    }
    if (!thread_id || typeof thread_id !== "string") {
        return c.json({ code: -1000, msg: "ai.chat.thread_required", data: null });
    }
    if (!/^[a-zA-Z0-9_-]{16}$/.test(thread_id)) {
        return c.json({ code: -1000, msg: "ai.chat.thread_invalid", data: null });
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
        return c.json({ code: -1000, msg: "ai.chat.message_required", data: null });
    }

    // 验证笔记本归属
    const owned = await checkNotebookOwnership(notebook_id, uid);
    if (!owned) {
        return c.json({ code: -1000, msg: "ai.chat.notebook_not_found", data: null });
    }

    // 获取 Agent 实例
    const { mastra } = await import("@/db/mastra");
    const agent = mastra.getAgentById("rag-agent");
    if (!agent) {
        return c.json({ code: -1000, msg: "ai.chat.agent_not_found", data: null });
    }

    // 验证 thread 归属：已存在的 thread 必须属于当前用户
    const memory = await agent.getMemory();
    if (memory) {
        const existingThread = await memory.getThreadById({ threadId: thread_id });
        if (existingThread && existingThread.resourceId !== String(uid)) {
            return c.json({ code: -1000, msg: "ai.chat.thread_access_denied", data: null });
        }
    }

    // 请求上下文：注入 notebook_id 和 user_id 供 search-notes 工具使用
    const requestContext = new RequestContext();
    requestContext.set("notebook_id", notebook_id);
    requestContext.set("user_id", uid);

    try {
        const mastraStream = await agent.stream(message, {
            memory: {
                thread: thread_id,
                resource: String(uid),
            },
            requestContext,
            maxSteps: 5,
        });

        // SSE 流式响应
        const sseStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of mastraStream.fullStream) {
                        const data = JSON.stringify(chunk);
                        try {
                            controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
                        } catch { break; }
                    }
                    try { controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); } catch {}
                    try { controller.close(); } catch {}
                } catch (err) {
                    console.error("AI 对话流式输出异常:", err);
                    try {
                        const errorData = JSON.stringify({ type: "error", error: String(err) });
                        controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
                    } catch {}
                    try { controller.close(); } catch {}
                }
            },
        });

        return new Response(sseStream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (err) {
        console.error("AI 对话失败:", err);
        return c.json({ code: -1000, msg: "ai.chat.error", data: null });
    }
}

// ==================== 会话管理 ====================

/**
 * 列出当前用户的所有 AI 对话会话
 * GET /api/user/ai/threads
 */
export async function listThreads(c: Context) {
    const uid = Number(c.get("uid"));

    const { mastra } = await import("@/db/mastra");
    const agent = mastra.getAgentById("rag-agent");
    if (!agent) {
        return c.json({ code: -1000, msg: "ai.thread.agent_not_found", data: null });
    }

    const memory = await agent.getMemory();
    if (!memory) {
        return c.json({ code: -1000, msg: "ai.thread.memory_not_found", data: null });
    }

    const result = await memory.listThreads({
        filter: { resourceId: String(uid) },
        perPage: 50,
    });

    return c.json({ code: 200, msg: "ai.thread.list.success", data: result.threads });
}

/**
 * 获取指定会话的消息历史
 * GET /api/user/ai/thread/:id
 */
export async function getThread(c: Context) {
    const uid = Number(c.get("uid"));
    const threadId = c.req.param("id");

    if (!threadId) {
        return c.json({ code: -1000, msg: "ai.thread.id_required", data: null });
    }

    const { mastra } = await import("@/db/mastra");
    const agent = mastra.getAgentById("rag-agent");
    if (!agent) {
        return c.json({ code: -1000, msg: "ai.thread.agent_not_found", data: null });
    }

    const memory = await agent.getMemory();
    if (!memory) {
        return c.json({ code: -1000, msg: "ai.thread.memory_not_found", data: null });
    }

    const thread = await memory.getThreadById({ threadId });
    if (!thread || thread.resourceId !== String(uid)) {
        return c.json({ code: -1000, msg: "ai.thread.not_found", data: null });
    }

    const { messages } = await memory.recall({ threadId, perPage: 1000 });

    return c.json({ code: 200, msg: "ai.thread.get.success", data: { thread, messages } });
}

/**
 * 删除指定会话
 * DELETE /api/user/ai/thread/:id
 */
export async function deleteThread(c: Context) {
    const uid = Number(c.get("uid"));
    const threadId = c.req.param("id");

    if (!threadId) {
        return c.json({ code: -1000, msg: "ai.thread.id_required", data: null });
    }

    const { mastra } = await import("@/db/mastra");
    const agent = mastra.getAgentById("rag-agent");
    if (!agent) {
        return c.json({ code: -1000, msg: "ai.thread.agent_not_found", data: null });
    }

    const memory = await agent.getMemory();
    if (!memory) {
        return c.json({ code: -1000, msg: "ai.thread.memory_not_found", data: null });
    }

    const thread = await memory.getThreadById({ threadId });
    if (!thread || thread.resourceId !== String(uid)) {
        return c.json({ code: -1000, msg: "ai.thread.not_found", data: null });
    }

    await memory.deleteThread(threadId);

    return c.json({ code: 200, msg: "ai.thread.delete.success", data: null });
}
