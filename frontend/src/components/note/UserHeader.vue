<script setup lang="ts">
/**
 * 第一栏顶部：用户信息卡片
 *
 * 功能：
 * 1. 展示头像和昵称（无头像回退为首字母）
 * 2. 下拉菜单：修改密码、返回后台（仅管理员）、退出登录
 * 3. 通过事件与父组件通信，路由跳转由 NoteView 统一处理
 */
import { computed, h, ref } from "vue";
import { NDropdown } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useUserStore } from "@/stores/user";
import ZIcon from "@/components/DynamicIcon.vue";
import ChangePasswordDialog from "@/components/note/dialogs/ChangePasswordDialog.vue";

const { t } = useI18n();
const userStore = useUserStore();

/** 修改密码弹窗显隐 */
const showChangePassword = ref(false);

const emit = defineEmits<{
    (e: "navigate", path: string): void;
}>();

/** 用户名首字母（用于无头像时的回退） */
const initial = computed(() => {
    const name = userStore.userInfo.username || "";
    return name.charAt(0).toUpperCase() || "U";
});

/** 判断当前用户是否为管理员 */
const isAdmin = computed(() => userStore.userInfo.role === "admin");

/** 下拉菜单配置 */
const userMenuOptions = computed(() => {
    const options: Array<Record<string, unknown>> = [
        {
            label: t("note.user.change_password"),
            key: "change_password",
            icon: () => h(ZIcon, { name: "ri:lock-password-line", size: 16 }),
        },
    ];

    // 仅管理员显示"返回后台"
    if (isAdmin.value) {
        options.push({
            label: t("note.user.back_dashboard"),
            key: "dashboard",
            icon: () => h(ZIcon, { name: "ri:dashboard-line", size: 16 }),
        });
    }

    options.push(
        { type: "divider", key: "d1" },
        {
            label: t("note.user.logout"),
            key: "logout",
            icon: () => h(ZIcon, { name: "ri:logout-box-line", size: 16 }),
        }
    );

    return options;
});

/** 处理下拉菜单选择 */
const handleMenuSelect = (key: string) => {
    if (key === "change_password") {
        showChangePassword.value = true;
        return;
    }
    if (key === "dashboard") {
        emit("navigate", "/dashboard/home");
        return;
    }
    if (key === "logout") {
        void userStore.logout();
    }
};
</script>

<template>
  <!-- 用户信息卡片：头像 + 昵称（点击头像展开下拉菜单） -->
  <div class="flex items-center gap-2.5 px-3 py-2.5">
    <NDropdown :options="userMenuOptions" trigger="click" @select="handleMenuSelect">
      <!-- 头像（无图时回退为首字母） -->
      <div
        class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-semibold text-white transition hover:ring-2 hover:ring-blue-400/60"
      >
        <img v-if="userStore.userInfo.avatar" :src="userStore.userInfo.avatar" class="h-full w-full object-cover" alt="avatar" />
        <span v-else>{{ initial }}</span>
      </div>
    </NDropdown>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium text-slate-100">
        {{ userStore.userInfo.username || t("dashboard.user.fallback") }}
      </div>
      <div class="truncate text-xs text-slate-400">
        {{ userStore.userInfo.email || "" }}
      </div>
    </div>

    <!-- 修改密码弹窗 -->
    <ChangePasswordDialog v-model:show="showChangePassword" />
  </div>
</template>
