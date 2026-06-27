<script setup lang="ts">
/**
 * 修改密码对话框
 *
 * 功能：
 * 1. 输入旧密码、新密码、确认新密码
 * 2. 调用后端 API 修改密码
 * 3. 成功后 3 秒自动退出登录
 */
import { reactive, ref, watch } from "vue";
import { NInput, NModal } from "naive-ui";
import { useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useUserStore } from "@/stores/user";
import req from "@/utils/req";

const { t } = useI18n();
const message = useMessage();
const userStore = useUserStore();

const props = defineProps<{
    show: boolean;
}>();

const emit = defineEmits<{
    (e: "update:show", value: boolean): void;
}>();

/** 表单数据 */
const form = reactive({
    old_password: "",
    new_password: "",
    repeat_password: "",
});

/** 提交按钮加载态 */
const submitting = ref(false);
/** 是否显示成功提示（用于 3 秒倒计时） */
const showSuccess = ref(false);
/** 倒计时秒数 */
const countdown = ref(3);
/** 倒计时定时器 */
let countdownTimer: ReturnType<typeof setInterval> | null = null;

/** 弹窗打开时重置表单 */
watch(
    () => props.show,
    (val) => {
        if (val) {
            form.old_password = "";
            form.new_password = "";
            form.repeat_password = "";
            submitting.value = false;
            showSuccess.value = false;
            countdown.value = 3;
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
        }
    },
);

/** 关闭弹窗 */
const handleClose = () => {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    emit("update:show", false);
};

/** 提交修改密码 */
const handleSubmit = async () => {
    if (submitting.value) return;

    // 表单校验
    if (!form.old_password || !form.new_password || !form.repeat_password) {
        message.error(t("note.password.dialog.fields.required"));
        return;
    }

    if (form.new_password !== form.repeat_password) {
        message.error(t("user.password.repeat.not_match"));
        return;
    }

    submitting.value = true;
    try {
        const res = await req.post("/api/user/change_password", {
            old_password: form.old_password,
            new_password: form.new_password,
            repeat_password: form.repeat_password,
        });

        if (res.data?.code !== 200) {
            message.error(t(res.data?.msg || "invalid.password"));
            return;
        }

        // 修改成功，显示倒计时
        showSuccess.value = true;
        message.success(t("note.password.dialog.success"));

        // 3 秒后退出登录
        countdownTimer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) {
                if (countdownTimer) {
                    clearInterval(countdownTimer);
                    countdownTimer = null;
                }
                void userStore.clearLoginState("/user/login");
            }
        }, 1000);
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('note.password.dialog.title')"
    class="max-w-md"
    :mask-closable="!submitting && !showSuccess"
    :close-on-esc="!submitting && !showSuccess"
    @update:show="handleClose"
  >
    <div class="space-y-4">
      <!-- 旧密码 -->
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700">
          {{ t("note.password.dialog.old_password") }}
        </label>
        <NInput
          v-model:value="form.old_password"
          type="password"
          show-password-on="click"
          :disabled="submitting || showSuccess"
          :placeholder="t('note.password.dialog.old_password')"
        />
      </div>

      <!-- 新密码 -->
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700">
          {{ t("note.password.dialog.new_password") }}
        </label>
        <NInput
          v-model:value="form.new_password"
          type="password"
          show-password-on="click"
          :disabled="submitting || showSuccess"
          :placeholder="t('note.password.dialog.new_password')"
        />
      </div>

      <!-- 确认新密码 -->
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700">
          {{ t("note.password.dialog.repeat_password") }}
        </label>
        <NInput
          v-model:value="form.repeat_password"
          type="password"
          show-password-on="click"
          :disabled="submitting || showSuccess"
          :placeholder="t('note.password.dialog.repeat_password')"
          @keydown.enter="handleSubmit"
        />
      </div>

      <!-- 成功提示 -->
      <div
        v-if="showSuccess"
        class="rounded-lg bg-green-50 p-3 text-sm text-green-600"
      >
        {{ t("note.password.dialog.logout_countdown", { seconds: countdown }) }}
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          class="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          :disabled="submitting"
          @click="handleClose"
        >
          {{ t("note.dialog.cancel") }}
        </button>
        <button
          class="rounded-md bg-[#3B6EA8] px-4 py-1.5 text-sm text-white transition hover:bg-[#2d5a8a] disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="submitting || showSuccess"
          @click="handleSubmit"
        >
          {{ t("note.password.dialog.confirm") }}
        </button>
      </div>
    </template>
  </NModal>
</template>
