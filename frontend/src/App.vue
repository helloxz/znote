<script setup lang="ts">
import { computed } from "vue";
import { RouterView } from "vue-router";
import { NConfigProvider, NDialogProvider, NLoadingBarProvider, NMessageProvider, dateEnUS, dateZhCN, enUS, zhCN } from "naive-ui";
import type { GlobalThemeOverrides } from "naive-ui";
import { useI18n } from "vue-i18n";

const { locale } = useI18n();
const naiveLocale = computed(() => (locale.value === "zh" ? zhCN : enUS));
const naiveDateLocale = computed(() => (locale.value === "zh" ? dateZhCN : dateEnUS));

const themeOverrides: GlobalThemeOverrides = {
    common: {
        primaryColor: "#3b6ea8",
        primaryColorHover: "#477bb5",
        primaryColorPressed: "#315d8d",
        primaryColorSuppl: "#6f97c4",
    },
};
</script>

<template>
  <NConfigProvider :locale="naiveLocale" :date-locale="naiveDateLocale" :theme-overrides="themeOverrides">
    <NLoadingBarProvider>
      <NDialogProvider>
        <NMessageProvider>
          <RouterView />
        </NMessageProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
