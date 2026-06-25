<script setup lang="ts">
/**
 * 笔记工作台主页面
 *
 * 三栏布局（Col-1 / Col-2 宽度可拖拽，持久化到 localStorage）：
 *   Col-1：用户信息 + 笔记本下拉 + "我的笔记"标题栏 + 分类树
 *   Col-2：搜索 + 新建笔记 + 笔记列表
 *   Col-3（flex-1）：笔记标题 + 元信息 + Markdown 编辑器
 *
 * 核心状态由 stores/note.ts 统一管理，本组件只负责编排和事件转发。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NSpin, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import ZIcon from "@/components/DynamicIcon.vue";
import UserHeader from "@/components/note/UserHeader.vue";
import NotebookSwitcher from "@/components/note/NotebookSwitcher.vue";
import CategoryTree from "@/components/note/CategoryTree.vue";
import NoteList from "@/components/note/NoteList.vue";
import NoteEditor from "@/components/note/NoteEditor.vue";
import NoteMetaBar from "@/components/note/NoteMetaBar.vue";
import CreateNotebookDialog from "@/components/note/dialogs/CreateNotebookDialog.vue";
import ImportDialog from "@/components/note/dialogs/ImportDialog.vue";
import MoveDialog from "@/components/note/dialogs/MoveDialog.vue";
import DeleteNotebookDialog from "@/components/note/dialogs/DeleteNotebookDialog.vue";
import VersionHistoryDialog from "@/components/note/dialogs/VersionHistoryDialog.vue";
import CategoryContextMenu from "@/components/note/CategoryContextMenu.vue";
import { useNoteStore } from "@/stores/note";
import { useUserStore } from "@/stores/user";
import { fetchNoteVersion } from "@/api/note";
import { NModal, NInput, NAlert } from "naive-ui";
import type { NotebookNode } from "@/types/note";
import type { CategoryContextAction } from "@/components/note/CategoryContextMenu.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const message = useMessage();
const noteStore = useNoteStore();
const userStore = useUserStore();

// ==================== 移动端检测 ====================

/** 是否为移动端视口（≤768px） */
const isMobile = ref(false);
const mediaQuery = window.matchMedia?.("(max-width: 768px)");
if (mediaQuery) {
    isMobile.value = mediaQuery.matches;
    const onMediaChange = (e: MediaQueryListEvent) => { isMobile.value = e.matches; };
    mediaQuery.addEventListener("change", onMediaChange);
    onBeforeUnmount(() => mediaQuery.removeEventListener("change", onMediaChange));
}

/** 移动端侧边栏抽屉开关 */
const drawerOpen = ref(false);

// ==================== 路由同步 ====================

/**
 * 监听路由 noteId 参数，同步到 store（浏览器前进/后退）
 * 不使用 immediate，首屏由 onMounted 的 deep-link 逻辑统一处理
 */
watch(
    () => route.params.noteId,
    (noteId) => {
        if (noteId) {
            const numId = Number(noteId);
            if (Number.isFinite(numId) && numId !== noteStore.activeNoteId) {
                noteStore.selectNote(numId);
            }
        } else {
            noteStore.selectNote(null);
        }
    },
);

// ==================== 弹窗控制 ====================

/** 新建笔记本 Dialog 显隐 */
const showCreateNotebook = ref(false);
/** 新建子分类 Dialog 显隐 */
const showCreateCategory = ref(false);
/** 导入 Dialog 显隐 */
const showImportDialog = ref(false);
/** 新建子分类时，传入的父分类信息 */
const newCategoryParent = ref<{ id: number; name: string } | null>(null);

// ==================== 分类右键菜单 ====================

/** 分类右键菜单显隐 */
const categoryMenuShow = ref(false);
/** 分类右键菜单位置 X */
const categoryMenuX = ref(0);
/** 分类右键菜单位置 Y */
const categoryMenuY = ref(0);
/** 当前右键的分类节点 */
const categoryMenuNode = ref<NotebookNode | null>(null);

/** 重命名 Dialog 显隐 */
const showRenameDialog = ref(false);
/** 重命名输入框值 */
const renameValue = ref("");
/** 重命名目标节点 */
const renameTarget = ref<NotebookNode | null>(null);

/** 删除分类 Dialog 显隐 */
const showDeleteDialog = ref(false);
/** 删除目标节点 */
const deleteTarget = ref<NotebookNode | null>(null);

