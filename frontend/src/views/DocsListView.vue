<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import req from "@/utils/req";
import ZIcon from "@/components/DynamicIcon.vue";

const { t } = useI18n();

interface DocItem {
    id: number;
    notebook_id: number;
    slug: string;
    title: string;
    description: string;
    keywords: string;
    created_at: string;
    updated_at: string;
    notebook_title: string;
    notebook_description: string;
}

const docs = ref<DocItem[]>([]);
const loading = ref(true);
const error = ref("");

const getDisplayTitle = (doc: DocItem) => doc.title || doc.notebook_title || "";
const getDisplayDescription = (doc: DocItem) => doc.description || doc.notebook_description || "";

const getKeywords = (doc: DocItem): string[] => {
    if (!doc.keywords) return [];
    return doc.keywords.split(",").map((k) => k.trim()).filter(Boolean);
};

const goToDoc = (slug: string) => {
    window.open(`/doc/${slug}`, "_blank");
};

onMounted(async () => {
    try {
        const res = await req.get("/api/docs");
        if (res.data?.code === 200) {
            docs.value = res.data.data || [];
        } else {
            error.value = t("doc.list.empty");
        }
    } catch {
        error.value = t("doc.list.empty");
    } finally {
        loading.value = false;
    }
});
</script>

<template>
  <div
    class="flex min-h-screen flex-col bg-slate-50"
    style="background-image: radial-gradient(ellipse at top, rgba(59,130,246,0.04), transparent 60%);"
  >
    <!-- 加载中 -->
    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center"
    >
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
    </div>

    <!-- 错误 -->
    <div
      v-else-if="error"
      class="flex flex-1 flex-col items-center justify-center text-slate-500"
    >
      <ZIcon name="ri:error-warning-line" :size="48" class="mb-4 opacity-40" />
      <p class="text-sm">{{ error }}</p>
    </div>

    <!-- 正常内容 -->
    <template v-else>
      <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6 sm:py-20">
        <!-- 标题区 -->
        <div class="mb-12 text-center">
          <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-500 ring-1 ring-blue-200/60">
            <ZIcon name="ri:book-open-line" :size="32" />
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
            {{ t("doc.list.title") }}
          </h1>
          <p class="mt-2 text-sm text-slate-400">
            {{ t("doc.list.subtitle") }}
          </p>
        </div>

        <!-- 空状态 -->
        <div
          v-if="docs.length === 0"
          class="flex flex-col items-center justify-center py-24 text-slate-400"
        >
          <ZIcon name="ri:file-text-line" :size="48" class="mb-3 opacity-40" />
          <span class="text-sm">{{ t("doc.list.empty") }}</span>
        </div>

        <!-- 卡片网格 -->
        <div
          v-else
          class="grid grid-cols-1 gap-6 sm:grid-cols-2"
        >
          <div
            v-for="doc in docs"
            :key="doc.id"
            class="group cursor-pointer rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10"
            @click="goToDoc(doc.slug)"
          >
            <!-- 图标 -->
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500 ring-1 ring-blue-100 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
              <ZIcon name="ri:file-text-line" :size="24" />
            </div>

            <!-- 标题 + slug -->
            <h3 class="text-lg font-semibold text-slate-800 transition-colors group-hover:text-blue-600">
              {{ getDisplayTitle(doc) }}
            </h3>
            <p class="mt-1 text-xs text-slate-400 font-mono">
              {{ doc.slug }}
            </p>

            <!-- 描述 -->
            <p
              v-if="getDisplayDescription(doc)"
              class="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500"
            >
              {{ getDisplayDescription(doc) }}
            </p>

            <!-- 关键词标签 -->
            <div
              v-if="getKeywords(doc).length > 0"
              class="mt-4 flex flex-wrap gap-1.5"
            >
              <span
                v-for="kw in getKeywords(doc)"
                :key="kw"
                class="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200/60"
              >
                {{ kw }}
              </span>
            </div>

            <!-- hover 引导 -->
            <div class="mt-5 flex items-center text-xs font-medium text-blue-500 opacity-0 transition-all duration-200 group-hover:opacity-100">
              <span>{{ t("doc.list.view") }}</span>
              <ZIcon name="ri:arrow-right-line" :size="14" class="ml-1" />
            </div>
          </div>
        </div>
      </main>

      <!-- 版权信息 -->
      <footer class="pb-6 text-center text-xs text-slate-400">
        &copy; {{ new Date().getFullYear() }}&nbsp;
        <i18n-t keypath="doc.footer.built_with" tag="span">
          <template #znote>
            <a href="https://github.com/helloxz/znote" target="_blank" class="text-blue-500 hover:underline">ZNote</a>
          </template>
        </i18n-t>
      </footer>
    </template>
  </div>
</template>