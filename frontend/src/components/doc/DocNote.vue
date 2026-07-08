<script setup lang="ts">
/**
 * 笔记详情页
 * 获取笔记完整内容，使用 IncremarkContent 渲染 Markdown
 * 渲染完成后提取 H2/H3/H4 标题并通过 emit 传给父组件用于 TOC
 */
import { ref, watch, nextTick, onMounted, inject, type Ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { NTooltip, useMessage } from "naive-ui";
import { IncremarkContent, ThemeProvider } from "@incremark/vue";
import type { DesignTokens } from "@incremark/theme";
import "@incremark/theme/styles.css";
import req from "@/utils/req";
import ZIcon from "@/components/DynamicIcon.vue";

/** 代码块主题：深色背景 + 亮色文字 */
const codeTheme = {
    color: {
        code: {
            blockBackground: "#1e293b",
            blockText: "#e2e8f0",
            inlineBackground: "#334155",
            inlineText: "#e2e8f0",
            headerBackground: "#0f172a",
        },
    },
} as Partial<DesignTokens>;

const route = useRoute();
const { t } = useI18n();
const message = useMessage();

/** 注入 slug */
const slug = inject<string>("slug", "");

/** 笔记内容 */
const note = ref<{
    id: number;
    title: string;
    content: string;
    created_at: number;
    updated_at: number;
} | null>(null);

/** 加载状态 */
const loading = ref(false);
const error = ref("");

/** 内容区域 DOM 引用 */
const contentRef = ref<HTMLElement | null>(null);

/** TOC 标题列表 */
const headings = inject<Ref<{ level: number; text: string; id: string }[]>>("headings", ref([]));

/** 格式化日期（接受 Unix 秒数或 ISO 字符串） */
const formatDate = (val: any): string => {
    if (!val) return "";
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
};

/** 提取渲染后的标题 DOM 并分配 ID（Incremark 异步渲染，需延迟） */
const extractHeadings = () => {
    // IncremarkContent 内部异步解析 markdown，需要等待渲染完成
    setTimeout(() => {
        if (!contentRef.value) return;
        const headingEls = contentRef.value.querySelectorAll("h2, h3, h4");
        const items: { level: number; text: string; id: string }[] = [];
        headingEls.forEach((el, i) => {
            const id = `heading-${i}`;
            el.id = id;
            items.push({
                level: parseInt(el.tagName[1]),
                text: el.textContent || "",
                id,
            });
        });
        headings.value = items;
    }, 300);
};

/** 获取笔记详情 */
const fetchNote = async (noteId: number) => {
    loading.value = true;
    error.value = "";
    note.value = null;
    headings.value = [];
    try {
        const res = await req.get(`/api/doc/${slug}/note/${noteId}`);
        if (res.data?.code === 200) {
            note.value = res.data.data;
            // 渲染后提取标题
            await nextTick();
            extractHeadings();
        } else {
            error.value = t(res.data?.msg || "doc.note.not_found");
        }
    } catch {
        error.value = t("doc.note.load_failed");
    } finally {
        loading.value = false;
    }
};

/** 路由变化时重新加载 */
onMounted(() => {
    const noteId = Number(route.params.noteId);
    if (noteId) fetchNote(noteId);
});

watch(
    () => route.params.noteId,
    (newId) => {
        const noteId = Number(newId);
        if (noteId) fetchNote(noteId);
    },
);

/** 当前预览的图片地址（空字符串表示无预览） */
const previewSrc = ref("");

/** 内容区点击事件委托：点击图片时打开全屏预览 */
const handleContentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
        previewSrc.value = (target as HTMLImageElement).src;
    }
};

/** 复制 Markdown 到剪贴板：标题使用一级 ATX 标题格式 */
const copyMarkdown = async () => {
    if (!note.value) return;
    const md = `# ${note.value.title}\n\n${note.value.content}`;
    try {
        await navigator.clipboard.writeText(md);
        message.success(t("doc.note.copy_success"));
    } catch {
        message.error(t("doc.note.copy_fail"));
    }
};
</script>