// ==================== 移动弹窗 ====================

/** 移动弹窗显隐 */
const showMoveDialog = ref(false);
/** 移动类型 */
const moveDialogType = ref<"note" | "category">("category");
/** 被移动实体 ID */
const moveSourceId = ref(0);
/** 被移动实体名称 */
const moveSourceName = ref("");
/** 需要排除的目标节点 ID（移动分类时为自身及子孙） */
const moveExcludeIds = ref<number[]>([]);
/** 当前所在分类 ID（高亮标记） */
const moveCurrentCategoryId = ref<number | null>(null);

// ==================== 历史版本抽屉 ====================

/** 历史版本抽屉显隐 */
const showVersionHistory = ref(false);

// ==================== 历史版本查看模式 ====================

/** 是否处于历史版本查看模式（控制【回到当前】按钮 + 警告条显隐） */
const viewingVersion = ref(false);
/** 当前查看的版本号（警告条展示用） */
const viewingVersionNo = ref<number | null>(null);
/** 最初的实际内容备份（仅首次进入查看模式时存，用于回到当前） */
const versionBackup = ref<{ title: string; content: string } | null>(null);

/**
 * 查看某个历史版本
 * 拉取详情 → 备份当前实际内容（仅首次）→ 替换编辑器内容 → 关闭抽屉
 */
const handleViewVersion = async (versionId: number) => {
    const res = await fetchNoteVersion(versionId);
    if (!res) return;

    // 仅首次进入查看模式时备份当前实际内容，后续切换版本不动备份
    if (versionBackup.value === null) {
        versionBackup.value = {
            title: draftTitle.value,
            content: draftContent.value,
        };
    }

    // 替换编辑器内容为历史版本
    draftTitle.value = res.title;
    draftContent.value = res.content;
    viewingVersionNo.value = res.version_no;
    viewingVersion.value = true;

    // 关闭抽屉，回到编辑器预览
    showVersionHistory.value = false;
};

/**
 * 回到当前：从备份还原编辑器内容，退出查看模式
 */
const handleBackToCurrent = () => {
    if (versionBackup.value) {
        draftTitle.value = versionBackup.value.title;
        draftContent.value = versionBackup.value.content;
    }
    versionBackup.value = null;
    viewingVersion.value = false;
    viewingVersionNo.value = null;
};

/**
 * 递归收集节点的所有子孙 id（用于构建排除列表）
 */
const collectDescendantIds = (rootId: number, tree: NotebookNode[]): number[] => {
    for (const node of tree) {
        if (node.id === rootId) {
            const ids: number[] = [node.id];
            const collect = (n: NotebookNode) => {
                for (const child of n.children) {
                    ids.push(child.id);
                    collect(child);
                }
            };
            collect(node);
            return ids;
        }
        if (node.children.length > 0) {
            const found = collectDescendantIds(rootId, node.children);
            if (found.length > 0) return found;
        }
    }
    return [];
};

// ==================== 编辑器草稿状态 ====================

/** 当前编辑中的标题（暂存，保存后写回 store） */
const draftTitle = ref("");
/** 当前编辑中的内容（暂存，保存后写回 store） */
const draftContent = ref("");
/** 保存按钮 loading 态 */
const isSaving = ref(false);
/** 标题输入框 ref（用于自动聚焦） */
const titleInputRef = ref<HTMLInputElement | null>(null);

// ==================== 侧边栏可调宽度 ====================

/** 第一栏宽度（px），从 localStorage 恢复 */
const col1Width = ref(240);
/** 第二栏宽度（px），从 localStorage 恢复 */
const col2Width = ref(320);

/** 宽度约束（px） */
const COL1_MIN = 200;
const COL1_MAX = 420;
const COL2_MIN = 240;
const COL2_MAX = 520;

/** 限制宽度在合理范围内 */
const clamp1 = (w: number) => Math.max(COL1_MIN, Math.min(COL1_MAX, w));
const clamp2 = (w: number) => Math.max(COL2_MIN, Math.min(COL2_MAX, w));

/**
 * 开始拖拽调整列宽
 * @param col 1 = 第一栏，2 = 第二栏
 */
