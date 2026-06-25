<script setup lang="ts">
/**
 * 笔记本切换器
 *
 * 设计：左侧 NSelect 下拉（默认展示当前选中笔记本，切换后自动刷新下方分类）
 *      右侧常亮融合蓝的 + 按钮（点击弹窗新建顶层笔记本）
 *
 * Props:
 *   - notebooks: 顶层笔记本列表
 *   - modelValue: 当前选中的笔记本 id
 *
 * Emits:
 *   - update:modelValue: 切换笔记本
 *   - create: 请求新建笔记本
 */
import { computed } from "vue";
import { NConfigProvider, NSelect, darkTheme } from "naive-ui";
import type { GlobalThemeOverrides } from "naive-ui";
import { useI18n } from "vue-i18n";
import ZIcon from "@/components/DynamicIcon.vue";
import type { Notebook } from "@/types/note";

const { t } = useI18n();

const props = defineProps<{
    notebooks: Notebook[];
    modelValue: number | null;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: number): void;
    (e: "create"): void;
}>();

/** 局部暗色主题覆盖：primary 用更亮的 blue-400 系，让选中项在 slate-800 上通透清晰不发虚 */
const darkThemeOverrides: GlobalThemeOverrides = {
    common: {
        primaryColor: "#60a5fa",
        primaryColorHover: "#3b82f6",
        primaryColorPressed: "#2563eb",
        primaryColorSuppl: "#93c5fd",
    },
};

/** NSelect 选项：每项前加 📔 emoji 图标，下拉项和触发器展示两处都显示 */
const selectOptions = computed(() =>
    props.notebooks.map((nb) => ({
        label: `📔 ${nb.title}`,
        value: nb.id,
    })),
);

/** 切换笔记本：选中即触发，父级 handleSwitchNotebook → noteStore.switchNotebook 会自动重置并刷新下方分类 */
const handleChange = (val: number | null) => {
    if (val !== null && val !== undefined) {
        emit("update:modelValue", val);
    }
};

/** 新建顶层笔记本：与原下拉内「+ 新建笔记本」逻辑一致，由父级弹 CreateNotebookDialog */
const handleCreate = () => {
    emit("create");
};
</script>

<template>
  <!-- 局部暗色主题：仅作用于本组件的 NSelect，不污染全局亮色主题；与侧栏 bg-slate-800 融合 -->
  <NConfigProvider :theme="darkTheme" :theme-overrides="darkThemeOverrides">
    <!-- 容器：NSelect（左）+ 新建按钮（右），高度对齐 medium=34px -->
    <div class="flex w-full items-stretch gap-2 py-2 text-sm text-slate-200">
    <!-- 左侧：笔记本下拉选择，默认展示当前选中，切换后自动刷新下方分类 -->
    <NSelect
      class="flex-1"
      size="medium"
      :value="modelValue"
      :options="selectOptions"
      :placeholder="t('note.notebook.switcher.placeholder')"
      @update:value="handleChange"
    />

    <!-- 右侧：常亮融合蓝的 + 按钮，点击弹窗新建顶层笔记本 -->
    <button
      class="flex w-[34px] shrink-0 items-center justify-center rounded bg-blue-500/15 text-blue-300 transition hover:bg-blue-500/25 hover:text-blue-200"
      :title="t('note.notebook.create.button')"
      @click="handleCreate"
    >
      <ZIcon name="ri:add-line" :size="18" color="currentColor" />
    </button>
    </div>
  </NConfigProvider>
</template>
