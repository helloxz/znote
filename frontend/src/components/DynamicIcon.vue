<script setup lang="ts">
import { Icon } from "@iconify/vue";

defineProps<{
  name: string;
  size?: number | string;
  color?: string;
}>();
</script>

<template>
  <Icon :icon="name" :width="size || 18" :height="size || 18" :color="color" />
</template>