const startResize = (col: 1 | 2, e: MouseEvent) => {
    // 防止拖拽选中文本
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startW = col === 1 ? col1Width.value : col2Width.value;

    const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        if (col === 1) {
            col1Width.value = clamp1(startW + delta);
        } else {
            col2Width.value = clamp2(startW + delta);
        }
    };

    const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        // 持久化到 localStorage
        localStorage.setItem("note-col1-width", String(col1Width.value));
        localStorage.setItem("note-col2-width", String(col2Width.value));
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
};

// ==================== 计算属性 ====================

/** 当前选中笔记本的子分类树（用于 CategoryTree） */
const currentCategoryTree = computed<NotebookNode[]>(() => {
    return noteStore.activeNotebook?.children ?? [];
});

/** 当前激活的笔记所在分类名（用于元信息条） */
const activeCategoryName = computed(() => {
    const cat = noteStore.activeCategory;
    return cat?.title ?? "-";
});

/** 是否有选中的笔记（用于第三栏 / 移动端编辑器切换；仅检查 activeNoteId，加载中的 editor 区展示 loading） */
const hasActiveNote = computed(() => noteStore.activeNoteId !== null);

/** 笔记详情是否加载中 */
const noteDetailLoading = computed(() => noteStore.loading.noteDetail);

// ==================== 数据加载 ====================

/**
 * 页面挂载时：
 * 1. 恢复侧边栏宽度
 * 2. 检查登录态
 * 3. 加载用户信息
 * 4. 加载笔记本树
 */
onMounted(async () => {
    // 从 localStorage 恢复列宽
    const w1 = localStorage.getItem("note-col1-width");
    const w2 = localStorage.getItem("note-col2-width");
    if (w1) col1Width.value = clamp1(Number(w1));
    if (w2) col2Width.value = clamp2(Number(w2));

    const ok = await userStore.checkLogin();
    if (!ok) return;

    await userStore.getUserInfo();
    await noteStore.loadNotebookTree();

    // Deep-link：URL 带有 noteId 但笔记不在缓存中时，自动定位到所属分类并加载
    if (route.params.noteId && !noteStore.activeNote) {
        await noteStore.locateAndSelectNote(Number(route.params.noteId));
    }

    // 注册全局快捷键：Ctrl+S / Cmd+S 保存
    window.addEventListener("keydown", handleSaveShortcut);
});

/** 组件卸载时清理键盘监听 */
onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleSaveShortcut);
});

/** 路由 query 变化时支持深链（可选） */
watch(
    () => route.query,
    () => {
        // 占位：未来支持 ?note=123 这种深链
    },
);

// ==================== 事件处理 ====================

/** 路由跳转（UserHeader 菜单） */
const handleNavigate = (path: string) => {
    void router.push(path);
};

/** 切换顶层笔记本（移动端同步关闭抽屉） */
const handleSwitchNotebook = (id: number | null) => {
    if (id !== null) {
        noteStore.switchNotebook(id);
        if (isMobile.value) drawerOpen.value = false;
    }
};

/** 打开"新建笔记本"Dialog */
const handleOpenCreateNotebook = () => {
    showCreateNotebook.value = true;
};

/** 提交"新建笔记本" */
const handleConfirmCreateNotebook = async (title: string) => {
    const result = await noteStore.createNotebook({ title, parent_id: null });
    if (result) {
        showCreateNotebook.value = false;
        // 自动切换到新建的笔记本
        noteStore.switchNotebook(result.id);
    } else {
        showCreateNotebook.value = false;
    }
};

/** 选中分类（移动端同步关闭抽屉） */
const handleSelectCategory = async (id: number) => {
    await noteStore.selectCategory(id);
    if (isMobile.value) drawerOpen.value = false;
};

/** 打开"新建子分类"Dialog（用 Dialog 方式，由"我的笔记"标题栏触发） */
const handleAddTopCategory = () => {
    if (noteStore.activeNotebookId === null) return;
    const nb = noteStore.activeNotebook;
    if (!nb) return;
    newCategoryParent.value = { id: nb.id, name: nb.title };
    showCreateCategory.value = true;
};

/** 分类节点右键菜单 */
const handleCategoryContextMenu = (node: NotebookNode, e: MouseEvent) => {
    categoryMenuNode.value = node;
    categoryMenuX.value = e.clientX;
    categoryMenuY.value = e.clientY;
    categoryMenuShow.value = true;
};

