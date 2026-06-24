<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { NButton, NCard, NInput, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useUserStore } from "@/stores/user";
import req from "@/utils/req";

const userStore = useUserStore();
const message = useMessage();
const { t } = useI18n();
const submitting = ref(false);

const form = reactive({
    old_password: "",
    new_password: "",
    repeat_password: "",
});

onMounted(() => {
    void userStore.getUserInfo();
});

const handleSubmit = async () => {
    if (submitting.value) {
        return;
    }

    if (!form.old_password || !form.new_password || !form.repeat_password) {
        message.error(t("password.fields.required"));
        return;
    }

    submitting.value = true;
    try {
        const res = await req.post("/api/user/change_password", form);
        if (res.data?.code !== 200) {
            message.error(t(res.data?.msg || "invalid.password"));
            return;
        }
        message.success(t(res.data?.msg || "user.password.update.success"));
        form.old_password = "";
        form.new_password = "";
        form.repeat_password = "";
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
  <div class="p-6">
    <div class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <NCard :bordered="false" class="rounded-3xl">
        <div class="space-y-4">
          <div>
            <div class="text-sm text-slate-500">{{ t("panel.profile.current_user") }}</div>
            <div class="mt-2 text-2xl font-semibold text-slate-900">{{ userStore.userInfo.username || '-' }}</div>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {{ t("panel.profile.email") }}：{{ userStore.userInfo.email || '-' }}<br />
            {{ t("panel.profile.role") }}：{{ userStore.userInfo.role || '-' }}
          </div>
        </div>
      </NCard>

      <NCard :bordered="false" class="rounded-3xl">
        <div class="space-y-5">
          <div>
            <h2 class="text-xl font-semibold text-slate-900">{{ t("panel.profile.change_password") }}</h2>
            <p class="mt-1 text-sm text-slate-500">{{ t("panel.profile.change_password.description") }}</p>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">{{ t("panel.profile.old_password") }}</label>
            <NInput v-model:value="form.old_password" type="password" show-password-on="click" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">{{ t("panel.profile.new_password") }}</label>
            <NInput v-model:value="form.new_password" type="password" show-password-on="click" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">{{ t("panel.profile.repeat_new_password") }}</label>
            <NInput v-model:value="form.repeat_password" type="password" show-password-on="click" />
          </div>
          <NButton type="primary" :loading="submitting" @click="handleSubmit">{{ t("panel.profile.save_password") }}</NButton>
        </div>
      </NCard>
    </div>
  </div>
</template>
