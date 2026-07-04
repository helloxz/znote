import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ==================== 用户 & 认证 ====================

/** 用户表 */
export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
    avatar: text("avatar").default("").notNull(),
    reg_ip: text("reg_ip").notNull(),
    reg_ua: text("reg_ua").notNull(),
    status: text("status", { enum: ["active", "inactive", "banned"] }).default("active").notNull(),
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

/** 会话表（Token 认证） */
export const sessions = sqliteTable("sessions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: integer("uid").notNull(),
    role: text("role", { enum: ["user", "admin"] }).notNull(),
    token: text("token").notNull().unique(),
    ip: text("ip").notNull(),
    ua: text("ua").notNull(),
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    last_active_at: integer("last_active_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["active", "expired", "revoked"] }).default("active").notNull(),
});

/** 用户设置表（JSON 存储） */
export const userSettings = sqliteTable("user_settings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: integer("uid").notNull().unique(),
    value: text("value").default("{}").notNull(),
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// ==================== 笔记核心 ====================

/**
 * 笔记本/分类树
 * parent_id 为 NULL → 顶层笔记本
 * parent_id 不为 NULL → 子分类
 * 笔记始终关联到叶子节点（最底层分类）
 */
export const notebooks = sqliteTable("notebooks", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    user_id: integer("user_id").notNull(),                                          // 所属用户
    parent_id: integer("parent_id"),                                                 // 父节点 ID，NULL 表示顶层笔记本
    title: text("title").notNull(),                                                  // 名称
    description: text("description").default("").notNull(),                          // 描述
    sort_order: integer("sort_order").default(0).notNull(),                          // 排序权重
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
    index("idx_notebooks_user_id").on(table.user_id),
    index("idx_notebooks_user_parent").on(table.user_id, table.parent_id),
]);

/**
 * Markdown 笔记
 * 始终关联到某个叶子分类（notebook_id）
 * 支持软删除（is_deleted / deleted_at）和置顶（is_pinned）
 */
export const notes = sqliteTable("notes", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    user_id: integer("user_id").notNull(),                                          // 所属用户
    notebook_id: integer("notebook_id").notNull(),                                  // 所在叶子分类
    title: text("title").notNull(),                                                  // 笔记标题
    content: text("content").default("").notNull(),                                  // Markdown 内容
    allow_vectorize: integer("allow_vectorize").default(1).notNull(),                  // 是否允许 AI 向量化 0/1
    is_vectorized: integer("is_vectorized").default(0),                   // 向量化状态 0=待处理 1=已完成 2=跳过(超长) 3=失败
    vectorized_at: integer("vectorized_at", { mode: "timestamp" }),                    // 向量化完成时间
    is_pinned: integer("is_pinned").default(0).notNull(),                            // 置顶 0/1
    is_deleted: integer("is_deleted").default(0).notNull(),                          // 软删除 0/1
    deleted_at: integer("deleted_at", { mode: "timestamp" }),                        // 删除时间（软删除时写入）
    sort_order: integer("sort_order").default(0).notNull(),                          // 排序权重
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
    index("idx_notes_user_notebook").on(table.user_id, table.notebook_id),           // 按笔记本查笔记
    index("idx_notes_user_deleted").on(table.user_id, table.is_deleted),             // 回收站查询
    index("idx_notes_user_pinned").on(table.user_id, table.is_pinned),               // 置顶笔记查询
]);

/**
 * 笔记历史版本（快照式）
 * 每次更新笔记前，若 title/content 实际变化，将旧值存一条快照
 * 同一 note 最多保留 50 条，超出按 version_no 删除最早的
 */
export const noteVersions = sqliteTable("note_versions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    note_id: integer("note_id").notNull(),                                            // 关联笔记
    user_id: integer("user_id").notNull(),                                            // 所属用户（权限校验/过滤）
    title: text("title").notNull(),                                                   // 标题快照（旧值）
    content: text("content").notNull(),                                               // 内容快照（旧值）
    version_no: integer("version_no").notNull(),                                      // 版本号（同一 note 内递增）
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
    index("idx_note_versions_note").on(table.note_id),                                // 按笔记查历史
    index("idx_note_versions_user").on(table.user_id),                                // 按用户过滤
]);


// ==================== 笔记分享 ====================

/**
 * 笔记分享表
 * 每篇笔记可创建多个分享链接，支持可选密码和有效期
 * share_id 为业务唯一标识（随机字符串），用于公开访问 /s/{share_id}
 */
export const noteShares = sqliteTable("note_shares", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    note_id: integer("note_id").notNull(),                                          // 关联笔记
    user_id: integer("user_id").notNull(),                                          // 所属用户（冗余，方便查询）
    share_id: text("share_id").notNull().unique(),                                  // 业务唯一标识，如 "aB3xK9mQ"
    password: text("password"),                                                      // 分享密码，NULL 表示无密码（明文存储）
    expires_at: integer("expires_at", { mode: "timestamp" }),                       // 过期时间，NULL 表示永不过期
    status: text("status", { enum: ["active", "revoked"] }).default("active").notNull(), // active 可访问，revoked 已撤销
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
    index("idx_note_shares_note").on(table.note_id),                                // 按笔记查分享列表
    index("idx_note_shares_user").on(table.user_id),                                // 按用户查所有分享
    index("idx_note_shares_share_id").on(table.share_id),                           // 按 share_id 快速查找
]);


// ==================== 文件管理 ====================

/**
 * 上传文件记录（图片等）
 * file_id 为业务唯一标识（随机字符串），用于嵌入笔记内容和快速检索
 * file_path 为相对于 data/files 的路径，URL 地址为 /files/{file_path}
 */
export const files = sqliteTable("files", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    file_id: text("file_id").notNull().unique(),                                    // 业务唯一标识，如 "aB3xK9mQ"
    user_id: integer("user_id").notNull(),                                          // 所属用户
    original_name: text("original_name").notNull(),                                 // 原始文件名
    file_path: text("file_path").notNull(),                                         // 相对存储路径
    file_size: integer("file_size").notNull(),                                      // 文件大小（字节）
    mime_type: text("mime_type").notNull(),                                         // MIME 类型
    width: integer("width"),                                                        // 图片宽度
    height: integer("height"),                                                      // 图片高度
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
    index("idx_files_user").on(table.user_id),
    index("idx_files_file_id").on(table.file_id),
]);

// ==================== 全局设置 ====================

/** 管理员全局设置表（Key-Value 方案，value 存储 JSON 对象） */
export const globalSettings = sqliteTable("global_settings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==================== 公开文档 ====================

/**
 * 公开文档配置表
 * 管理员可将顶层笔记本（parent_id IS NULL）发布为公开文档站点
 * 一个笔记本只能发布一次（notebook_id UNIQUE）
 * slug 仅允许 [a-z0-9-]，作为公开访问路径 /doc/{slug}
 */
export const docs = sqliteTable("docs", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    notebook_id: integer("notebook_id").notNull().unique(),                        // 关联顶层笔记本，UNIQUE 保证一对一
    slug: text("slug").notNull().unique(),                                         // URL 标识，仅允许 [a-z0-9-]
    title: text("title").default("").notNull(),                                    // 公开站标题（若为空则使用笔记本原标题）
    description: text("description").default("").notNull(),                        // 公开站描述
    keywords: text("keywords").default("").notNull(),                              // SEO 关键词（可选，非必填）
    status: text("status", { enum: ["active", "inactive"] }).default("active").notNull(), // active 可访问，inactive 停用
    created_at: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
    index("idx_docs_slug").on(table.slug),                                         // 按 slug 查询公开文档
]);