/** 分类右键菜单选中 */
const handleCategoryMenuSelect = (action: CategoryContextAction, node: NotebookNode) => {
    if (action === "rename") {
        renameValue.value = node.title;
        renameTarget.value = node;
        showRenameDialog.value = true;
    } else if (action === "move") {
        moveDialogType.value = "category";
        moveSourceId.value = node.id;
        moveSourceName.value = node.title;
        moveExcludeIds.value = collectDescendantIds(node.id, noteStore.notebookTree);
        moveCurrentCategoryId.value = node.id;
        showMoveDialog.value = true;
    } else if (action === "delete") {
        deleteTarget.value = node;
        showDeleteDialog.value = true;
    }
};

/** 确认重命名 */
const handleConfirmRename = async () => {
    if (!renameTarget.value || !renameValue.value.trim()) return;
    const result = await noteStore.updateNotebook(renameTarget.value.id, { title: renameValue.value.trim() });
    if (result) {
        message.success(t("note.category.rename.success"));
    }
    showRenameDialog.value = false;
};

/** 确认删除分类 */
const handleConfirmDelete = async () => {
    if (!deleteTarget.value) return;
    const result = await noteStore.deleteNotebooks([deleteTarget.value.id]);
    if (result) {
        message.success(t("note.category.delete.success"));
    }
    showDeleteDialog.value = false;
};

/** 确认移动 */
const handleMoveConfirm = async (targetId: number) => {
    if (moveDialogType.value === "category") {
        await noteStore.moveCategory(moveSourceId.value, targetId);
        message.success(t("note.move.success"));
    }
    showMoveDialog.value = false;
};

/** 取消移动 */
const handleMoveCancel = () => {
    showMoveDialog.value = false;
};

/** 打开"新建子分类"Dialog（由 CategoryTree 节点 requestDialog 触发） */
const openCreateCategoryDialog = (parentId: number, parentName: string) => {
    newCategoryParent.value = { id: parentId, name: parentName };
    showCreateCategory.value = true;
};

/** 实际创建子分类 */
const doCreateCategory = async (parentId: number, title: string) => {
    const result = await noteStore.createNotebook({ title, parent_id: parentId });
    if (result) {
        // 选中新建的分类
        await noteStore.selectCategory(result.id);
    }
};

/** 提交"新建子分类" */
const handleConfirmCreateCategory = async (title: string) => {
    if (!newCategoryParent.value) return;
    await doCreateCategory(newCategoryParent.value.id, title);
    showCreateCategory.value = false;
};

/**
 * 新建笔记（内联方式）
 * 直接创建一个未命名笔记，自动选中，然后聚焦标题让用户改名
 */
const handleOpenCreateNote = async () => {
    if (noteStore.activeCategoryId === null) {
        message.warning(t("note.note.create.placeholder"));
        return;
    }
    const result = await noteStore.createNote({
        notebook_id: noteStore.activeCategoryId,
        title: t("note.note.untitled"),
        content: "",
    });
    if (result) {
        noteStore.selectNote(result.id);
        // 聚焦标题输入框让用户立即改名
        await nextTick();
        titleInputRef.value?.focus();
    }
};

/** 选中笔记（同时更新 URL；await 等待 selectNote 内部数据就绪后再路由） */
const handleSelectNote = async (id: number) => {
    await noteStore.selectNote(id);
    router.push(`/note/${id}`);
};

/** 移动端返回笔记列表 */
const handleMobileBack = () => {
    drawerOpen.value = false;
    router.back();
};

/**
 * 同步草稿状态
 * 监听 activeNote 而非 activeNoteId，避免 selectNote async 期间提前 flush 空白数据
 */
watch(
    () => noteStore.activeNote,
    (note) => {
        draftTitle.value = note?.title ?? "";
        draftContent.value = note?.content ?? "";
    },
);

/** 编辑器内容变更 → 暂存到草稿 */
const handleEditorChange = (value: string) => {
    draftContent.value = value;
};

/** 保存笔记（标题 + 内容） */
const handleSaveNote = async () => {
    if (noteStore.activeNoteId === null) return;
    isSaving.value = true;
    try {
        await noteStore.updateNote(noteStore.activeNoteId, {
            title: draftTitle.value,
            content: draftContent.value,
        });
        // 轻量提示
        message.success(t("note.editor.saved"));

        // 保存成功后自动退出历史查看模式（保存即回滚生效，内容已成新当前态）
        if (viewingVersion.value) {
            versionBackup.value = null;
            viewingVersion.value = false;
            viewingVersionNo.value = null;
        }
    } catch {
        message.error(t("note.editor.save_failed"));
    } finally {
        isSaving.value = false;
    }
};

