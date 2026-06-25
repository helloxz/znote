<script setup lang="ts">
/**
 * 分类树节点（递归组件）
 *
 * 支持无限层级，通过 name 引用自身实现递归渲染。
 * 每个节点支持：
 *  - 点击：选中分类
 *  - hover 显示"+"：新建子分类
 *  - 展开/折叠：子节点显示隐藏
 *  - 子节点之间支持同级拖拽排序
 */
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import { VueDraggable } from "vue-draggable-plus";
import ZIcon from "@/components/DynamicIcon.vue";
import { useNoteStore } from "@/stores/note";
import type { NotebookNode } from "@/types/note";

const { t } = useI18n();
const message = useMessage();
const noteStore = useNoteStore();

const props = defineProps<{
    node: NotebookNode;
    /** 当前激活的分类 id */
    activeId: number | null;
    /** 节点在树中的深度（用于样式缩进） */
    level: number;
}>();

const emit = defineEmits<{
    (e: "select", id: number): void;
    (e: "requestDialog", parentId: number, parentName: string): void;
    (e: "contextmenu", node: NotebookNode, event: MouseEvent): void;
}>();

/** 展开/折叠状态 */
const expanded = ref(true);
/** 鼠标是否悬停（用于显示"+"按钮） */
const hovered = ref(false);

/** 是否有子节点 */
const hasChildren = () => props.node.children.length > 0;

/** 切换展开 */
const toggleExpand = (e: Event) => {
    e.stopPropagation();
    if (hasChildren()) {
        expanded.value = !expanded.value;
    }
};

/** 选中节点 */
const handleSelect = () => {
    emit("select", props.node.id);
};

/**
 * 触发新建子分类
 * 不再用 window.prompt，改为向上冒泡 requestDialog 事件，
 * 由 NoteView 统一弹出 CreateNotebookDialog
 */
const handleAddChild = (e: Event) => {
    e.stopPropagation();
    expanded.value = true;
    emit("requestDialog", props.node.id, props.node.title);
};

/**
 * 本地子节点副本（可被 VueDraggable 直接 mutate）
 * 通过 watch 与 props.node.children 保持同步，拖拽完成后用后端返回数据覆盖
 */
const localChildren = ref<NotebookNode[]>([]);

watch(
    () => props.node.children,
    (newChildren) => {
        localChildren.value = [...newChildren];
    },
    { immediate: true },
);

/**
 * 子节点拖拽结束回调
 * VueDraggable 已将新顺序写入 localChildren，据此构建 items 调用后端排序接口
 * 用后端返回数据刷新 store，store 更新后 props 变化会再次同步 localChildren
 */
const onChildDragEnd = async () => {
    const items = localChildren.value.map((n, idx) => ({
        id: n.id,
        sort_order: idx,
    }));
    const result = await noteStore.sortNotebooks(items);
    if (result) {
        message.success(t("notebook.sort.success"));
    } else {
        // 排序失败：回退本地顺序
        localChildren.value = [...props.node.children];
        message.error(t("notebook.sort.failed"));
    }
};
</script>

<template>
  <div class="select-none">
    <!-- 当前节点行 -->
    <div
      class="group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition"
      :class="activeId === node.id ? 'bg-blue-500/15 text-blue-300' : 'text-slate-300 hover:bg-slate-700/60'"
      :style="{ paddingLeft: `${8 + level * 16}px` }"
      @click="handleSelect"
      @contextmenu.prevent="(e: MouseEvent) => emit('contextmenu', node, e)"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <!-- 展开/折叠图标（叶子节点占位保持对齐） -->
      <button
        class="flex h-4 w-4 shrink-0 items-center justify-center rounded transition hover:bg-slate-600/60"
        :class="{ 'opacity-0': !hasChildren() }"
        @click="toggleExpand"
      >
        <ZIcon
          :name="expanded ? 'ri:arrow-down-s-line' : 'ri:arrow-right-s-line'"
          :size="14"
          color="currentColor"
        />
      </button>

      <!-- 文件夹图标 -->
      <ZIcon
        :name="activeId === node.id ? 'ri:folder-open-line' : 'ri:folder-line'"
        :size="15"
        color="currentColor"
        class="shrink-0"
      />

      <!-- 节点标题 -->
      <span class="flex-1 truncate">{{ node.title }}</span>

      <!-- 悬停时显示的"新建子分类"按钮 -->
      <button
        v-show="hovered"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-blue-500/20 hover:text-blue-300"
        :title="t('note.category.add_child')"
        @click="handleAddChild"
      >
        <ZIcon name="ri:add-line" :size="14" color="currentColor" />
      </button>
    </div>

    <!-- 递归渲染子节点，同层兄弟支持拖拽排序（无 group，天然隔离不跨层） -->
    <VueDraggable
      v-if="hasChildren() && expanded"
      v-model="localChildren"
      :animation="150"
      :disabled="noteStore.loading.save"
      @end="onChildDragEnd"
    >
      <CategoryTreeNode
        v-for="child in localChildren"
        :key="child.id"
        :node="child"
        :active-id="activeId"
        :level="level + 1"
        @select="(id: number) => emit('select', id)"
        @request-dialog="(pid: number, pname: string) => emit('requestDialog', pid, pname)"
        @contextmenu="(n: NotebookNode, e: MouseEvent) => emit('contextmenu', n, e)"
      />
    </VueDraggable>
  </div>
</template>

<script lang="ts">
/**
 * 组件名显式声明，Vue 递归组件需要
 */
export default {
    name: "CategoryTreeNode",
};
</script>
