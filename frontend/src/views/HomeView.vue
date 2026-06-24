<script setup lang="ts">
import { computed, onMounted } from "vue";
import { NButton, NCard, NSpace, NTag } from "naive-ui";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSystemStore } from "@/stores/system";

const router = useRouter();
const systemStore = useSystemStore();
const { t } = useI18n();

const status = computed(() => systemStore.status);

onMounted(() => {
    void systemStore.fetchStatus();
});
</script>

<template>
  <div class="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#eef4ff_55%,_#e8eef8)] px-6 py-10 text-slate-900">
    <div class="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
      <div class="grid w-full gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section class="space-y-6">
          <NTag type="info" size="small" round>Zest Web Starter</NTag>
          <div class="space-y-4">
            <h1 class="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-5xl">
              {{ t("home.title") }}
            </h1>
            <p class="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {{ t("home.description") }}
            </p>
          </div>
          <NSpace>
            <NButton type="primary" size="large" @click="router.push(status.initialized ? '/user/login' : '/user/init')">
              {{ status.initialized ? t('home.goto_login') : t('home.init_system') }}
            </NButton>
            <NButton size="large" @click="router.push('/dashboard/home')">{{ t("home.goto_dashboard") }}</NButton>
          </NSpace>
        </section>

        <NCard :bordered="false" class="rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div class="space-y-5">
            <div>
              <div class="text-sm text-slate-500">{{ t("home.framework_status") }}</div>
              <div class="mt-2 text-2xl font-semibold text-slate-900">{{ status.app_name }}</div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-slate-50 p-4">
                <div class="text-xs text-slate-500">{{ t("home.sys_init") }}</div>
                <div class="mt-2 text-lg font-semibold">{{ status.initialized ? t('home.sys_init.completed') : t('home.sys_init.not_init') }}</div>
              </div>
              <div class="rounded-2xl bg-slate-50 p-4">
                <div class="text-xs text-slate-500">{{ t("home.user_register") }}</div>
                <div class="mt-2 text-lg font-semibold">{{ status.allow_register ? t('home.user_register.enabled') : t('home.user_register.disabled') }}</div>
              </div>
            </div>
            <div class="rounded-2xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-600">
              {{ t("home.default_features") }}
            </div>
          </div>
        </NCard>
      </div>
    </div>
  </div>
</template>