/**
 * 全局快捷键：Ctrl+S（Windows/Linux） / Cmd+S（macOS）保存笔记
 * 仅在有选中笔记时生效；屏蔽浏览器默认的"另存为"弹窗
 */
const handleSaveShortcut = (e: KeyboardEvent) => {
    const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !e.shiftKey && !e.altKey;
    if (!isSave) return;
    e.preventDefault();
    if (noteStore.activeNoteId === null || isSaving.value) return;
    void handleSaveNote();
};

/** 标题失焦时自动保存标题 */
const handleSaveTitle = async () => {
    if (noteStore.activeNoteId === null) return;
    const trimmed = draftTitle.value.trim();
    if (!trimmed) {
        // 标题不能为空，回退到原值
        draftTitle.value = noteStore.activeNote?.title ?? t("note.note.untitled");
        return;
    }
    // 仅标题有变化时才保存
    if (trimmed !== noteStore.activeNote?.title) {
        isSaving.value = true;
        try {
            await noteStore.updateNote(noteStore.activeNoteId, { title: trimmed });
        } finally {
            isSaving.value = false;
        }
    }
};
</script>

<template>
  <!-- ==================== 桌面端：三栏布局 ==================== -->
  <div v-if="!isMobile" class="flex h-screen w-screen overflow-hidden bg-[#f7f8fa]">
    <!-- ==================== 第一栏：导航 ==================== -->
    <aside
      :style="{ width: col1Width + 'px' }"
      class="flex shrink-0 flex-col border-r border-slate-700/60 bg-slate-800 text-slate-200"
    >
      <!-- 用户信息 -->
      <div class="border-b border-slate-700/60 p-3">
        <UserHeader @navigate="handleNavigate" />
      </div>

      <!-- 笔记本下拉 + 新建按钮 -->
      <div class="border-b border-slate-700/60 px-2 py-3">
        <NotebookSwitcher
          :notebooks="noteStore.notebookTree"
          :model-value="noteStore.activeNotebookId"
          @update:model-value="handleSwitchNotebook"
          @create="handleOpenCreateNotebook"
        />
      </div>

      <!-- 分类区域标题栏：我的笔记 + 导入按钮 + 新建分类按钮 -->
      <div class="flex items-center justify-between border-b border-slate-700/60 px-2 py-2">
        <span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          {{ t("note.category.header") }}
        </span>
        <div class="flex items-center gap-1">
          <button
            class="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-700/60 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="noteStore.activeNotebookId === null"
            :title="t('import.title')"
            @click="showImportDialog = true"
          >
            <ZIcon name="ri:upload-line" :size="14" color="currentColor" />
          </button>
          <button
            class="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-700/60 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="noteStore.activeNotebookId === null"
            :title="t('note.category.add_child')"
            @click="handleAddTopCategory"
          >
            <ZIcon name="ri:add-line" :size="14" color="currentColor" />
          </button>
        </div>
      </div>

      <!-- 分类树 -->
      <div class="flex-1 overflow-y-auto p-2">
        <NSpin v-if="noteStore.loading.tree" class="block py-6" />
        <CategoryTree
          v-else
          :tree="currentCategoryTree"
          :active-id="noteStore.activeCategoryId"
          @select="handleSelectCategory"
          @request-dialog="(pid: number, pname: string) => openCreateCategoryDialog(pid, pname)"
          @contextmenu="handleCategoryContextMenu"
        />
      </div>
    </aside>

    <!-- 第一栏右侧拖拽把手 -->
    <div class="resize-handle" @mousedown="(e) => startResize(1, e)" />

    <!-- ==================== 第二栏：笔记列表 ==================== -->
    <aside
      :style="{ width: col2Width + 'px' }"
      class="flex shrink-0 flex-col border-r border-slate-200/60 bg-white"
    >
      <NoteList
        :notes="noteStore.displayedNotes"
        :active-id="noteStore.activeNoteId"
        :loading="noteStore.loading.notes"
        :disabled-create="noteStore.activeCategoryId === null"
        @select="handleSelectNote"
        @create="handleOpenCreateNote"
      />
    </aside>

    <!-- 第二栏右侧拖拽把手 -->
    <div class="resize-handle" @mousedown="(e) => startResize(2, e)" />

    <!-- ==================== 第三栏：编辑器 ==================== -->
    <main class="flex flex-1 flex-col overflow-hidden bg-white">
      <!-- 选中笔记时：编辑器 -->
      <template v-if="noteStore.activeNote">
        <!-- 顶部：可编辑标题 + 元信息 -->
        <div class="shrink-0 bg-white px-8 py-4">
          <input
            ref="titleInputRef"
            v-model="draftTitle"
            :placeholder="t('note.editor.placeholder')"
            type="text"
            class="note-title-input"
            @blur="handleSaveTitle"
            @keydown.enter="($event.target as HTMLElement).blur()"
          />
          <div class="mt-2">
            <NoteMetaBar
              :note="noteStore.activeNote"
              :category-name="activeCategoryName"
              :saving="isSaving"
              :viewing-version="viewingVersion"
              @save="handleSaveNote"
              @history="showVersionHistory = true"
              @back-to-current="handleBackToCurrent"
            />
          </div>

          <!-- 历史版本查看警告条 -->
          <NAlert
            v-if="viewingVersion"
            type="warning"
            show-icon
            class="mt-2"
            :show-arrow="false"
          >
            {{ t("note.version.viewing_warning", { version: viewingVersionNo }) }}
          </NAlert>
        </div>

        <!-- 编辑器主体 -->
        <div class="flex-1 overflow-hidden bg-white px-8 pb-6 pt-0">
          <NoteEditor
            :model-value="draftContent"
            height="100%"
            @update:model-value="handleEditorChange"
          />
        </div>
      </template>

      <!-- 笔记加载中 -->
      <div v-else-if="hasActiveNote && noteDetailLoading" class="flex flex-1 items-center justify-center bg-white">
        <NSpin size="medium" />
      </div>

      <!-- 未选中时：空态 -->
      <div v-else class="flex flex-1 items-center justify-center bg-white">
        <div class="flex flex-col items-center gap-3 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <ZIcon name="ri:notebook-2-line" :size="32" color="#94a3b8" />
          </div>
          <div>
            <p class="text-base font-medium text-slate-700">{{ t("note.empty.workspace.title") }}</p>
            <p class="mt-1 text-sm text-slate-400">{{ t("note.empty.workspace.desc") }}</p>
          </div>
        </div>
      </div>
    </main>

    <!-- ==================== 分类右键菜单 ==================== -->
    <CategoryContextMenu
      v-model:show="categoryMenuShow"
      :x="categoryMenuX"
      :y="categoryMenuY"
      :node="categoryMenuNode"
      @select="handleCategoryMenuSelect"
    />

    <!-- ==================== 重命名分类 Dialog ==================== -->
    <NModal
      v-model:show="showRenameDialog"
      preset="dialog"
      :title="t('note.category.rename.title')"
      :positive-text="t('note.dialog.confirm')"
      :negative-text="t('note.dialog.cancel')"
      :mask-closable="false"
      @positive-click="handleConfirmRename"
      @negative-click="showRenameDialog = false"
    >
      <NInput
        v-model:value="renameValue"
        :placeholder="t('note.category.rename.placeholder')"
        autofocus
        @keydown.enter="handleConfirmRename"
      />
    </NModal>

    <!-- ==================== 删除分类 Dialog ==================== -->
    <DeleteNotebookDialog
      v-model:show="showDeleteDialog"
      :node="deleteTarget"
      @confirm="handleConfirmDelete"
    />

    <!-- ==================== 移动弹窗 ==================== -->
    <MoveDialog
      v-model:show="showMoveDialog"
      :type="moveDialogType"
      :source-id="moveSourceId"
      :source-name="moveSourceName"
      :notebook-tree="currentCategoryTree"
      :exclude-node-ids="moveExcludeIds"
      :current-category-id="moveCurrentCategoryId ?? undefined"
      @confirm="handleMoveConfirm"
      @cancel="handleMoveCancel"
    />

    <!-- ==================== Dialogs ==================== -->
    <!-- 新建笔记本 -->
    <CreateNotebookDialog
      v-model:show="showCreateNotebook"
      :parent-id="null"
      @confirm="handleConfirmCreateNotebook"
    />

    <!-- 新建子分类 -->
    <CreateNotebookDialog
      v-model:show="showCreateCategory"
      :parent-id="newCategoryParent?.id ?? null"
      :parent-name="newCategoryParent?.name"
      @confirm="handleConfirmCreateCategory"
    />

    <!-- 导入 ZIP -->
    <ImportDialog
      v-model:show="showImportDialog"
      :notebook-id="noteStore.activeNotebookId"
    />

    <!-- 历史版本抽屉 -->
    <VersionHistoryDialog
      v-model:show="showVersionHistory"
      :note-id="noteStore.activeNoteId"
      @view="handleViewVersion"
    />
  </div>

  <!-- ==================== 移动端：单栏切换布局 ==================== -->
  <div v-else class="flex h-screen w-screen flex-col overflow-hidden bg-white">
    <!-- 顶部导航栏 -->
    <div class="flex shrink-0 items-center gap-2 border-b border-slate-200/60 px-3 py-2">
      <button
        v-if="!hasActiveNote"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-600 transition hover:bg-slate-100"
        :title="t('note.mobile.menu')"
        @click="drawerOpen = !drawerOpen"
      >
        <ZIcon name="ri:menu-line" :size="20" color="currentColor" />
      </button>
      <button
        v-else
        class="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-sm text-blue-600 transition hover:bg-blue-50"
        @click="handleMobileBack"
      >
        <ZIcon name="ri:arrow-left-line" :size="18" color="currentColor" />
        <span>{{ t("note.mobile.back") }}</span>
      </button>
      <span class="truncate text-sm font-medium text-slate-700">ZNote</span>
    </div>

    <!-- 侧边栏抽屉（Teleport 到 body 避免层叠上下文问题） -->
    <Teleport to="body">
      <div
        v-show="drawerOpen"
        class="fixed inset-0 z-50"
        @click.self="drawerOpen = false"
      >
        <div class="absolute inset-0 bg-black/40" @click="drawerOpen = false" />
        <div class="absolute left-0 top-0 bottom-0 flex w-72 flex-col bg-slate-800 text-slate-200 shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-700/60 px-3 py-3">
            <span class="text-sm font-medium">ZNote</span>
            <button
              class="rounded p-1 text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-200"
              @click="drawerOpen = false"
            >
              <ZIcon name="ri:close-line" :size="18" color="currentColor" />
            </button>
          </div>
          <div class="border-b border-slate-700/60 p-3">
            <UserHeader @navigate="(path: string) => { drawerOpen = false; handleNavigate(path); }" />
          </div>
          <div class="border-b border-slate-700/60 px-2 py-3">
            <NotebookSwitcher
              :notebooks="noteStore.notebookTree"
              :model-value="noteStore.activeNotebookId"
              @update:model-value="handleSwitchNotebook"
              @create="handleOpenCreateNotebook"
            />
          </div>
          <div class="flex items-center justify-between border-b border-slate-700/60 px-2 py-2">
            <span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              {{ t("note.category.header") }}
            </span>
            <div class="flex items-center gap-1">
              <button
                class="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-700/60 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="noteStore.activeNotebookId === null"
                :title="t('import.title')"
                @click="showImportDialog = true"
              >
                <ZIcon name="ri:upload-line" :size="14" color="currentColor" />
              </button>
              <button
                class="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-700/60 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="noteStore.activeNotebookId === null"
                :title="t('note.category.add_child')"
                @click="handleAddTopCategory"
              >
                <ZIcon name="ri:add-line" :size="14" color="currentColor" />
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <NSpin v-if="noteStore.loading.tree" class="block py-6" />
            <CategoryTree
              v-else
              :tree="currentCategoryTree"
              :active-id="noteStore.activeCategoryId"
              @select="handleSelectCategory"
              @request-dialog="(pid: number, pname: string) => openCreateCategoryDialog(pid, pname)"
              @contextmenu="handleCategoryContextMenu"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 笔记列表视图（无选中笔记时） -->
    <div v-if="!hasActiveNote" class="flex flex-1 flex-col overflow-hidden">
      <NoteList
        :notes="noteStore.displayedNotes"
        :active-id="noteStore.activeNoteId"
        :loading="noteStore.loading.notes"
        :disabled-create="noteStore.activeCategoryId === null"
        @select="handleSelectNote"
        @create="handleOpenCreateNote"
      />
    </div>

    <!-- 编辑器视图（有选中笔记时） -->
    <main v-else class="flex flex-1 flex-col overflow-hidden bg-white">
      <template v-if="noteStore.activeNote">
        <div class="shrink-0 bg-white px-4 py-3">
          <input
            ref="titleInputRef"
            v-model="draftTitle"
            :placeholder="t('note.editor.placeholder')"
            type="text"
            class="note-title-input"
            @blur="handleSaveTitle"
            @keydown.enter="($event.target as HTMLElement).blur()"
          />
          <div class="mt-2">
            <NoteMetaBar
              :note="noteStore.activeNote"
              :category-name="activeCategoryName"
              :saving="isSaving"
              :viewing-version="viewingVersion"
              :mobile="true"
              @save="handleSaveNote"
              @history="showVersionHistory = true"
              @back-to-current="handleBackToCurrent"
            />
          </div>
          <NAlert
            v-if="viewingVersion"
            type="warning"
            show-icon
            class="mt-2"
            :show-arrow="false"
          >
            {{ t("note.version.viewing_warning", { version: viewingVersionNo }) }}
          </NAlert>
        </div>
        <div class="flex-1 overflow-hidden bg-white px-4 pb-4 pt-0">
          <NoteEditor
            :model-value="draftContent"
            height="100%"
            @update:model-value="handleEditorChange"
          />
        </div>
      </template>
      <!-- 笔记加载中 -->
      <div v-else-if="hasActiveNote && noteDetailLoading" class="flex flex-1 items-center justify-center bg-white">
        <NSpin size="medium" />
      </div>
      <div v-else class="flex flex-1 items-center justify-center bg-white">
        <div class="flex flex-col items-center gap-3 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <ZIcon name="ri:notebook-2-line" :size="32" color="#94a3b8" />
          </div>
          <div>
            <p class="text-base font-medium text-slate-700">{{ t("note.empty.workspace.title") }}</p>
            <p class="mt-1 text-sm text-slate-400">{{ t("note.empty.workspace.desc") }}</p>
          </div>
        </div>
      </div>
    </main>

    <!-- ==================== Dialogs ==================== -->
    <CategoryContextMenu
      v-model:show="categoryMenuShow"
      :x="categoryMenuX"
      :y="categoryMenuY"
      :node="categoryMenuNode"
      @select="handleCategoryMenuSelect"
    />
    <NModal
      v-model:show="showRenameDialog"
      preset="dialog"
      :title="t('note.category.rename.title')"
      :positive-text="t('note.dialog.confirm')"
      :negative-text="t('note.dialog.cancel')"
      :mask-closable="false"
      @positive-click="handleConfirmRename"
      @negative-click="showRenameDialog = false"
    >
      <NInput
        v-model:value="renameValue"
        :placeholder="t('note.category.rename.placeholder')"
        autofocus
        @keydown.enter="handleConfirmRename"
      />
    </NModal>
    <DeleteNotebookDialog
      v-model:show="showDeleteDialog"
      :node="deleteTarget"
      @confirm="handleConfirmDelete"
    />
    <MoveDialog
      v-model:show="showMoveDialog"
      :type="moveDialogType"
      :source-id="moveSourceId"
      :source-name="moveSourceName"
      :notebook-tree="currentCategoryTree"
      :exclude-node-ids="moveExcludeIds"
      :current-category-id="moveCurrentCategoryId ?? undefined"
      @confirm="handleMoveConfirm"
      @cancel="handleMoveCancel"
    />
    <CreateNotebookDialog
      v-model:show="showCreateNotebook"
      :parent-id="null"
      @confirm="handleConfirmCreateNotebook"
    />
    <CreateNotebookDialog
      v-model:show="showCreateCategory"
      :parent-id="newCategoryParent?.id ?? null"
      :parent-name="newCategoryParent?.name"
      @confirm="handleConfirmCreateCategory"
    />
    <ImportDialog
      v-model:show="showImportDialog"
      :notebook-id="noteStore.activeNotebookId"
    />
    <VersionHistoryDialog
      v-model:show="showVersionHistory"
      :note-id="noteStore.activeNoteId"
      @view="handleViewVersion"
    />
  </div>
</template>

<style scoped>
/* 拖拽把手：两栏之间各放一个，4px 宽
   视觉完全透明，仅靠 cursor: col-resize 提示可拖拽 */
.resize-handle {
  width: 2px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
}
/* 笔记标题输入框：原生 input，无边框无内边距，适合标题大小 */
.note-title-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  padding: 0;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.4;
  color: #1e293b;
}
.note-title-input::placeholder {
  color: #cbd5e1;
  font-weight: 600;
}
</style>