<template>
  <div class="mx-auto max-w-3xl px-0 sm:px-0 py-2 sm:py-2">
    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
    </div>

    <!-- 错误 -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center py-24 text-slate-400"
    >
      <ZIcon name="ri:error-warning-line" :size="40" class="mb-3 opacity-50" />
      <span class="text-sm">{{ error }}</span>
    </div>

    <!-- 笔记内容 -->
    <template v-else-if="note">
      <!-- 笔记标题 + 元信息：底部细线分隔 -->
      <div class="mb-6 border-b border-slate-100 pb-4">
        <h1 class="mb-1.5 text-[1.75rem] font-bold tracking-tight text-slate-900">{{ note.title }}</h1>
        <!-- 元信息 + 复制按钮 -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 text-xs text-slate-400">
            <span v-if="note.updated_at" class="inline-flex items-center gap-1">
              <ZIcon name="ri:time-line" :size="12" class="opacity-70" />
              {{ t("doc.note.updated_at") }}: {{ formatDate(note.updated_at) }}
            </span>
          </div>
          <NTooltip placement="top" trigger="hover">
            <template #trigger>
              <button
                class="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                @click="copyMarkdown"
              >
                <ZIcon name="ri:file-copy-line" :size="14" />
              </button>
            </template>
            {{ t("doc.note.copy_markdown") }}
          </NTooltip>
        </div>
      </div>

      <!-- Markdown 内容渲染 -->
      <div ref="contentRef" class="doc-content" @click="handleContentClick">
        <ThemeProvider :theme="codeTheme">
          <IncremarkContent
            :content="note.content"
            :is-finished="true"
            :incremark-options="{
                htmlTree: {
                    tagBlacklist: [
                        'script', 'style', 'object', 'embed',
                        'form', 'input', 'button', 'textarea',
                        'select', 'meta', 'link', 'base',
                        'frame', 'frameset', 'applet',
                        'noscript', 'template'
                    ]
                }
            }"
          />
        </ThemeProvider>
      </div>
    </template>
  </div>

  <!-- 图片预览（Lightbox）：Teleport 到 body，避免被父容器裁剪 -->
  <Teleport to="body">
    <Transition name="lightbox-fade">
      <div
        v-if="previewSrc"
        class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click="previewSrc = ''"
      >
        <img
          :src="previewSrc"
          class="max-h-[90vh] max-w-[90vw] cursor-zoom-out object-contain shadow-2xl"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* 可选的全局样式覆盖，确保 Incremark 内容在文档页中显示良好 */
.doc-content {
  line-height: 1.75;
  color: #334155;
  overflow-wrap: break-word;
}
.doc-content h1 { font-size: 1.75rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; color: #0f172a; }
.doc-content h2 { font-size: 1.4rem; font-weight: 600; margin-top: 1.75rem; margin-bottom: 0.5rem; color: #1e293b; padding-bottom: 0.3rem; border-bottom: 1px solid #e2e8f0; }
.doc-content h3 { font-size: 1.15rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #334155; }
.doc-content h4 { font-size: 1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; color: #475569; }
.doc-content p { margin-bottom: 0.75rem; }
.doc-content ul, .doc-content ol { margin-bottom: 0.75rem; padding-left: 1.5rem; }
.doc-content ul { list-style-type: disc; }
.doc-content ul ul { list-style-type: circle; }
.doc-content ul ul ul { list-style-type: square; }
.doc-content ol { list-style-type: decimal; }
.doc-content li { margin-bottom: 0.25rem; }
.doc-content a { color: #2563eb; text-decoration: underline; }
.doc-content blockquote { padding-left: 1rem; margin: 1rem 0; color: #64748b; overflow-wrap: break-word; word-break: break-word; }
.doc-content table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 1rem 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.doc-content th, .doc-content td {
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  padding: 0.5rem 0.75rem;
  text-align: left;
  background: transparent;
}
.doc-content th:last-child, .doc-content td:last-child { border-right: none; }
.doc-content tbody tr:last-child th,
.doc-content tbody tr:last-child td { border-bottom: none; }
.doc-content th { background: #f8fafc; font-weight: 600; }
.doc-content img { max-width: 100%; border-radius: 0.375rem; cursor: zoom-in; }

/* 手机端：表格横向滚动，不强制换行压缩 */
@media (max-width: 767px) {
  .doc-content table {
    display: block;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }
  .doc-content th, .doc-content td {
    white-space: nowrap;
  }
}
.doc-content .incremark-code .code-btn:hover:not(:disabled) { background-color: rgba(255, 255, 255, 0.1); }

/* Lightbox 淡入淡出动画 */
.lightbox-fade-enter-active,
.lightbox-fade-leave-active { transition: opacity 0.2s ease; }
.lightbox-fade-enter-from,
.lightbox-fade-leave-to { opacity: 0; }
</style>
