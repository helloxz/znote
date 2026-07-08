<script setup lang="ts">
/**
 * 公开分享页面
 *
 * 无登录态，无需鉴权。通过 URL 中的 shareId 获取分享内容：
 *   - 200: 渲染笔记（IncremarkContent）
 *   - password_required: 展示密码输入框
 *   - password_wrong: 密码错误提示
 *   - 404: 内容不存在
 *
 * 布局：单栏居中，无顶栏/侧栏，页脚版权同文档系统。
 */
import { ref, onMounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { IncremarkContent, ThemeProvider } from "@incremark/vue";
import type { DesignTokens } from "@incremark/theme";
import "@incremark/theme/styles.css";
import req from "@/utils/req";
import ZIcon from "@/components/DynamicIcon.vue";

/** 代码块主题：深色背景 + 亮色文字，与文档系统一致 */
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

/** 页面状态：loading | notFound | password | content */
const pageState = ref<"loading" | "notFound" | "password" | "content">("loading");
/** 密码输入错误标记 */
const passwordError = ref(false);
/** 密码输入值 */
const passwordValue = ref("");
/** 分享数据 */
const note = ref<{ title: string; content: string; expires_at: number | string | null } | null>(null);
/** 密码提交加载态 */
const submitting = ref(false);

/** 格式化到期日期 */
const formatExpiry = (val: number | string | null): string => {
    if (!val) return "";
    const d = new Date(val);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

/** 获取分享内容 */
const fetchShare = async (pwd?: string) => {
    pageState.value = "loading";
    passwordError.value = false;
    try {
        const shareId = route.params.shareId as string;
        const res = await req.get(`/api/share/${shareId}`, {
            params: pwd ? { password: pwd } : {},
        });
        if (res.data?.code === 200) {
            note.value = res.data.data;
            pageState.value = "content";
            await nextTick();
            extractHeadings();
            return;
        }
        const msg = res.data?.msg;
        if (msg === "share.get.password_required") {
            pageState.value = "password";
        } else if (msg === "share.get.password_wrong") {
            passwordError.value = true;
            pageState.value = "password";
        } else {
            pageState.value = "notFound";
        }
    } catch {
        pageState.value = "notFound";
    }
};

/** 提交密码 */
const handleSubmitPassword = async () => {
    if (!passwordValue.value.trim()) return;
    submitting.value = true;
    await fetchShare(passwordValue.value.trim());
    submitting.value = false;
};

// ==================== 图片预览 ====================

const contentRef = ref<HTMLElement | null>(null);
const previewSrc = ref("");

/** 内容区点击事件委托：点击图片时打开全屏预览 */
const handleContentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
        previewSrc.value = (target as HTMLImageElement).src;
    }
};

/** 提取标题并分配锚点 ID */
const extractHeadings = () => {
    setTimeout(() => {
        if (!contentRef.value) return;
        const headingEls = contentRef.value.querySelectorAll("h2, h3, h4");
        headingEls.forEach((el, i) => {
            el.id = `heading-${i}`;
        });
    }, 300);
};

onMounted(() => {
    fetchShare();
});
</script>

<template>
  <div
    class="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12"
    style="background-image: radial-gradient(ellipse at 50% 0%, rgba(226, 232, 240, 0.5) 0%, transparent 60%)"
  >
    <div class="mx-auto max-w-3xl">
      <!-- 加载中 -->
      <div v-if="pageState === 'loading'" class="flex items-center justify-center py-24">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      </div>

      <!-- 404：分享不存在或已失效 -->
      <div
        v-else-if="pageState === 'notFound'"
        class="flex flex-col items-center justify-center py-24 text-slate-400"
      >
        <ZIcon name="ri:error-warning-line" :size="40" class="mb-3 opacity-50" />
        <span class="text-sm">{{ t("share.page.not_found") }}</span>
      </div>

      <!-- 密码输入 -->
      <div
        v-else-if="pageState === 'password'"
        class="flex flex-col items-center justify-center py-24"
      >
        <div class="mx-auto w-full max-w-sm rounded-2xl border border-slate-200/70 bg-white p-8 shadow-sm">
          <div class="mb-3 flex items-center justify-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <ZIcon name="ri:lock-line" :size="24" color="#6366f1" />
            </div>
          </div>
          <p class="mb-2 text-center text-sm font-medium text-slate-700">
            {{ t("share.page.password_title") }}
          </p>
          <p v-if="passwordError" class="mb-3 text-center text-xs text-red-500">
            {{ t("share.page.password_wrong") }}
          </p>
          <div class="flex gap-2">
            <input
              v-model="passwordValue"
              type="password"
              :placeholder="t('share.page.password_placeholder')"
              :disabled="submitting"
              class="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
              @keydown.enter="handleSubmitPassword"
            />
            <button
              class="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!passwordValue.trim() || submitting"
              @click="handleSubmitPassword"
            >
              {{ t("share.page.confirm") }}
            </button>
          </div>
        </div>
      </div>

      <!-- 笔记内容 -->
      <template v-else-if="pageState === 'content' && note">
        <!-- 内容卡片 -->
        <div class="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
          <!-- 标题 -->
          <h1 class="mb-2 text-[1.75rem] font-bold tracking-tight text-slate-900">{{ note.title }}</h1>

          <!-- 过期提示 -->
          <p v-if="note.expires_at" class="mb-6 text-xs text-slate-400">
            <ZIcon name="ri:time-line" :size="12" class="mr-1 inline-block opacity-70" />
            {{ t("share.page.expires_at") }}: {{ formatExpiry(note.expires_at) }}
          </p>
          <div v-else class="mb-6 border-b border-slate-100 pb-4" />

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
        </div>

        <!-- 版权信息（同文档系统） -->
        <div class="pb-6 pt-6 text-center text-xs text-slate-400">
          &copy; {{ new Date().getFullYear() }}&nbsp;
          <i18n-t keypath="doc.footer.built_with" tag="span">
            <template #znote>
              <a href="https://github.com/helloxz/znote" target="_blank" class="text-blue-500 hover:underline">ZNote</a>
            </template>
          </i18n-t>
        </div>
      </template>
    </div>
  </div>

  <!-- 图片预览（Lightbox） -->
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
/* Markdown 内容样式（与文档系统 DocNote.vue 完全一致） */
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

.lightbox-fade-enter-active,
.lightbox-fade-leave-active { transition: opacity 0.2s ease; }
.lightbox-fade-enter-from,
.lightbox-fade-leave-to { opacity: 0; }
</style>
