import { LibSQLVector } from "@mastra/libsql";
import { dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { VECTOR_DB_FILE } from "../path";

const dir = dirname(VECTOR_DB_FILE);
if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
}

/** Mastra libSQL 向量库实例 */
const vectorStore = new LibSQLVector({
    id: "znote-vector",
    url: `file:${VECTOR_DB_FILE}`,
});

/** 笔记分块向量索引名 */
const INDEX_NAME = "note_chunks";

/** 创建索引（幂等：通过 listIndexes 判断是否已存在） */
const indexes = await vectorStore.listIndexes();
if (!indexes.includes(INDEX_NAME)) {
    await vectorStore.createIndex({ indexName: INDEX_NAME, dimension: 1024 });
}

export { vectorStore, INDEX_NAME };
