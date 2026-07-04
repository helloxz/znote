// 数据库文件相对路径（基于 process.cwd()）
// 同时被 backend/db/index.ts（运行时）和 drizzle.config.ts（迁移工具）引用
export const DB_FILE = "./data/db/znote.db";

/** 向量数据库文件路径 */
export const VECTOR_DB_FILE = "./data/vector/znote_vector.db";
