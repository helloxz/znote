<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NInput, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useSystemStore } from "@/stores/system";
import req from "@/utils/req";

const router = useRouter();
const message = useMessage();
const { t } = useI18n();
const loading = ref(false);
const systemStore = useSystemStore();

const form = reactive({
    username: "",
    email: "",
    password: "",
});

const allowRegister = computed(() => systemStore.status.allow_register);

onMounted(() => {
    void systemStore.fetchStatus();
});

const handleRegister = async () => {
    if (loading.value) {
        return;
    }

    const username = form.username.trim();
    const email = form.email.trim();
    const password = form.password.trim();
    if (!username || !email || !password) {
        message.error(t("init.fill.all"));
        return;
    }

    loading.value = true;
    try {
        const res = await req.post("/api/register", { username, email, password });
        const result = res.data;
        if (result?.code !== 200 || !result?.data?.token) {
            message.error(t(result?.msg || "register.request.failed"));
            return;
        }
        localStorage.setItem("token", result.data.token);
        message.success(t(result?.msg || "register.success"));
        window.setTimeout(() => {
            router.push(result.data.redirect || "/dashboard/home");
        }, 800);
    } catch {
        message.error(t("register.request.failed"));
    } finally {
        loading.value = false;
    }
};
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-6 py-10">
    <div class="w-full max-w-[400px]">
      <div class="mb-6 text-center">
        <div class="text-[30px] font-semibold tracking-[-0.02em] text-slate-900">{{ t("register.title") }}</div>
        <p class="mt-2 text-sm leading-6 text-slate-500">{{ t("register.description") }}</p>
      </div>
      <NCard :bordered="false" class="rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <div v-if="allowRegister" class="space-y-5">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">{{ t("register.username") }}</label>
            <NInput v-model:value="form.username" size="large" :placeholder="t('register.username.placeholder')" @keyup.enter="handleRegister" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">{{ t("register.email") }}</label>
            <NInput v-model:value="form.email" size="large" :placeholder="t('register.email.placeholder')" @keyup.enter="handleRegister" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">{{ t("login.password") }}</label>
            <NInput v-model:value="form.password" size="large" type="password" show-password-on="click" :placeholder="t('register.password.placeholder')" @keyup.enter="handleRegister" />
          </div>
          <NButton type="primary" size="large" block :loading="loading" @click="handleRegister">{{ t("register.submit") }}</NButton>
        </div>
        <div v-else class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {{ t("register.disabled_notice") }}
        </div>
      </NCard>
    </div>
  </div>
</template>
