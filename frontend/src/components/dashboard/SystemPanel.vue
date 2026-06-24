<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="p-6">
    <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 class="text-2xl font-semibold text-slate-900">{{ t("panel.system.title") }}</h2>
      <p class="mt-3 text-sm leading-6 text-slate-500">
        {{ t("panel.system.description") }}
      </p>
    </div>
  </div>
</template>
