<script setup lang="ts">
/**
 * 分类树容器
 *
 * 职责：
 * 1. 展示当前选中笔记本下的所有子分类（递归树）
 * 2. 转发节点的选中、新建子分类事件给父组件
 * 3. 空态友好提示
 * 4. 顶层兄弟节点之间支持同级拖拽排序
 *
 * Props:
 *   - tree: 当前笔记本的 children（已经过滤过）
 *   - activeId: 当前选中的分类 id
 *
 * Emits:
 *   - select: 选中分类
 *   - addChild: 新建子分类
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import { VueDraggable } from "vue-draggable-plus";
import ZIcon from "@/components/DynamicIcon.vue";
import CategoryTreeNode from "@/components/note/CategoryTreeNode.vue";
import { useNoteStore } from "@/stores/note";
import type { NotebookNode } from "@/types/note";

const { t } = useI18n();
const message = useMessage();
const noteStore = useNoteStore();

const props = defineProps<{
    /** 当前笔记本的 children（已经过滤过） */
    tree: NotebookNode[];
    activeId: number | null;
}>();

const emit = defineEmits<{
    (e: "select", id: number): void;
    (e: "addChild", id: number, title: string): void;
    (e: "requestDialog", parentId: number, parentName: string): void;
    (e: "contextmenu", node: NotebookNode, event: MouseEvent): void;
}>();

/** 是否为空 */
const isEmpty = computed(() => props.tree.length === 0);

/**
 * 本地分类树副本（可被 VueDraggable 直接 mutate）
 * 通过 watch 与 props.tree 保持同步，拖拽完成后用后端返回数据覆盖
 */
const localTree = ref<NotebookNode[]>([]);

watch(
    () => props.tree,
    (newTree) => {
        localTree.value = [...newTree];
    },
    { immediate: true },
);

/**
 * 拖拽结束回调
 * VueDraggable 已将新顺序写入 localTree，据此构建 items 调用后端排序接口
 * 用后端返回数据刷新 store，store 更新后 props 变化会再次同步 localTree
 */
const onDragEnd = async () => {
    const items = localTree.value.map((n, idx) => ({
        id: n.id,
        sort_order: idx,
    }));
    const result = await noteStore.sortNotebooks(items);
    if (result) {
        message.success(t("notebook.sort.success"));
    } else {
        // 排序失败：回退本地顺序
        localTree.value = [...props.tree];
        message.error(t("notebook.sort.failed"));
    }
};
</script>

<template>
  <div class="space-y-0.5">
    <!-- 有分类时递归渲染，顶层节点支持同级拖拽排序 -->
    <template v-if="!isEmpty">
      <VueDraggable
        v-model="localTree"
        :animation="150"
        :disabled="noteStore.loading.save"
        @end="onDragEnd"
      >
        <CategoryTreeNode
          v-for="node in localTree"
          :key="node.id"
          :node="node"
          :active-id="activeId"
          :level="0"
          @select="(id: number) => emit('select', id)"
          @add-child="(id: number, title: string) => emit('addChild', id, title)"
          @request-dialog="(pid: number, pname: string) => emit('requestDialog', pid, pname)"
          @contextmenu="(node: NotebookNode, e: MouseEvent) => emit('contextmenu', node, e)"
        />
      </VueDraggable>
    </template>

    <!-- 空态提示 -->
    <div v-else class="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/60">
        <ZIcon name="ri:folder-open-line" :size="20" color="#94a3b8" />
      </div>
      <p class="text-xs text-slate-400">{{ t("note.category.empty") }}</p>
    </div>
  </div>
</template>
