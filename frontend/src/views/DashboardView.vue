<script setup lang="ts">
import { computed, h, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NDropdown } from "naive-ui";
import { useI18n } from "vue-i18n";
import ZIcon from "@/components/DynamicIcon.vue";
import { menuConfig } from "@/config/menu";
import HomePanel from "@/components/dashboard/HomePanel.vue";
import DocsPanel from "@/components/dashboard/DocsPanel.vue";
import UsersPanel from "@/components/dashboard/UsersPanel.vue";
import TemplatePanel from "@/components/dashboard/TemplatePanel.vue";
import SystemPanel from "@/components/dashboard/SystemPanel.vue";
import { useUserStore } from "@/stores/user";
import { useSiteStore } from "@/stores/site";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const siteStore = useSiteStore();
const { t } = useI18n();

const sidebarOpen = ref(false);
const currentRoute = ref("/dashboard/home");
const currentComponent = shallowRef(HomePanel);

const componentMap: Record<string, any> = {
    home: HomePanel,
    docs: DocsPanel,
    users: UsersPanel,
    templates: TemplatePanel,
    settings: SystemPanel,
};

const appName = computed(() => siteStore.appInfo.app_name || "ZNote");

const userMenuOptions = computed(() => [
    { label: t("dashboard.user_menu.home"), key: "home", icon: () => h(ZIcon, { name: "ri:home-line", size: 16 }) },
    { label: t("dashboard.user_menu.logout"), key: "logout", icon: () => h(ZIcon, { name: "ri:logout-box-line", size: 16 }) },
]);

const navigateTo = async (path: string) => {
    currentRoute.value = path;
    sidebarOpen.value = false;
    await router.push(path);
};

const loadRouteComponent = (name?: string | string[]) => {
    const routeName = typeof name === "string" ? name : "home";
    currentRoute.value = `/dashboard/${routeName}`;
    currentComponent.value = componentMap[routeName] || HomePanel;
};

const handleUserMenuSelect = (key: string) => {
    if (key === "home") {
        router.push("/");
        return;
    }
    if (key === "logout") {
        void userStore.logout();
    }
};

onMounted(async () => {
    await userStore.checkLogin();
    await userStore.getUserInfo();
    await siteStore.fetchAppInfo();
    loadRouteComponent(route.params.name);
});

watch(() => route.params.name, (name) => {
    loadRouteComponent(name);
});
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-100">
    <header class="z-50 flex h-14 items-center justify-between bg-[#14182A] px-4 text-white shadow-sm">
      <div class="flex items-center gap-3">
        <button class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden" @click="sidebarOpen = !sidebarOpen">
          <ZIcon name="ri:menu-line" size="20" color="#fff" />
        </button>
        <div>
          <div class="text-lg font-semibold tracking-wide">{{ appName }}</div>
        </div>
      </div>
      <NDropdown :options="userMenuOptions" @select="handleUserMenuSelect">
        <div class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10">
          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <ZIcon name="ri:user-smile-line" size="16" color="#fff" />
          </div>
          <span class="text-sm text-white/80">{{ userStore.userInfo.username || t('dashboard.user.fallback') }}</span>
          <ZIcon name="ri:arrow-down-s-line" size="16" color="#ffffff99" />
        </div>
      </NDropdown>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <div v-if="sidebarOpen" class="fixed inset-0 z-40 bg-black/40 lg:hidden" @click="sidebarOpen = false" />

      <aside :class="[
        'fixed inset-y-0 left-0 top-14 z-40 w-60 bg-[#242739] text-white transition-transform duration-300 lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]">
        <nav class="space-y-1 p-3">
          <button
            v-for="menu in menuConfig"
            :key="menu.id"
            class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition"
            :class="currentRoute === menu.route ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'"
            @click="navigateTo(menu.route)"
          >
            <ZIcon :name="menu.icon" size="18" color="currentColor" />
            <span>{{ t(menu.titleKey) }}</span>
          </button>
        </nav>
      </aside>

      <main class="flex-1 overflow-y-auto">
        <component :is="currentComponent" />
      </main>
    </div>
  </div>
</template>
