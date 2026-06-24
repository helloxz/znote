<script setup lang="ts">
/**
 * Vditor 编辑器核心组件
 *
 * 基于 Vditor 的 Markdown 编辑器（即时渲染模式，类似 Typora）
 * 实现 v-model 兼容，支持外部值同步和输入监听
 *
 * 主题配置：
 *   - 编辑器主题：classic（与 Znote 亮色界面协调）
 *   - 内容主题：ant-design（默认）/ light / dark / wechat（用户可在工具栏切换）
 *   - 代码主题：github（带行号）
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import Vditor from "vditor";
import "vditor/dist/index.css";

const props = defineProps<{
    /** 编辑器内容（Markdown 格式） */
    modelValue: string;
    /** 占位提示文本 */
    placeholder?: string;
}>();

const emit = defineEmits<{
    (e: "update:modelValue", value: string): void;
    (e: "ready"): void;
}>();

/** 标记是否由内部触发的内容更新，避免循环同步 */
let isInternalUpdate = false;

/** 编辑器挂载容器 */
const editorRef = ref<HTMLDivElement>();

/** Vditor 实例引用 */
let vditor: Vditor | null = null;

/**
 * onMounted 阶段创建 Vditor 实例
 * 配置即时渲染模式 + Ant Design 内容主题 + Github 代码主题
 */
onMounted(() => {
    if (!editorRef.value) return;

    vditor = new Vditor(editorRef.value, {
        height: "100%",
        mode: "ir",
        theme: "classic",
        lang: "zh_CN",
        placeholder: props.placeholder || "开始编写...",
        value: props.modelValue,
        toolbarConfig: { pin: true },
        cache: { enable: false },
        counter: { enable: true, type: "text" },
        outline: { enable: false, position: "left" },
        typewriterMode: false,
        preview: {
            theme: {
                current: "ant-design",
                list: {
                    "ant-design": "Ant Design",
                    light: "Light",
                    dark: "Dark",
                    wechat: "WeChat",
                },
                path: "https://unpkg.com/vditor@3.11.2/dist/css/content-theme",
            },
            hljs: {
                style: "github",
                lineNumber: true,
            },
            markdown: {
                // autoSpace: true,
                fixTermTypo: true,
                toc: true,
            },
        },
        input(value) {
            if (!isInternalUpdate) {
                emit("update:modelValue", value);
            }
        },
        after() {
            emit("ready");
        },
    });
});

/**
 * 监听外部值变化（切换笔记时同步到编辑器）
 * 使用 isInternalUpdate 标记避免循环更新
 */
watch(
    () => props.modelValue,
    (val) => {
        if (isInternalUpdate) return;
        if (!vditor) return;
        if (val !== vditor.getValue()) {
            isInternalUpdate = true;
            vditor.setValue(val || "");
            nextTick(() => {
                isInternalUpdate = false;
            });
        }
    },
);

/** 组件卸载时销毁 Vditor 实例，释放资源 */
onBeforeUnmount(() => {
    vditor?.destroy();
    vditor = null;
});
</script>

<template>
  <div ref="editorRef" class="vditor-wrapper" />
</template>

<style scoped>
.vditor-wrapper {
  width: 100%;
  height: 100%;
}
</style>
