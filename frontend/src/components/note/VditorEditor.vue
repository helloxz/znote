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
 * 获取编辑器当前最新内容
 * 直接从 Vditor 实例取值，避免 input 回调延迟导致 draftContent 不同步
 */
const getContent = (): string => {
    return vditor?.getValue() ?? "";
};

defineExpose({ getContent });

/**
 * onMounted 阶段创建 Vditor 实例
 * 配置即时渲染模式 + Ant Design 内容主题 + Github 代码主题
 */
onMounted(() => {
    if (!editorRef.value) return;

    const isMobile = window.innerWidth < 768;

    vditor = new Vditor(editorRef.value, {
        height: "100%",
        mode: "wysiwyg",
        theme: "classic",
        lang: "zh_CN",
        icon: "ant",
        // 所有外部资源（图标/语言包/Lute引擎/高亮/主题CSS）从本地加载，不依赖 CDN
        cdn: "/static/vditor",
        placeholder: props.placeholder || "开始编写...",
        value: props.modelValue,
        toolbarConfig: { pin: true },
        ...(isMobile ? { toolbar: ["headings", "bold", "list", "check", "upload"] } : {}),
        customWysiwygToolbar(_type: string, _popover: HTMLElement) {
            // Vditor 3.11.2 要求在 options 中提供此回调，否则内部调用报错
        },
        cache: { enable: false },
        counter: { enable: true, type: "text" },
        outline: { enable: false, position: "left" },
        typewriterMode: false,
        preview: {
            theme: {
                current: "ant-design",
            },
            hljs: {
                style: "github",
                enable: true,
                lineNumber: true
            },
            markdown: {
                // autoSpace: true,
                fixTermTypo: true,
                toc: false, // 关闭目录生成，减少每次渲染开销
            },
        },
        upload: {
            /** 上传 API 地址 */
            url: (import.meta.env.VITE_API_URL || "") + "/api/user/file/upload",
            /** 单文件上限 10MB */
            max: 10 * 1024 * 1024,
            /** 允许的图片类型 */
            accept: "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp",
            /** 允许多文件上传 */
            multiple: true,
            /** 上传字段名（与后端 file[] 对应） */
            fieldName: "file[]",
            /** 每次上传前动态设置 Bearer Token 认证头 */
            setHeaders() {
                const headers: Record<string, string> = {};
                const token = localStorage.getItem("token");
                if (token) headers.Authorization = `Bearer ${token}`;
                return headers;
            },
            /** 将响应格式转换为 Vditor 内置数据结构 */
            format(_files: File[], responseText: string): string {
                const res = JSON.parse(responseText);
                const succMap: Record<string, string> = {};
                const errFiles: string[] = [];
                if (res.code === 200 && Array.isArray(res.data)) {
                    const baseUrl = import.meta.env.VITE_API_URL || "";
                    for (const item of res.data) {
                        if (item.url && item.original_name) {
                            succMap[item.original_name] = baseUrl + item.url;
                        } else {
                            errFiles.push(item.original_name || "unknown");
                        }
                    }
                } else {
                    for (const file of _files) {
                        errFiles.push(file.name);
                    }
                }
                return JSON.stringify({
                    code: 0,
                    msg: "",
                    data: { errFiles, succMap },
                });
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
