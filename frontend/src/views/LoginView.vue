<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NInput, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import req from "@/utils/req";

const router = useRouter();
const message = useMessage();
const { t } = useI18n();
const loading = ref(false);

const form = reactive({
    username: "",
    password: "",
});

const handleLogin = async () => {
    if (loading.value) {
        return;
    }

    const username = form.username.trim();
    const password = form.password.trim();
    if (!username || !password) {
        message.error(t("login.username_password.required"));
        return;
    }

    loading.value = true;
    try {
        const res = await req.post("/api/login", { username, password });
        const result = res.data;
        if (result?.code !== 200 || !result?.data?.token) {
          message.error(t(result?.msg || "login.request.failed"));
          return;
        }

        localStorage.setItem("token", result.data.token);
        message.success(t(result?.msg || "login.success"));
        window.setTimeout(() => {
            router.push(result.data.redirect || "/dashboard/home");
        }, 800);
    } catch {
        message.error(t("login.request.failed"));
    } finally {
        loading.value = false;
    }
};
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-6 py-10">
    <div class="w-full max-w-[400px]">
      <div class="mb-6 text-center">
        <div class="text-[30px] font-semibold tracking-[-0.02em] text-slate-900">{{ t("login.welcome") }}</div>
        <p class="mt-2 text-sm leading-6 text-slate-500">{{ t("login.description") }}</p>
      </div>
      <NCard :bordered="false" class="rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <div class="space-y-5">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">{{ t("login.email_or_username") }}</label>
            <NInput v-model:value="form.username" size="large" :placeholder="t('login.email_or_username.placeholder')" @keyup.enter="handleLogin" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">{{ t("login.password") }}</label>
            <NInput v-model:value="form.password" size="large" type="password" show-password-on="click" :placeholder="t('login.password.placeholder')" @keyup.enter="handleLogin" />
          </div>
          <NButton type="primary" size="large" block :loading="loading" @click="handleLogin">{{ t("login.submit") }}</NButton>
          <div class="mt-4 text-center text-sm text-slate-500">
            {{ t("login.no_account") }}
            <router-link to="/user/register" class="text-[#3b6ea8]">{{ t("login.register_now") }}</router-link>
          </div>
        </div>
      </NCard>
    </div>
  </div>
</template>
