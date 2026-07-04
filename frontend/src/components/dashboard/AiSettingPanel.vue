<template>
    <div class="ai-setting p-3 md:p-6">
        <div class="flex flex-col items-center gap-6">
            <n-card :bordered="false" class="w-full max-w-[640px] rounded-xl shadow-sm">
                <!-- 向量模型配置 -->
                <div class="mb-4 text-[18px] font-semibold text-[#222]">{{ t("ai_setting.embedding.title") }}</div>

                <n-form ref="embeddingFormRef" label-placement="top" :model="embeddingForm" :rules="embeddingRules">
                    <n-form-item :label="t('ai_setting.embedding.enabled')">
                        <n-switch v-model:value="embeddingForm.enabled">
                            <template #checked>{{ t("ai_setting.embedding.enabled_on") }}</template>
                            <template #unchecked>{{ t("ai_setting.embedding.enabled_off") }}</template>
                        </n-switch>
                    </n-form-item>

                    <n-form-item :label="t('ai_setting.embedding.provider')" path="provider">
                        <n-select
                            v-model:value="embeddingForm.provider"
                            :options="embeddingProviderOptions"
                            :placeholder="t('ai_setting.embedding.provider.placeholder')"
                        />
                    </n-form-item>

                    <n-form-item :label="t('ai_setting.embedding.model')" path="model">
                        <n-select
                            v-model:value="embeddingForm.model"
                            :options="embeddingModelOptions"
                            :placeholder="t('ai_setting.embedding.model.placeholder')"
                        />
                    </n-form-item>

                    <n-form-item :label="t('ai_setting.embedding.api_key')" path="api_key">
                        <n-input
                            v-model:value="embeddingForm.api_key"
                            type="password"
                            show-password-on="click"
                            :placeholder="t('ai_setting.embedding.api_key.placeholder')"
                        />
                    </n-form-item>
                </n-form>

                <div class="mt-6 flex justify-start">
                    <n-button
                        type="primary"
                        :loading="embeddingSubmitting"
                        @click="handleEmbeddingSubmit"
                    >
                        {{ t("ai_setting.form.save") }}
                    </n-button>
                </div>

                <!-- 分割线 -->
                <n-divider />

                <!-- 对话模型配置 -->
                <div class="mb-4 text-[18px] font-semibold text-[#222]">{{ t("ai_setting.chat.title") }}</div>

                <n-form ref="chatFormRef" label-placement="top" :model="chatForm" :rules="chatRules">
                    <n-form-item :label="t('ai_setting.chat.provider')" path="provider">
                        <n-select
                            v-model:value="chatForm.provider"
                            :options="chatProviderOptions"
                            :placeholder="t('ai_setting.chat.provider.placeholder')"
                            @update:value="handleChatProviderChange"
                        />
                    </n-form-item>

                    <n-form-item :label="t('ai_setting.chat.base_url')" path="base_url">
                        <n-input
                            v-model:value="chatForm.base_url"
                            :disabled="chatForm.provider === 'siliconflow'"
                            :placeholder="t('ai_setting.chat.base_url.placeholder')"
                        />
                    </n-form-item>

                    <n-form-item :label="t('ai_setting.chat.model')" path="model">
                        <n-select
                            v-if="chatForm.provider === 'siliconflow'"
                            v-model:value="chatForm.model"
                            :options="chatModelOptions"
                            :placeholder="t('ai_setting.chat.model.placeholder')"
                        />
                        <n-input
                            v-else
                            v-model:value="chatForm.model"
                            :placeholder="t('ai_setting.chat.model.input_placeholder')"
                        />
                    </n-form-item>

                    <n-form-item :label="t('ai_setting.chat.api_key')" path="api_key">
                        <n-input
                            v-model:value="chatForm.api_key"
                            type="password"
                            show-password-on="click"
                            :placeholder="t('ai_setting.chat.api_key.placeholder')"
                        />
                    </n-form-item>
                </n-form>

                <div class="mt-6 flex justify-start">
                    <n-button
                        type="primary"
                        :loading="chatSubmitting"
                        @click="handleChatSubmit"
                    >
                        {{ t("ai_setting.form.save") }}
                    </n-button>
                </div>
            </n-card>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import type { FormInst, FormRules } from "naive-ui";
