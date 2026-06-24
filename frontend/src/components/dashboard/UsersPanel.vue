<script setup lang="ts">
import { h, onMounted, ref } from "vue";
import { NButton, NCard, NDataTable, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import req from "@/utils/req";

const message = useMessage();
const { t } = useI18n();
const rows = ref<any[]>([]);
const loading = ref(false);

const fetchUsers = async () => {
    loading.value = true;
    try {
        const res = await req.get("/api/admin/list_users");
        if (res.data?.code === 200) {
            rows.value = res.data.data || [];
        }
    } finally {
        loading.value = false;
    }
};

const resetPassword = async (id: number) => {
    const res = await req.post("/api/admin/reset_user_password", { id });
    if (res.data?.code !== 200) {
        message.error(res.data?.msg || t("panel.users.reset_failed"));
        return;
    }
    message.success(t("panel.users.new_password", { password: res.data.data.password }));
};

const columns = [
    { title: t("panel.users.col.id"), key: "id", width: 80 },
    { title: t("panel.users.col.username"), key: "username" },
    { title: t("panel.users.col.email"), key: "email" },
    { title: t("panel.users.col.role"), key: "role", width: 100 },
    { title: t("panel.users.col.status"), key: "status", width: 100 },
    { title: t("panel.users.col.reg_ip"), key: "reg_ip" },
    {
        title: t("panel.users.col.actions"),
        key: "actions",
        width: 160,
        render: (row: any) => row.role === "user"
            ? h(
                NButton,
                { size: "small", onClick: () => resetPassword(row.id) },
                { default: () => t("panel.users.reset_password") },
            )
            : "-",
    },
];

onMounted(() => {
    void fetchUsers();
});
</script>

<template>
  <div class="p-6">
    <NCard :bordered="false" class="rounded-3xl">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">{{ t("panel.users.title") }}</h2>
          <p class="mt-1 text-sm text-slate-500">{{ t("panel.users.description") }}</p>
        </div>
        <NButton @click="fetchUsers">{{ t("panel.users.refresh") }}</NButton>
      </div>
      <NDataTable :columns="columns" :data="rows" :loading="loading" />
    </NCard>
  </div>
</template>