import { NButton, NCard, NDivider, NForm, NFormItem, NInput, NSelect, NSwitch, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import req from "@/utils/req";

const { t } = useI18n();
const message = useMessage();

// ==================== 向量模型配置 ====================
const embeddingFormRef = ref<FormInst | null>(null);
const embeddingSubmitting = ref(false);

const embeddingForm = reactive({
    enabled: false,
    provider: "siliconflow",
    model: "BAAI/bge-m3",
    api_key: "",
});

const embeddingRules: FormRules = {
    provider: [{ required: true, message: () => t("ai_setting.embedding.provider.required"), trigger: "change" }],
    model: [{ required: true, message: () => t("ai_setting.embedding.model.required"), trigger: "change" }],
    api_key: [{ required: true, message: () => t("ai_setting.embedding.api_key.required"), trigger: "blur" }],
};

const embeddingProviderOptions = [
    { label: "硅基流动", value: "siliconflow" },
];

const embeddingModelOptions = [
    { label: "BAAI/bge-m3", value: "BAAI/bge-m3" },
    { label: "Qwen/Qwen3-Embedding-8B", value: "Qwen/Qwen3-Embedding-8B" },
];

// 加载向量模型配置
const loadEmbeddingSetting = async () => {
    try {
        const res = await req.get("/api/admin/get_setting", {
            params: { key: "ai_embedding_setting" },
        });
        const result = res.data;
        if (result?.code === 200 && result?.data) {
            const data = result.data;
            embeddingForm.enabled = Boolean(data.enabled);
            embeddingForm.provider = data.provider || "siliconflow";
            embeddingForm.model = data.model || "BAAI/bge-m3";
            embeddingForm.api_key = data.api_key || "";
        }
    } catch {
        // 首次加载无数据时忽略错误
    }
};

// 保存向量模型配置
const handleEmbeddingSubmit = async () => {
    try {
        await embeddingFormRef.value?.validate();
    } catch {
        return;
    }

    embeddingSubmitting.value = true;
    try {
        const res = await req.post("/api/admin/set_setting", {
            key: "ai_embedding_setting",
            value: {
                enabled: embeddingForm.enabled,
                provider: embeddingForm.provider,
                model: embeddingForm.model,
                api_key: embeddingForm.api_key,
            },
        });
        const result = res.data;
        if (result?.code === 200) {
            message.success(t("ai_setting.save.success"));
        } else {
            message.error(result?.msg || t("ai_setting.save.failed"));
        }
    } catch {
        message.error(t("ai_setting.save.failed"));
    } finally {
        embeddingSubmitting.value = false;
    }
};

// ==================== 对话模型配置 ====================
const chatFormRef = ref<FormInst | null>(null);
const chatSubmitting = ref(false);

const chatForm = reactive({
    provider: "siliconflow",
    base_url: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V4-Flash",
    api_key: "",
});

const chatRules: FormRules = {
    provider: [{ required: true, message: () => t("ai_setting.chat.provider.required"), trigger: "change" }],
    base_url: [{ required: true, message: () => t("ai_setting.chat.base_url.required"), trigger: "blur" }],
    model: [{ required: true, message: () => t("ai_setting.chat.model.required"), trigger: ["blur", "change"] }],
    api_key: [{ required: true, message: () => t("ai_setting.chat.api_key.required"), trigger: "blur" }],
};

const chatProviderOptions = [
    { label: "硅基流动", value: "siliconflow" },
    { label: "自定义", value: "custom" },
];

const chatModelOptions = [
    { label: "deepseek-ai/DeepSeek-V4-Flash", value: "deepseek-ai/DeepSeek-V4-Flash" },
    { label: "Qwen/Qwen3.6-35B-A3B", value: "Qwen/Qwen3.6-35B-A3B" },
];

// 渠道商切换处理
const handleChatProviderChange = (value: string) => {
    if (value === "siliconflow") {
        chatForm.base_url = "https://api.siliconflow.cn/v1";
        chatForm.model = "deepseek-ai/DeepSeek-V4-Flash";
    } else {
        chatForm.base_url = "";
        chatForm.model = "";
    }
};

// 加载对话模型配置
const loadChatSetting = async () => {
    try {
        const res = await req.get("/api/admin/get_setting", {
            params: { key: "ai_chat_setting" },
        });
        const result = res.data;
        if (result?.code === 200 && result?.data) {
            const data = result.data;
            chatForm.provider = data.provider || "siliconflow";
            chatForm.base_url = data.base_url || "";
            chatForm.model = data.model || "";
            chatForm.api_key = data.api_key || "";
        }
    } catch {
        // 首次加载无数据时忽略错误
    }
};

// 保存对话模型配置
const handleChatSubmit = async () => {
    try {
        await chatFormRef.value?.validate();
    } catch {
        return;
    }

    chatSubmitting.value = true;
    try {
        const res = await req.post("/api/admin/set_setting", {
            key: "ai_chat_setting",
            value: {
                provider: chatForm.provider,
                base_url: chatForm.base_url,
                model: chatForm.model,
                api_key: chatForm.api_key,
            },
        });
        const result = res.data;
        if (result?.code === 200) {
            message.success(t("ai_setting.save.success"));
        } else {
            message.error(result?.msg || t("ai_setting.save.failed"));
        }
    } catch {
        message.error(t("ai_setting.save.failed"));
    } finally {
        chatSubmitting.value = false;
    }
};

onMounted(() => {
    loadEmbeddingSetting();
    loadChatSetting();
});
</script>

<style scoped>
.ai-setting {
    min-height: 100%;
}
</style>
